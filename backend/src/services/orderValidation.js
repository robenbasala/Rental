import { sql } from "../config/db.js";
import { orderItemsTableHasPackageId } from "../utils/ordersSchema.js";
import { normalizeSqlDate, normalizeSqlTime } from "../utils/sqlDateTime.js";
import { buildQuote } from "./quoteService.js";

/**
 * Validates cart/checkout body and returns quote + normalized date/time.
 * Used for pay-later orders and Stripe prepare-checkout.
 */
export async function validateOrderRequest(db, body) {
  const {
    contactName,
    contactEmail,
    contactPhone,
    rentalDate,
    startTime,
    endTime,
    deliveryMethod,
    deliveryAddress,
    items
  } = body;

  if (!String(contactName || "").trim()) {
    throw new Error("Full name is required.");
  }
  const em = String(contactEmail || "").trim();
  const ph = String(contactPhone || "").trim();
  if (!em && !ph) throw new Error("Enter an email or a phone number.");

  const dateNorm = normalizeSqlDate(rentalDate);
  const startNorm = normalizeSqlTime(startTime);
  const endNorm = normalizeSqlTime(endTime);
  if (!dateNorm || !startNorm || !endNorm) {
    throw new Error("Rental date, start time, and end time are required and must be valid.");
  }

  const quote = await buildQuote(db, { items, deliveryMethod, deliveryAddress });
  const hasPackageItems = quote.items.some((item) => item.itemType === "Package");
  const hasPackageColumn = await orderItemsTableHasPackageId(db);
  if (hasPackageItems && !hasPackageColumn) {
    throw new Error(
      "Database schema is missing OrderItems.PackageId. Run backend/src/db/alter_orderitems_for_packages.sql."
    );
  }

  if (quote.distanceMiles > Number(quote.settings.MaxDeliveryDistanceMiles || 30)) {
    throw new Error("Delivery address is outside service range");
  }

  for (const item of quote.items.filter((item) => item.itemType === "Equipment")) {
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
      throw new Error(
        `${item.name} has only ${Math.max(item.totalQuantity - reservedQty, 0)} left for selected date`
      );
    }
  }

  return {
    quote,
    dateNorm,
    startNorm,
    endNorm,
    contactName: String(contactName).trim(),
    contactEmail: em || null,
    contactPhone: ph || null,
    deliveryMethod,
    deliveryAddress: deliveryAddress || null
  };
}
