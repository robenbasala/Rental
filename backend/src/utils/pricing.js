export function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Dropoff total = base fee + (miles × per-mile rate). Settings keys match SQL column names. */
export function computeDropoffDeliveryFee(miles, settings) {
  const fixed = Number(settings?.DeliveryFixedFee ?? settings?.deliveryFixedFee ?? 0);
  const perMile = Number(settings?.DeliveryPricePerMile ?? settings?.deliveryPricePerMile ?? 0);
  const m = Number(miles) || 0;
  return round2(Math.max(0, fixed) + m * Math.max(0, perMile));
}

export function calculateTotals({
  items,
  deliveryFee,
  taxRate
}) {
  const subtotal = round2(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  const tax = round2(subtotal * taxRate);
  const total = round2(subtotal + tax + deliveryFee);

  return { subtotal, tax, total };
}
