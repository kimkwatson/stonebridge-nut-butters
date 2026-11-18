// Called only after Stripe confirms a completed, paid session.
function purchaseData(session, lines) {
  const cents = n => Number.isSafeInteger(n) && n >= 0;
  const shipping = session.total_details?.amount_shipping || 0;
  const tax = session.total_details?.amount_tax || 0;
  const value = session.amount_total - shipping - tax;
  if (session.currency !== 'usd' || !/^cs_(live|test)_/.test(session.id || '') ||
      ![session.amount_total, shipping, tax, value].every(cents) || !lines.length) return undefined;
  const items = lines.map(line => {
    const net = line.amount_total - (line.amount_tax || 0);
    if (!cents(net) || !Number.isInteger(line.quantity) || line.quantity < 1 || !line.description) return null;
    return { item_name: line.description, quantity: line.quantity, price: net / 100 / line.quantity };
  });
  if (items.some(item => !item)) return undefined;
  return { transaction_id: session.id, currency: 'USD', value: value / 100,
    shipping: shipping / 100, tax: tax / 100, items };
}
module.exports = { purchaseData };
