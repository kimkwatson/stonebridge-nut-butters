(function (root) {
  function subtractPurchased(cart, purchased) {
    return cart.map(item => ({ ...item, quantity: Math.max(0, item.quantity - purchased.filter(p => p.productId === item.productId && p.sizeId === item.sizeId).reduce((sum, p) => sum + p.quantity, 0)) })).filter(item => item.quantity > 0);
  }
  if (typeof module === 'object' && module.exports) module.exports = { subtractPurchased };
  else root.StonebridgeCart = { subtractPurchased };
})(typeof window === 'object' ? window : globalThis);
