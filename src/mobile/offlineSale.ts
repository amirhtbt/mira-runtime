// Offline counterpart to server/src/Sales/Money.php for normal sales documents.
export interface OfflineLine {
  quantityMilli: string;
  unitPriceBaseUnit: string;
  discountBaseUnit?: string;
}

function amount(value: string): bigint {
  if (!/^(0|[1-9][0-9]{0,14})$/.test(value)) throw new RangeError('invalid_amount');
  return BigInt(value);
}
const max = 9223372036854775807n;
function bounded(n: bigint): bigint {
  if (n > max) throw new RangeError('money_overflow');
  return n;
}

export function calculateOfflineSale(lines: readonly OfflineLine[], taxRateBasisPoints = 0) {
  if (!lines.length) throw new RangeError('items_required');
  if (!Number.isInteger(taxRateBasisPoints) || taxRateBasisPoints < 0 || taxRateBasisPoints > 10000) throw new RangeError('tax_rate_invalid');
  let subtotal = 0n, discount = 0n, tax = 0n;
  const items = lines.map(line => {
    const quantity = amount(line.quantityMilli);
    if (quantity < 1n) throw new RangeError('quantity_invalid');
    const gross = bounded(quantity * amount(line.unitPriceBaseUnit) + 500n) / 1000n;
    const reduction = amount(line.discountBaseUnit ?? '0');
    if (reduction > gross) throw new RangeError('line_discount_exceeds_total');
    const net = gross - reduction;
    const lineTax = bounded(net * BigInt(taxRateBasisPoints) + 5000n) / 10000n;
    subtotal = bounded(subtotal + gross);
    discount += reduction;
    tax = bounded(tax + lineTax);
    return { taxBaseUnit: String(lineTax), lineTotalBaseUnit: String(bounded(net + lineTax)) };
  });
  return { subtotal: String(subtotal), discount: String(discount), tax: String(tax), total: String(bounded(subtotal - discount + tax)), items };
}
