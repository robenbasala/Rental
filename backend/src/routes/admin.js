import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb, sql } from "../config/db.js";
import { env } from "../config/env.js";
import { requireAdmin } from "../middleware/auth.js";
import { finalizeOrderPaid } from "../services/orderFulfillment.js";
import { ordersTableHasPayLater } from "../utils/ordersSchema.js";

const router = Router();

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const db = await getDb();
    const result = await db.request()
      .input("email", sql.NVarChar, String(email || "").trim())
      .query("SELECT TOP 1 * FROM AdminUsers WHERE Email = @email AND IsActive = 1");
    const admin = result.recordset[0];
    if (!admin) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password || "", admin.PasswordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ adminId: admin.Id, role: "admin" }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
    res.json({ token, admin: { id: admin.Id, name: admin.Name, email: admin.Email } });
  } catch (err) {
    next(err);
  }
});

router.use(requireAdmin);

router.get("/dashboard", async (_req, res) => {
  const db = await getDb();
  const [orders, revenue, upcoming, lowInventory] = await Promise.all([
    db.request().query("SELECT COUNT(*) AS TotalOrders FROM Orders"),
    db.request().query("SELECT ISNULL(SUM(Total),0) AS Revenue FROM Orders WHERE PaymentStatus = 'Paid'"),
    db.request().query("SELECT TOP 10 * FROM Orders WHERE RentalDate >= CAST(GETDATE() AS DATE) ORDER BY RentalDate ASC"),
    db.request().query("SELECT TOP 10 * FROM Equipment WHERE TotalQuantity <= 2 ORDER BY TotalQuantity ASC")
  ]);

  res.json({
    totalOrders: orders.recordset[0].TotalOrders,
    revenue: revenue.recordset[0].Revenue,
    upcomingBookings: upcoming.recordset,
    lowInventoryAlerts: lowInventory.recordset
  });
});

router.get("/equipment", async (_req, res) => {
  const db = await getDb();
  const result = await db.request().query(`
    SELECT e.*,
      (SELECT TOP 1 ei.ImageUrl FROM EquipmentImages ei WHERE ei.EquipmentId = e.Id ORDER BY ei.SortOrder, ei.Id) AS PrimaryImageUrl
    FROM Equipment e
    ORDER BY e.CreatedAt DESC
  `);
  res.json(result.recordset);
});

router.post("/equipment", async (req, res) => {
  const db = await getDb();
  const { categoryId, name, slug, description, pricePerRental, totalQuantity, isActive, isFeatured, imageUrl } = req.body;
  const result = await db.request()
    .input("categoryId", sql.Int, categoryId || null)
    .input("name", sql.NVarChar, name)
    .input("slug", sql.NVarChar, slug)
    .input("description", sql.NVarChar, description || null)
    .input("pricePerRental", sql.Decimal(10, 2), pricePerRental)
    .input("totalQuantity", sql.Int, totalQuantity)
    .input("isActive", sql.Bit, isActive ?? true)
    .input("isFeatured", sql.Bit, isFeatured ?? false)
    .query(`
      INSERT INTO Equipment (CategoryId, Name, Slug, Description, PricePerRental, TotalQuantity, IsActive, IsFeatured)
      OUTPUT INSERTED.*
      VALUES (@categoryId, @name, @slug, @description, @pricePerRental, @totalQuantity, @isActive, @isFeatured)
    `);
  const inserted = result.recordset[0];
  if (imageUrl && String(imageUrl).trim()) {
    await db.request()
      .input("equipmentId", sql.Int, inserted.Id)
      .input("imageUrl", sql.NVarChar, String(imageUrl).trim())
      .query(`
        INSERT INTO EquipmentImages (EquipmentId, ImageUrl, SortOrder)
        VALUES (@equipmentId, @imageUrl, 0)
      `);
  }
  res.status(201).json({ ...inserted, PrimaryImageUrl: imageUrl || null });
});

router.put("/equipment/:id", async (req, res) => {
  const db = await getDb();
  const id = Number(req.params.id);
  const { categoryId, name, slug, description, pricePerRental, totalQuantity, isActive, isFeatured, imageUrl } = req.body;
  await db.request()
    .input("id", sql.Int, id)
    .input("categoryId", sql.Int, categoryId || null)
    .input("name", sql.NVarChar, name)
    .input("slug", sql.NVarChar, slug)
    .input("description", sql.NVarChar, description || null)
    .input("pricePerRental", sql.Decimal(10, 2), pricePerRental)
    .input("totalQuantity", sql.Int, totalQuantity)
    .input("isActive", sql.Bit, isActive ?? true)
    .input("isFeatured", sql.Bit, isFeatured ?? false)
    .query(`
      UPDATE Equipment
      SET CategoryId = @categoryId, Name = @name, Slug = @slug, Description = @description, PricePerRental = @pricePerRental,
          TotalQuantity = @totalQuantity, IsActive = @isActive, IsFeatured = @isFeatured, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `);
  if (imageUrl !== undefined) {
    await db.request().input("equipmentId", sql.Int, id).query("DELETE FROM EquipmentImages WHERE EquipmentId = @equipmentId");
    if (String(imageUrl || "").trim()) {
      await db.request()
        .input("equipmentId", sql.Int, id)
        .input("imageUrl", sql.NVarChar, String(imageUrl).trim())
        .query(`
          INSERT INTO EquipmentImages (EquipmentId, ImageUrl, SortOrder)
          VALUES (@equipmentId, @imageUrl, 0)
        `);
    }
  }
  res.json({ success: true });
});

router.delete("/equipment/:id", async (req, res) => {
  const db = await getDb();
  await db.request().input("id", sql.Int, Number(req.params.id)).query("DELETE FROM Equipment WHERE Id = @id");
  res.json({ success: true });
});

router.get("/categories", async (_req, res) => {
  const db = await getDb();
  const result = await db.request().query("SELECT * FROM Categories ORDER BY Name ASC");
  res.json(result.recordset);
});

router.post("/categories", async (req, res) => {
  const db = await getDb();
  const { name, slug, isActive } = req.body;
  const result = await db.request()
    .input("name", sql.NVarChar, name)
    .input("slug", sql.NVarChar, slug)
    .input("isActive", sql.Bit, isActive ?? true)
    .query(`
      INSERT INTO Categories (Name, Slug, IsActive)
      OUTPUT INSERTED.*
      VALUES (@name, @slug, @isActive)
    `);
  res.status(201).json(result.recordset[0]);
});

router.put("/categories/:id", async (req, res) => {
  const db = await getDb();
  const { name, slug, isActive } = req.body;
  await db.request()
    .input("id", sql.Int, Number(req.params.id))
    .input("name", sql.NVarChar, name)
    .input("slug", sql.NVarChar, slug)
    .input("isActive", sql.Bit, isActive ?? true)
    .query("UPDATE Categories SET Name = @name, Slug = @slug, IsActive = @isActive, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
  res.json({ success: true });
});

router.delete("/categories/:id", async (req, res) => {
  const db = await getDb();
  await db.request().input("id", sql.Int, Number(req.params.id)).query("DELETE FROM Categories WHERE Id = @id");
  res.json({ success: true });
});

router.get("/orders", async (req, res) => {
  const db = await getDb();
  const { status, date } = req.query;
  let query = "SELECT * FROM Orders WHERE 1=1";
  if (status) query += " AND OrderStatus = @status";
  if (date) query += " AND RentalDate = @date";
  query += " ORDER BY CreatedAt DESC";

  const request = db.request();
  if (status) request.input("status", sql.NVarChar, status);
  if (date) request.input("date", sql.Date, date);
  const result = await request.query(query);
  res.json(result.recordset);
});

router.patch("/orders/:id/status", async (req, res) => {
  const db = await getDb();
  const { status } = req.body;
  const id = Number(req.params.id);

  const current = await db.request().input("id", sql.Int, id).query("SELECT OrderStatus FROM Orders WHERE Id = @id");
  const previousStatus = current.recordset[0]?.OrderStatus || null;

  await db.request()
    .input("id", sql.Int, id)
    .input("status", sql.NVarChar, status)
    .query("UPDATE Orders SET OrderStatus = @status, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");

  await db.request()
    .input("orderId", sql.Int, id)
    .input("previousStatus", sql.NVarChar, previousStatus)
    .input("newStatus", sql.NVarChar, status)
    .input("changedByType", sql.NVarChar, "admin")
    .input("changedById", sql.Int, req.admin.adminId)
    .query(`
      INSERT INTO OrderStatusHistory (OrderId, PreviousStatus, NewStatus, ChangedByType, ChangedById)
      VALUES (@orderId, @previousStatus, @newStatus, @changedByType, @changedById)
    `);

  res.json({ success: true });
});

router.get("/receivables", async (req, res) => {
  const db = await getDb();
  const payLaterOnly = String(req.query.payLaterOnly || "") === "1";
  const hasPayLaterCol = await ordersTableHasPayLater(db);
  let q = `
    SELECT *
    FROM Orders
    WHERE PaymentStatus = 'Pending'
      AND OrderStatus <> 'Cancelled'
  `;
  if (payLaterOnly && hasPayLaterCol) {
    q += " AND PayLater = 1";
  }
  q += " ORDER BY CreatedAt DESC";
  const result = await db.request().query(q);
  res.json(result.recordset);
});

router.post("/orders/:id/confirm-payment", async (req, res, next) => {
  try {
    const db = await getDb();
    const id = Number(req.params.id);
    const ref = req.body?.reference || `manual-${req.admin.adminId}-${Date.now()}`;
    const raw = JSON.stringify({
      source: "admin_confirm",
      adminId: req.admin.adminId,
      note: req.body?.note || "",
      reference: ref
    });
    const result = await finalizeOrderPaid(db, {
      orderId: id,
      provider: "Manual",
      providerPaymentId: ref,
      currency: env.stripeCurrency || "usd",
      rawResponse: raw
    });
    if (result.skipped) {
      return res.status(400).json({ message: "Order is already paid" });
    }
    res.json({ success: true, invoiceNumber: result.invoiceNumber });
  } catch (err) {
    next(err);
  }
});

router.get("/settings", async (_req, res) => {
  const db = await getDb();
  const result = await db.request().query("SELECT TOP 1 * FROM Settings");
  res.json(result.recordset[0]);
});

router.put("/settings", async (req, res) => {
  const db = await getDb();
  const { deliveryPricePerMile, maxDeliveryDistanceMiles, businessAddress, taxRate, companyName, supportEmail, supportPhone } = req.body;
  await db.request()
    .input("deliveryPricePerMile", sql.Decimal(10, 2), deliveryPricePerMile)
    .input("maxDeliveryDistanceMiles", sql.Decimal(10, 2), maxDeliveryDistanceMiles)
    .input("businessAddress", sql.NVarChar, businessAddress)
    .input("taxRate", sql.Decimal(5, 4), taxRate)
    .input("companyName", sql.NVarChar, companyName)
    .input("supportEmail", sql.NVarChar, supportEmail || null)
    .input("supportPhone", sql.NVarChar, supportPhone || null)
    .query(`
      UPDATE Settings
      SET DeliveryPricePerMile = @deliveryPricePerMile, MaxDeliveryDistanceMiles = @maxDeliveryDistanceMiles,
          BusinessAddress = @businessAddress, TaxRate = @taxRate, CompanyName = @companyName,
          SupportEmail = @supportEmail, SupportPhone = @supportPhone, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = 1
    `);
  res.json({ success: true });
});

router.get("/customers", async (req, res) => {
  const db = await getDb();
  const q = req.query.q ? `%${req.query.q}%` : null;
  const result = await db.request()
    .input("q", sql.NVarChar, q)
    .query(`
      SELECT *
      FROM Users
      WHERE @q IS NULL OR Name LIKE @q OR Email LIKE @q OR Phone LIKE @q
      ORDER BY CreatedAt DESC
    `);
  res.json(result.recordset);
});

router.get("/customers/:id", async (req, res) => {
  const db = await getDb();
  const id = Number(req.params.id);
  const [user, orders, invoices, notes] = await Promise.all([
    db.request().input("id", sql.Int, id).query("SELECT * FROM Users WHERE Id = @id"),
    db.request().input("id", sql.Int, id).query("SELECT * FROM Orders WHERE UserId = @id ORDER BY CreatedAt DESC"),
    db.request().input("id", sql.Int, id).query(`
      SELECT i.*, o.OrderNumber
      FROM Invoices i
      JOIN Orders o ON i.OrderId = o.Id
      WHERE o.UserId = @id
      ORDER BY i.CreatedAt DESC
    `),
    db.request().input("id", sql.Int, id).query("SELECT * FROM AdminNotes WHERE UserId = @id ORDER BY CreatedAt DESC")
  ]);

  res.json({
    profile: user.recordset[0],
    orders: orders.recordset,
    invoices: invoices.recordset,
    notes: notes.recordset
  });
});

router.post("/customers/:id/notes", async (req, res) => {
  const db = await getDb();
  const result = await db.request()
    .input("userId", sql.Int, Number(req.params.id))
    .input("adminUserId", sql.Int, req.admin.adminId)
    .input("note", sql.NVarChar, req.body.note)
    .query(`
      INSERT INTO AdminNotes (UserId, AdminUserId, Note)
      OUTPUT INSERTED.*
      VALUES (@userId, @adminUserId, @note)
    `);
  res.status(201).json(result.recordset[0]);
});

export default router;
