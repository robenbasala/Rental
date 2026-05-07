import { Router } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { getDb, sql } from "../config/db.js";
import { env } from "../config/env.js";
import { sendPasswordResetEmail } from "../services/emailService.js";
import { autocompleteUsAddresses, calculateDistanceMiles } from "../services/mapsService.js";
import { computeDropoffDeliveryFee } from "../utils/pricing.js";
import { createCheckoutSession, stripe } from "../services/stripeService.js";
import { requireUser, requireCustomer } from "../middleware/auth.js";
import { ordersTableHasPayLater } from "../utils/ordersSchema.js";
import { buildQuote } from "../services/quoteService.js";
import { validateOrderRequest } from "../services/orderValidation.js";
import { insertOrderWithItems } from "../services/orderInsert.js";
import { ensureCheckoutDraftsTable } from "../db/ensureCheckoutDrafts.js";
import { handleCheckoutSessionCompleted } from "../services/stripeCheckoutComplete.js";

const router = Router();
const googleAuthClient = new OAuth2Client();

async function getOrderReceiptPayload(db, orderId) {
  const id = Number(orderId);
  if (!Number.isFinite(id) || id < 1) return null;

  const orderResult = await db.request().input("id", sql.Int, id).query("SELECT * FROM Orders WHERE Id = @id");
  const order = orderResult.recordset[0];
  if (!order) return null;

  const invResult = await db.request().input("orderId", sql.Int, id).query(`
    SELECT TOP 1 InvoiceNumber FROM Invoices WHERE OrderId = @orderId ORDER BY Id DESC
  `);
  const invoiceNumber = invResult.recordset[0]?.InvoiceNumber || null;

  const itemsResult = await db.request().input("orderId", sql.Int, id).query(`
    SELECT oi.Id, oi.EquipmentId, oi.PackageId, oi.ItemName, oi.Quantity, oi.UnitPrice, oi.TotalPrice,
      (SELECT TOP 1 ei.ImageUrl FROM EquipmentImages ei
       WHERE ei.EquipmentId = oi.EquipmentId ORDER BY ei.SortOrder, ei.Id) AS ImageUrl
    FROM OrderItems oi
    WHERE oi.OrderId = @orderId
    ORDER BY oi.Id
  `);

  return {
    ...order,
    InvoiceNumber: invoiceNumber,
    items: itemsResult.recordset
  };
}

function badRequestIfInvalid(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
}

/**
 * Fetches a remote image server-side so the receipt PDF (html2canvas) can paint it without browser CORS tainting.
 * SSRF: only http(s), blocks obvious internal hosts.
 */
router.get("/media/image", async (req, res) => {
  const raw = String(req.query.url || "").trim();
  if (raw.length > 2048 || (!raw.startsWith("http://") && !raw.startsWith("https://"))) {
    return res.status(400).send("Bad url");
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return res.status(400).send("Bad url");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return res.status(400).send("Bad url");
  }
  const host = parsed.hostname.toLowerCase();
  const isPrivateLan =
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host);
  if (isPrivateLan || host === "0.0.0.0") {
    return res.status(403).send("Forbidden");
  }
  if (
    env.nodeEnv === "production" &&
    (host === "localhost" || host.endsWith(".localhost") || /^127\./.test(host))
  ) {
    return res.status(403).send("Forbidden");
  }

  try {
    const upstream = await fetch(raw, {
      redirect: "follow",
      headers: { Accept: "image/*,*/*" }
    });
    if (!upstream.ok) {
      return res.status(502).send("Bad upstream");
    }
    const ct = upstream.headers.get("content-type") || "";
    if (!ct.toLowerCase().startsWith("image/")) {
      return res.status(400).send("Not an image");
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) {
      return res.status(413).send("Too large");
    }
    res.setHeader("Content-Type", ct.split(";")[0].trim());
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.send(buf);
  } catch (err) {
    console.error("media/image proxy", err);
    res.status(502).send("Fetch failed");
  }
});

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

router.get("/packages", async (_req, res, next) => {
  try {
    const db = await getDb();
    const result = await db.request().query(`
      SELECT Id, Name, SummaryLine, Price, SortOrder
      FROM RentalPackages
      WHERE IsActive = 1
      ORDER BY SortOrder ASC, Id ASC
    `);
    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
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
      OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.Email, INSERTED.Phone, INSERTED.IsAdmin
      VALUES (@name, @email, @phone, @passwordHash)
    `);

    const user = result.recordset[0];
    const isAdmin = !!user.IsAdmin;
    const token = jwt.sign(
      { userId: user.Id, role: "customer", isAdmin },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );
    res.status(201).json({
      token,
      user: { id: user.Id, name: user.Name, email: user.Email, phone: user.Phone, isAdmin }
    });
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

  const isAdmin = !!user.IsAdmin;
  const token = jwt.sign(
    { userId: user.Id, role: "customer", isAdmin },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
  res.json({
    token,
    user: { id: user.Id, name: user.Name, email: user.Email, phone: user.Phone, isAdmin }
  });
});

router.post("/auth/google", [
  body("idToken").notEmpty().withMessage("Google credential is required")
], async (req, res) => {
  if (badRequestIfInvalid(req, res)) return;
  if (!env.googleClientId) {
    return res.status(500).json({ message: "Google login is not configured on server." });
  }

  const audiences = String(env.googleClientId)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const ticket = await googleAuthClient.verifyIdToken({
      idToken: String(req.body.idToken),
      audience: audiences
    });
    const payload = ticket.getPayload();
    const email = String(payload?.email || "").trim().toLowerCase();
    const emailVerified = !!payload?.email_verified;
    if (!email || !emailVerified) {
      return res.status(400).json({ message: "Google account email is not verified." });
    }

    const displayName = String(payload?.name || payload?.given_name || email.split("@")[0]).trim();
    const db = await getDb();
    const existing = await db.request()
      .input("email", sql.NVarChar, email)
      .query("SELECT TOP 1 * FROM Users WHERE Email = @email");
    let user = existing.recordset[0];

    if (user && !user.IsActive) {
      return res.status(403).json({ message: "This account is inactive." });
    }

    if (!user) {
      const generatedPassword = randomUUID();
      const hash = await bcrypt.hash(generatedPassword, 10);
      const inserted = await db.request()
        .input("name", sql.NVarChar, displayName || "Google User")
        .input("email", sql.NVarChar, email)
        .input("passwordHash", sql.NVarChar, hash)
        .query(`
          INSERT INTO Users (Name, Email, Phone, PasswordHash, IsActive)
          OUTPUT INSERTED.*
          VALUES (@name, @email, NULL, @passwordHash, 1)
        `);
      user = inserted.recordset[0];
    } else if (!String(user.Name || "").trim() && displayName) {
      await db.request()
        .input("id", sql.Int, user.Id)
        .input("name", sql.NVarChar, displayName)
        .query("UPDATE Users SET Name = @name, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
      user.Name = displayName;
    }

    const isAdmin = !!user.IsAdmin;
    const token = jwt.sign(
      { userId: user.Id, role: "customer", isAdmin },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    res.json({
      token,
      user: {
        id: user.Id,
        name: user.Name,
        email: user.Email,
        phone: user.Phone,
        isAdmin
      }
    });
  } catch (err) {
    console.error("Google auth error", err);
    res.status(401).json({ message: "Google sign-in failed. Please try again." });
  }
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
  try {
    const db = await getDb();
    const settings = await db.request().query("SELECT TOP 1 * FROM Settings");
    const config = settings.recordset[0];
    const miles = await calculateDistanceMiles(req.body.address);
    const fee = computeDropoffDeliveryFee(miles, config);
    const exceedsMax = miles > Number(config.MaxDeliveryDistanceMiles);
    res.json({ miles, deliveryFee: fee, exceedsMax });
  } catch (error) {
    console.error("Delivery calculate error", error);
    res.status(400).json({ message: error.message || "Could not calculate delivery distance" });
  }
});

router.get("/addresses/autocomplete", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q || q.length < 3) {
      return res.json({ suggestions: [] });
    }
    const suggestions = await autocompleteUsAddresses(q);
    res.json({ suggestions });
  } catch (error) {
    console.error("Address autocomplete error", error);
    res.status(400).json({ message: error.message || "Could not fetch address suggestions" });
  }
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
    const mode = String(req.body.checkoutMode || "").toLowerCase().replace(/-/g, "_");
    if (mode === "stripe") {
      return res.status(400).json({
        message:
          "Card payment only completes after checkout. Use Pay Now — your order is created when payment succeeds."
      });
    }

    const payLater = mode === "pay_later";
    const hasPayLaterCol = await ordersTableHasPayLater(db);

    const validated = await validateOrderRequest(db, req.body);
    const order = await insertOrderWithItems(db, userId, validated, {
      payLater,
      stripeCheckoutSessionId: null
    });

    res.status(201).json({
      orderId: order.Id,
      orderNumber: order.OrderNumber,
      totals: validated.quote,
      checkoutMode: payLater ? "pay_later" : "stripe",
      payLater: hasPayLaterCol ? payLater : false
    });
  } catch (err) {
    console.error(err);
    const msg = err.message || "Could not create order";
    let status = 500;
    if (msg.includes("left for selected")) status = 409;
    else if (
      msg.includes("required") ||
      msg.includes("valid") ||
      msg.includes("outside") ||
      msg.includes("email") ||
      msg.includes("phone") ||
      msg.includes("PackageId") ||
      msg.includes("quantity") ||
      msg.includes("Enter an email")
    ) {
      status = 400;
    }
    res.status(status).json({ message: msg });
  }
});

router.post("/payments/prepare-checkout", requireCustomer, async (req, res) => {
  try {
    const db = await getDb();
    await ensureCheckoutDraftsTable(db);
    const userId = req.user.userId;

    const validated = await validateOrderRequest(db, req.body);
    const draftId = randomUUID();

    await db.request()
      .input("id", sql.UniqueIdentifier, draftId)
      .input("userId", sql.Int, userId)
      .input("payload", sql.NVarChar(sql.MAX), JSON.stringify(req.body))
      .input("expiresAt", sql.DateTime2, new Date(Date.now() + 60 * 60 * 1000))
      .query(`
        INSERT INTO CheckoutDrafts (Id, UserId, Payload, ExpiresAt)
        VALUES (@id, @userId, @payload, @expiresAt)
      `);

    const session = await createCheckoutSession({
      draftId,
      userId,
      amount: Number(validated.quote.total),
      customerEmail: validated.contactEmail || undefined
    });

    res.json({ url: session.url, draftId });
  } catch (err) {
    console.error(err);
    const msg = err.message || "Could not start checkout";
    let status = 500;
    if (msg.includes("left for selected")) status = 409;
    else if (
      msg.includes("required") ||
      msg.includes("valid") ||
      msg.includes("outside") ||
      msg.includes("email") ||
      msg.includes("phone") ||
      msg.includes("PackageId") ||
      msg.includes("quantity") ||
      msg.includes("Enter an email")
    ) {
      status = 400;
    }
    res.status(status).json({ message: msg });
  }
});

router.delete("/payments/checkout-draft/:id", requireCustomer, async (req, res) => {
  try {
    const db = await getDb();
    await ensureCheckoutDraftsTable(db);
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "draft id required" });
    await db.request()
      .input("id", sql.UniqueIdentifier, id)
      .input("userId", sql.Int, req.user.userId)
      .query(`
        DELETE FROM CheckoutDrafts
        WHERE Id = @id AND UserId = @userId AND ConsumedAt IS NULL
      `);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message || "Could not remove checkout draft" });
  }
});

router.post("/payments/verify-session", async (req, res, next) => {
  try {
    const sessionId = String(req.body.sessionId || "").trim();
    if (!sessionId) {
      return res.status(400).json({ message: "sessionId is required" });
    }
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment not completed yet." });
    }

    const db = await getDb();
    let orderRow = await db.request()
      .input("sid", sql.NVarChar, session.id)
      .query(`SELECT TOP 1 Id FROM Orders WHERE StripeCheckoutSessionId = @sid`);

    if (!orderRow.recordset[0]) {
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 400));
        orderRow = await db.request()
          .input("sid", sql.NVarChar, session.id)
          .query(`SELECT TOP 1 Id FROM Orders WHERE StripeCheckoutSessionId = @sid`);
        if (orderRow.recordset[0]) break;
      }
    }

    /** If webhook never reached this server (common in local dev), create the order now — idempotent with webhook. */
    if (!orderRow.recordset[0]) {
      try {
        await handleCheckoutSessionCompleted(session);
      } catch (syncErr) {
        console.error("verify-session: handleCheckoutSessionCompleted fallback failed", syncErr);
      }
      orderRow = await db.request()
        .input("sid", sql.NVarChar, session.id)
        .query(`SELECT TOP 1 Id FROM Orders WHERE StripeCheckoutSessionId = @sid`);
      if (!orderRow.recordset[0]) {
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 300));
          orderRow = await db.request()
            .input("sid", sql.NVarChar, session.id)
            .query(`SELECT TOP 1 Id FROM Orders WHERE StripeCheckoutSessionId = @sid`);
          if (orderRow.recordset[0]) break;
        }
      }
    }

    if (!orderRow.recordset[0]) {
      return res.status(503).json({
        message:
          "Payment succeeded but the order is not in our system yet. Check that the Stripe webhook reaches this API (e.g. stripe listen for local dev), or wait a moment and refresh."
      });
    }

    const payload = await getOrderReceiptPayload(db, orderRow.recordset[0].Id);
    if (!payload) return res.status(404).json({ message: "Order not found" });
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.get("/orders/:id", async (req, res) => {
  try {
    const db = await getDb();
    const payload = await getOrderReceiptPayload(db, Number(req.params.id));
    if (!payload) return res.status(404).json({ message: "Order not found" });
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not load order" });
  }
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
