import { Router } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb, sql } from "../config/db.js";
import { env } from "../config/env.js";
import { sendPasswordResetEmail } from "../services/emailService.js";
import { calculateDistanceMiles } from "../services/mapsService.js";
import { calculateTotals, round2 } from "../utils/pricing.js";
import { normalizeSqlDate, normalizeSqlTime } from "../utils/sqlDateTime.js";
import { createCheckoutSession, stripe } from "../services/stripeService.js";
import { requireUser, requireCustomer } from "../middleware/auth.js";
import { ordersTableHasPayLater } from "../utils/ordersSchema.js";

const router = Router();

function badRequestIfInvalid(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
}

async function buildQuote(db, { items, deliveryMethod, deliveryAddress }) {
  const settingsResult = await db.request().query("SELECT TOP 1 * FROM Settings");
  const settings = settingsResult.recordset[0];
  let deliveryFee = 0;
  let distanceMiles = 0;

  if (deliveryMethod === "Dropoff" && deliveryAddress) {
    distanceMiles = await calculateDistanceMiles(deliveryAddress);
    deliveryFee = round2(distanceMiles * Number(settings.DeliveryPricePerMile));
  }

  const normalizedItems = [];
  for (const item of items || []) {
    const eq = await db.request()
      .input("id", sql.Int, Number(item.equipmentId))
      .query("SELECT Id, Name, PricePerRental, TotalQuantity FROM Equipment WHERE Id = @id AND IsActive = 1");
    const row = eq.recordset[0];
    if (!row) throw new Error(`Equipment not found: ${item.equipmentId}`);

    normalizedItems.push({
      equipmentId: row.Id,
      name: row.Name,
      unitPrice: Number(row.PricePerRental),
      quantity: Number(item.quantity),
      totalQuantity: Number(row.TotalQuantity)
    });
  }

  const totals = calculateTotals({
    items: normalizedItems,
    deliveryFee,
    taxRate: Number(settings.TaxRate)
  });

  return { items: normalizedItems, distanceMiles, deliveryFee, ...totals, settings };
}

router.get("/equipment", async (_req, res) => {
  const db = await getDb();
  const result = await db.request().query(`
    SELECT e.*, c.Name AS CategoryName,
      (SELECT TOP 1 ei.ImageUrl FROM EquipmentImages ei WHERE ei.EquipmentId = e.Id ORDER BY ei.SortOrder, ei.Id) AS PrimaryImageUrl
    FROM Equipment e
    LEFT JOIN Categories c ON e.CategoryId = c.Id
    WHERE e.IsActive = 1
    ORDER BY e.IsFeatured DESC, e.CreatedAt DESC
  `);
  res.json(result.recordset);
});

router.get("/equipment/:id", async (req, res) => {
  const db = await getDb();
  const equipment = await db.request()
    .input("id", sql.Int, Number(req.params.id))
    .query(`
      SELECT e.*,
        (SELECT TOP 1 ei.ImageUrl FROM EquipmentImages ei WHERE ei.EquipmentId = e.Id ORDER BY ei.SortOrder, ei.Id) AS PrimaryImageUrl
      FROM Equipment e
      WHERE e.Id = @id AND e.IsActive = 1
    `);

  if (!equipment.recordset[0]) return res.status(404).json({ message: "Not found" });
  res.json(equipment.recordset[0]);
});

router.post("/auth/register", [
  body("name").notEmpty(),
  body("password").isLength({ min: 4 }),
  body("email").custom((email, { req }) => {
    const e = String(email || "").trim();
    const p = String(req.body.phone || "").trim();
    if (!e && !p) throw new Error("Email or phone is required");
    return true;
  })
], async (req, res) => {
  if (badRequestIfInvalid(req, res)) return;
  const { name, email, phone, password } = req.body;
  const db = await getDb();
  const hash = await bcrypt.hash(password, 10);

  try {
    const result = await db.request()
      .input("name", sql.NVarChar, name)
      .input("email", sql.NVarChar, email ? String(email).trim() || null : null)
      .input("phone", sql.NVarChar, phone ? String(phone).trim() || null : null)
      .input("passwordHash", sql.NVarChar, hash)
      .query(`
      INSERT INTO Users (Name, Email, Phone, PasswordHash)
      OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.Email, INSERTED.Phone
      VALUES (@name, @email, @phone, @passwordHash)
    `);

    const user = result.recordset[0];
    const token = jwt.sign({ userId: user.Id, role: "customer" }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
    res.status(201).json({ token, user });
  } catch (err) {
    const msg = String(err.message || "");
    if (msg.includes("UNIQUE") || msg.includes("duplicate")) {
      return res.status(409).json({ message: "That email or phone is already registered. Try signing in instead." });
    }
    console.error(err);
    res.status(500).json({ message: "Could not create account" });
  }
});

function parseLoginIdentifier(body) {
  let email = body.email != null && String(body.email).trim() ? String(body.email).trim() : null;
  let phone = body.phone != null && String(body.phone).trim() ? String(body.phone).trim() : null;
  const login = body.login != null && String(body.login).trim() ? String(body.login).trim() : null;
  if (login) {
    if (login.includes("@")) {
      email = login;
      phone = null;
    } else {
      phone = login;
      email = null;
    }
  }
  return { email, phone };
}

router.post("/auth/login", async (req, res) => {
  const { password } = req.body;
  const { email, phone } = parseLoginIdentifier(req.body);
  if (!email && !phone) {
    return res.status(400).json({ message: "Enter your email or phone." });
  }
  const db = await getDb();
  const result = await db.request()
    .input("email", sql.NVarChar, email)
    .input("phone", sql.NVarChar, phone)
    .query("SELECT TOP 1 * FROM Users WHERE (Email = @email OR Phone = @phone) AND IsActive = 1");

  const user = result.recordset[0];
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const ok = await bcrypt.compare(password || "", user.PasswordHash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const token = jwt.sign({ userId: user.Id, role: "customer" }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
  res.json({ token, user: { id: user.Id, name: user.Name, email: user.Email, phone: user.Phone } });
});

router.post("/auth/forgot-password", async (req, res) => {
  const generic = { message: "If an account exists for that email or phone, reset instructions were sent when possible." };
  const contact = String(req.body.login || req.body.email || req.body.phone || "").trim();
  if (!contact) {
    return res.status(400).json({ message: "Enter your email or phone." });
  }

  const db = await getDb();
  let user = null;
  if (contact.includes("@")) {
    const r = await db.request()
      .input("email", sql.NVarChar, contact)
      .query("SELECT TOP 1 * FROM Users WHERE Email = @email AND IsActive = 1");
    user = r.recordset[0];
  } else {
    const r = await db.request()
      .input("phone", sql.NVarChar, contact)
      .query("SELECT TOP 1 * FROM Users WHERE Phone = @phone AND IsActive = 1");
    user = r.recordset[0];
  }

  if (!user || !user.Email) {
    return res.json(generic);
  }

  try {
    const resetToken = jwt.sign(
      { userId: user.Id, role: "customer", purpose: "password-reset" },
      env.jwtSecret,
      { expiresIn: "1h" }
    );
    const resetUrl = `${env.frontendUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(resetToken)}`;
    await sendPasswordResetEmail({ to: user.Email, resetUrl });
  } catch (err) {
    console.error("Forgot password email error", err);
  }

  res.json(generic);
});

router.post("/auth/reset-password", [
  body("token").notEmpty(),
  body("password").isLength({ min: 4 })
], async (req, res) => {
  if (badRequestIfInvalid(req, res)) return;
  const { token, password } = req.body;
  if (!token) return res.status(400).json({ message: "Reset token is required." });
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    return res.status(400).json({ message: "Invalid or expired reset link." });
  }
  if (payload.purpose !== "password-reset" || !payload.userId) {
    return res.status(400).json({ message: "Invalid reset token." });
  }

  const db = await getDb();
  const hash = await bcrypt.hash(password, 10);
  await db.request()
    .input("id", sql.Int, payload.userId)
    .input("hash", sql.NVarChar, hash)
    .query("UPDATE Users SET PasswordHash = @hash, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");

  res.json({ success: true, message: "Password updated. You can sign in now." });
});

router.post("/delivery/calculate", async (req, res) => {
  const db = await getDb();
  const settings = await db.request().query("SELECT TOP 1 * FROM Settings");
  const config = settings.recordset[0];
  const miles = await calculateDistanceMiles(req.body.address);
  const fee = round2(miles * Number(config.DeliveryPricePerMile));
  const exceedsMax = miles > Number(config.MaxDeliveryDistanceMiles);
  res.json({ miles, deliveryFee: fee, exceedsMax });
});

router.post("/cart/quote", async (req, res) => {
  const db = await getDb();
  try {
    const quote = await buildQuote(db, req.body);
    res.json(quote);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/orders", requireCustomer, async (req, res) => {
  try {
    const db = await getDb();
    const userId = req.user.userId;
    const {
      contactName,
      contactEmail,
      contactPhone,
      rentalDate,
      startTime,
      endTime,
      deliveryMethod,
      deliveryAddress,
      items,
      checkoutMode
    } = req.body;

    const payLater = String(checkoutMode || "").toLowerCase().replace(/-/g, "_") === "pay_later";
    const hasPayLaterCol = await ordersTableHasPayLater(db);

    const dateNorm = normalizeSqlDate(rentalDate);
    const startNorm = normalizeSqlTime(startTime);
    const endNorm = normalizeSqlTime(endTime);
    if (!dateNorm || !startNorm || !endNorm) {
      return res.status(400).json({ message: "Rental date, start time, and end time are required and must be valid." });
    }

    const quote = await buildQuote(db, { items, deliveryMethod, deliveryAddress });

    if (quote.distanceMiles > Number(quote.settings.MaxDeliveryDistanceMiles || 30)) {
      return res.status(400).json({ message: "Delivery address is outside service range" });
    }

    for (const item of quote.items) {
      const reserved = await db.request()
        .input("equipmentId", sql.Int, item.equipmentId)
        .input("rentalDate", sql.Date, dateNorm)
        .query(`
        SELECT ISNULL(SUM(oi.Quantity), 0) AS ReservedQty
        FROM OrderItems oi
        JOIN Orders o ON oi.OrderId = o.Id
        WHERE oi.EquipmentId = @equipmentId
          AND o.RentalDate = @rentalDate
          AND o.OrderStatus IN ('Pending', 'Paid', 'Confirmed', 'OutForDelivery', 'Completed')
      `);

      const reservedQty = Number(reserved.recordset[0]?.ReservedQty || 0);
      if (reservedQty + item.quantity > item.totalQuantity) {
        return res.status(409).json({
          message: `${item.name} has only ${Math.max(item.totalQuantity - reservedQty, 0)} left for selected date`
        });
      }
    }
    const orderNumber = `ORD-${Date.now()}`;

    const baseReq = db.request()
      .input("userId", sql.Int, userId)
      .input("orderNumber", sql.NVarChar, orderNumber)
      .input("rentalDate", sql.Date, dateNorm)
      .input("startTime", sql.NVarChar(16), startNorm)
      .input("endTime", sql.NVarChar(16), endNorm)
      .input("contactName", sql.NVarChar, contactName)
      .input("contactEmail", sql.NVarChar, contactEmail || null)
      .input("contactPhone", sql.NVarChar, contactPhone || null)
      .input("deliveryMethod", sql.NVarChar, deliveryMethod)
      .input("deliveryAddress", sql.NVarChar, deliveryAddress || null)
      .input("distance", sql.Decimal(10, 2), quote.distanceMiles || 0)
      .input("deliveryFee", sql.Decimal(10, 2), quote.deliveryFee || 0)
      .input("subtotal", sql.Decimal(10, 2), quote.subtotal)
      .input("tax", sql.Decimal(10, 2), quote.tax)
      .input("total", sql.Decimal(10, 2), quote.total);

    let insertedOrder;
    if (hasPayLaterCol) {
      insertedOrder = await baseReq.input("payLater", sql.Bit, payLater).query(`
      INSERT INTO Orders
      (UserId, OrderNumber, RentalDate, StartTime, EndTime, ContactName, ContactEmail, ContactPhone, DeliveryMethod, DeliveryAddress, DeliveryDistanceMiles, DeliveryFee, Subtotal, Tax, Total, PayLater)
      OUTPUT INSERTED.*
      VALUES
      (@userId, @orderNumber, @rentalDate, CAST(@startTime AS TIME), CAST(@endTime AS TIME), @contactName, @contactEmail, @contactPhone, @deliveryMethod, @deliveryAddress, @distance, @deliveryFee, @subtotal, @tax, @total, @payLater)
    `);
    } else {
      insertedOrder = await baseReq.query(`
      INSERT INTO Orders
      (UserId, OrderNumber, RentalDate, StartTime, EndTime, ContactName, ContactEmail, ContactPhone, DeliveryMethod, DeliveryAddress, DeliveryDistanceMiles, DeliveryFee, Subtotal, Tax, Total)
      OUTPUT INSERTED.*
      VALUES
      (@userId, @orderNumber, @rentalDate, CAST(@startTime AS TIME), CAST(@endTime AS TIME), @contactName, @contactEmail, @contactPhone, @deliveryMethod, @deliveryAddress, @distance, @deliveryFee, @subtotal, @tax, @total)
    `);
    }

    const order = insertedOrder.recordset[0];
    for (const item of quote.items) {
      await db.request()
        .input("orderId", sql.Int, order.Id)
        .input("equipmentId", sql.Int, item.equipmentId)
        .input("itemName", sql.NVarChar, item.name)
        .input("qty", sql.Int, item.quantity)
        .input("unitPrice", sql.Decimal(10, 2), item.unitPrice)
        .input("totalPrice", sql.Decimal(10, 2), round2(item.quantity * item.unitPrice))
        .query(`
        INSERT INTO OrderItems (OrderId, EquipmentId, ItemName, Quantity, UnitPrice, TotalPrice)
        VALUES (@orderId, @equipmentId, @itemName, @qty, @unitPrice, @totalPrice)
      `);
    }

    res.status(201).json({
      orderId: order.Id,
      orderNumber: order.OrderNumber,
      totals: quote,
      checkoutMode: payLater ? "pay_later" : "stripe",
      payLater: hasPayLaterCol ? payLater : false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Could not create order" });
  }
});

router.post("/payments/create-session", requireCustomer, async (req, res) => {
  const db = await getDb();
  const { orderId } = req.body;
  const orderResult = await db.request()
    .input("orderId", sql.Int, Number(orderId))
    .query("SELECT * FROM Orders WHERE Id = @orderId");
  const order = orderResult.recordset[0];
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (order.UserId != null && Number(order.UserId) !== Number(req.user.userId)) {
    return res.status(403).json({ message: "This order does not belong to your account." });
  }

  const session = await createCheckoutSession({
    orderId: order.Id,
    amount: Number(order.Total),
    customerEmail: order.ContactEmail
  });

  await db.request()
    .input("orderId", sql.Int, order.Id)
    .input("sessionId", sql.NVarChar, session.id)
    .query("UPDATE Orders SET StripeCheckoutSessionId = @sessionId WHERE Id = @orderId");

  res.json({ url: session.url });
});

router.get("/orders/:id", async (req, res) => {
  const db = await getDb();
  const orderResult = await db.request()
    .input("id", sql.Int, Number(req.params.id))
    .query("SELECT * FROM Orders WHERE Id = @id");
  const order = orderResult.recordset[0];
  if (!order) return res.status(404).json({ message: "Order not found" });

  const items = await db.request()
    .input("orderId", sql.Int, Number(req.params.id))
    .query("SELECT * FROM OrderItems WHERE OrderId = @orderId");

  res.json({ ...order, items: items.recordset });
});

router.get("/me/profile", requireUser, async (req, res) => {
  const db = await getDb();
  const user = await db.request().input("id", sql.Int, req.user.userId).query(`
    SELECT Id, Name, Email, Phone, IsActive, CreatedAt, UpdatedAt
    FROM Users WHERE Id = @id
  `);
  res.json(user.recordset[0]);
});

router.put("/me/profile", requireUser, async (req, res) => {
  const db = await getDb();
  const { name, email, phone } = req.body;
  await db.request()
    .input("id", sql.Int, req.user.userId)
    .input("name", sql.NVarChar, name)
    .input("email", sql.NVarChar, email || null)
    .input("phone", sql.NVarChar, phone || null)
    .query(`
      UPDATE Users
      SET Name = @name, Email = @email, Phone = @phone, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `);
  res.json({ success: true });
});

router.get("/me/orders", requireUser, async (req, res) => {
  const db = await getDb();
  const ordersResult = await db.request()
    .input("userId", sql.Int, req.user.userId)
    .query("SELECT * FROM Orders WHERE UserId = @userId ORDER BY CreatedAt DESC");
  const orders = ordersResult.recordset;
  for (const o of orders) {
    const itemsResult = await db.request()
      .input("orderId", sql.Int, o.Id)
      .query(`
        SELECT oi.Id, oi.EquipmentId, oi.ItemName, oi.Quantity, oi.UnitPrice, oi.TotalPrice,
          (SELECT TOP 1 ei.ImageUrl FROM EquipmentImages ei WHERE ei.EquipmentId = oi.EquipmentId ORDER BY ei.SortOrder, ei.Id) AS ImageUrl
        FROM OrderItems oi
        WHERE oi.OrderId = @orderId
        ORDER BY oi.Id
      `);
    o.items = itemsResult.recordset;
  }
  res.json(orders);
});

router.get("/me/invoices", requireUser, async (req, res) => {
  const db = await getDb();
  const inv = await db.request()
    .input("userId", sql.Int, req.user.userId)
    .query(`
      SELECT i.*, o.OrderNumber, o.RentalDate, o.StartTime, o.EndTime, o.DeliveryMethod, o.DeliveryAddress,
        o.DeliveryDistanceMiles, o.DeliveryFee, o.Subtotal, o.Tax, o.Total, o.PaymentStatus, o.OrderStatus,
        o.ContactName, o.ContactEmail, o.ContactPhone
      FROM Invoices i
      JOIN Orders o ON i.OrderId = o.Id
      WHERE o.UserId = @userId
      ORDER BY i.CreatedAt DESC
    `);
  const rows = inv.recordset;
  for (const row of rows) {
    const itemsResult = await db.request()
      .input("orderId", sql.Int, row.OrderId)
      .query(`
        SELECT oi.Id, oi.EquipmentId, oi.ItemName, oi.Quantity, oi.UnitPrice, oi.TotalPrice,
          (SELECT TOP 1 ei.ImageUrl FROM EquipmentImages ei WHERE ei.EquipmentId = oi.EquipmentId ORDER BY ei.SortOrder, ei.Id) AS ImageUrl
        FROM OrderItems oi
        WHERE oi.OrderId = @orderId
        ORDER BY oi.Id
      `);
    row.items = itemsResult.recordset;
  }
  res.json(rows);
});

router.get("/me/payment-methods", requireUser, async (req, res) => {
  const db = await getDb();
  const result = await db.request()
    .input("userId", sql.Int, req.user.userId)
    .query("SELECT * FROM CustomerPaymentMethods WHERE UserId = @userId ORDER BY IsDefault DESC, CreatedAt DESC");
  res.json(result.recordset);
});

router.post("/me/payment-methods/setup-intent", requireUser, async (req, res) => {
  const db = await getDb();
  const userResult = await db.request()
    .input("id", sql.Int, req.user.userId)
    .query("SELECT * FROM Users WHERE Id = @id");
  const user = userResult.recordset[0];

  let stripeCustomerId = user.StripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.Email || undefined,
      phone: user.Phone || undefined,
      name: user.Name
    });
    stripeCustomerId = customer.id;
    await db.request()
      .input("id", sql.Int, user.Id)
      .input("stripeCustomerId", sql.NVarChar, stripeCustomerId)
      .query("UPDATE Users SET StripeCustomerId = @stripeCustomerId WHERE Id = @id");
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: ["card"]
  });

  res.json({ clientSecret: setupIntent.client_secret, stripeCustomerId });
});

router.delete("/me/payment-methods/:id", requireUser, async (req, res) => {
  const db = await getDb();
  await db.request()
    .input("id", sql.Int, Number(req.params.id))
    .input("userId", sql.Int, req.user.userId)
    .query("DELETE FROM CustomerPaymentMethods WHERE Id = @id AND UserId = @userId");
  res.json({ success: true });
});

router.post("/orders/:id/cancel", requireUser, async (req, res) => {
  const db = await getDb();
  const id = Number(req.params.id);
  const orderResult = await db.request()
    .input("id", sql.Int, id)
    .input("userId", sql.Int, req.user.userId)
    .query("SELECT * FROM Orders WHERE Id = @id AND UserId = @userId");
  const order = orderResult.recordset[0];
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (!["Pending", "Paid", "Confirmed"].includes(order.OrderStatus)) {
    return res.status(400).json({ message: "Order cannot be cancelled in current state" });
  }

  await db.request()
    .input("id", sql.Int, id)
    .query("UPDATE Orders SET OrderStatus = 'Cancelled', UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
  res.json({ success: true });
});

router.post("/orders/:id/reorder", requireUser, async (req, res) => {
  const db = await getDb();
  const id = Number(req.params.id);
  const items = await db.request().input("id", sql.Int, id).query("SELECT EquipmentId AS equipmentId, Quantity AS quantity FROM OrderItems WHERE OrderId = @id");
  res.json({ items: items.recordset });
});

export default router;
