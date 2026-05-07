import { sql } from "../config/db.js";
import { calculateTotals, computeDropoffDeliveryFee } from "../utils/pricing.js";
import { calculateDistanceMiles } from "./mapsService.js";

export async function buildQuote(db, { items, deliveryMethod, deliveryAddress }) {
  const settingsResult = await db.request().query("SELECT TOP 1 * FROM Settings");
  const settings = settingsResult.recordset[0];
  let deliveryFee = 0;
  let distanceMiles = 0;

  if (deliveryMethod === "Dropoff" && deliveryAddress) {
    distanceMiles = await calculateDistanceMiles(deliveryAddress);
    deliveryFee = computeDropoffDeliveryFee(distanceMiles, settings);
  }

  const normalizedItems = [];
  for (const item of items || []) {
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new Error("Each item quantity must be at least 1.");
    }

    const packageId = item.packageId != null ? Number(item.packageId) : null;
    if (Number.isFinite(packageId) && packageId > 0) {
      const pkg = await db.request()
        .input("id", sql.Int, packageId)
        .query("SELECT Id, Name, Price FROM RentalPackages WHERE Id = @id AND IsActive = 1");
      const row = pkg.recordset[0];
      if (!row) throw new Error(`Package not found: ${item.packageId}`);
      normalizedItems.push({
        itemType: "Package",
        packageId: row.Id,
        equipmentId: null,
        name: row.Name,
        unitPrice: Number(row.Price),
        quantity
      });
      continue;
    }

    const eq = await db.request()
      .input("id", sql.Int, Number(item.equipmentId))
      .query("SELECT Id, Name, PricePerRental, TotalQuantity FROM Equipment WHERE Id = @id AND IsActive = 1");
    const row = eq.recordset[0];
    if (!row) throw new Error(`Equipment not found: ${item.equipmentId}`);

    normalizedItems.push({
      itemType: "Equipment",
      packageId: null,
      equipmentId: row.Id,
      name: row.Name,
      unitPrice: Number(row.PricePerRental),
      quantity,
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
