import { sql } from "../config/db.js";
import { round2 } from "../utils/pricing.js";
import { orderItemsTableHasPackageId, ordersTableHasPayLater } from "../utils/ordersSchema.js";

/**
 * Persists order + line items. Used after payment (Stripe) or for pay-later.
 */
export async function insertOrderWithItems(db, userId, validated, options) {
  const {
    quote,
    dateNorm,
    startNorm,
    endNorm,
    contactName,
    contactEmail,
    contactPhone,
    deliveryMethod,
    deliveryAddress
  } = validated;

  const { payLater, stripeCheckoutSessionId } = options;

  const hasPayLaterCol = await ordersTableHasPayLater(db);
  const hasPackageColumn = await orderItemsTableHasPackageId(db);

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
    .input("total", sql.Decimal(10, 2), quote.total)
    .input("stripeSessionId", sql.NVarChar, stripeCheckoutSessionId || null);

  let insertedOrder;
  if (hasPayLaterCol) {
    insertedOrder = await baseReq.input("payLater", sql.Bit, payLater).query(`
      INSERT INTO Orders
      (UserId, OrderNumber, RentalDate, StartTime, EndTime, ContactName, ContactEmail, ContactPhone, DeliveryMethod, DeliveryAddress, DeliveryDistanceMiles, DeliveryFee, Subtotal, Tax, Total, PayLater, StripeCheckoutSessionId)
      OUTPUT INSERTED.*
      VALUES
      (@userId, @orderNumber, @rentalDate, CAST(@startTime AS TIME), CAST(@endTime AS TIME), @contactName, @contactEmail, @contactPhone, @deliveryMethod, @deliveryAddress, @distance, @deliveryFee, @subtotal, @tax, @total, @payLater, @stripeSessionId)
    `);
  } else {
    insertedOrder = await baseReq.query(`
      INSERT INTO Orders
      (UserId, OrderNumber, RentalDate, StartTime, EndTime, ContactName, ContactEmail, ContactPhone, DeliveryMethod, DeliveryAddress, DeliveryDistanceMiles, DeliveryFee, Subtotal, Tax, Total, StripeCheckoutSessionId)
      OUTPUT INSERTED.*
      VALUES
      (@userId, @orderNumber, @rentalDate, CAST(@startTime AS TIME), CAST(@endTime AS TIME), @contactName, @contactEmail, @contactPhone, @deliveryMethod, @deliveryAddress, @distance, @deliveryFee, @subtotal, @tax, @total, @stripeSessionId)
    `);
  }

  const order = insertedOrder.recordset[0];

  for (const item of quote.items) {
    const req = db.request()
      .input("orderId", sql.Int, order.Id)
      .input("equipmentId", sql.Int, item.equipmentId ?? null)
      .input("itemName", sql.NVarChar, item.name)
      .input("qty", sql.Int, item.quantity)
      .input("unitPrice", sql.Decimal(10, 2), item.unitPrice)
      .input("totalPrice", sql.Decimal(10, 2), round2(item.quantity * item.unitPrice));

    if (hasPackageColumn) {
      await req
        .input("packageId", sql.Int, item.packageId ?? null)
        .query(`
          INSERT INTO OrderItems (OrderId, EquipmentId, PackageId, ItemName, Quantity, UnitPrice, TotalPrice)
          VALUES (@orderId, @equipmentId, @packageId, @itemName, @qty, @unitPrice, @totalPrice)
        `);
    } else {
      await req.query(`
        INSERT INTO OrderItems (OrderId, EquipmentId, ItemName, Quantity, UnitPrice, TotalPrice)
        VALUES (@orderId, @equipmentId, @itemName, @qty, @unitPrice, @totalPrice)
      `);
    }
  }

  return order;
}
