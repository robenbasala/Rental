import { sql } from "../config/db.js";
import { env } from "../config/env.js";
import { sendInvoiceEmail } from "./emailService.js";

/**
 * Marks order paid, records payment, creates invoice, sends email (idempotent if already Paid).
 */
export async function finalizeOrderPaid(db, { orderId, provider, providerPaymentId, currency, rawResponse }) {
  const orderResult = await db.request().input("id", sql.Int, orderId).query("SELECT * FROM Orders WHERE Id = @id");
  const order = orderResult.recordset[0];
  if (!order) throw new Error("Order not found");
  if (order.PaymentStatus === "Paid") {
    return { skipped: true, order };
  }
  if (order.OrderStatus === "Cancelled") {
    throw new Error("Cannot confirm payment for a cancelled order");
  }

  const amount = Number(order.Total);

  await db.request()
    .input("id", sql.Int, orderId)
    .query("UPDATE Orders SET PaymentStatus = 'Paid', OrderStatus = 'Confirmed', UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");

  await db.request()
    .input("orderId", sql.Int, orderId)
    .input("providerPaymentId", sql.NVarChar, providerPaymentId || null)
    .input("amount", sql.Decimal(10, 2), amount)
    .input("currency", sql.NVarChar, currency || env.stripeCurrency || "usd")
    .input("provider", sql.NVarChar, provider)
    .input("rawResponse", sql.NVarChar, rawResponse != null ? String(rawResponse).slice(0, 500000) : null)
    .query(`
      INSERT INTO Payments (OrderId, Provider, ProviderPaymentId, Amount, Currency, Status, RawResponse)
      VALUES (@orderId, @provider, @providerPaymentId, @amount, @currency, 'Paid', @rawResponse)
    `);

  const invoiceNumber = `INV-${String(orderId).padStart(6, "0")}`;
  await db.request()
    .input("orderId", sql.Int, orderId)
    .input("invoiceNumber", sql.NVarChar, invoiceNumber)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM Invoices WHERE OrderId = @orderId)
      INSERT INTO Invoices (OrderId, InvoiceNumber, SentAt) VALUES (@orderId, @invoiceNumber, SYSUTCDATETIME())
    `);

  await sendInvoiceEmail({
    to: order.ContactEmail,
    subject: `Invoice ${invoiceNumber}`,
    html: `<h2>Thanks — payment received</h2><p>Invoice: ${invoiceNumber}</p><p>Order: ${order.OrderNumber}</p><p>Total: $${order.Total}</p>`
  });

  return { skipped: false, order, invoiceNumber };
}
