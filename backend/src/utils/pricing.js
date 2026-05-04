export function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
