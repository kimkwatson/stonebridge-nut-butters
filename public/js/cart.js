// Store identifiers and quantities only. Display prices come from the catalog.
// Checkout independently validates all items and prices on the server.
(() => {
  const KEY = 'stonebridge-cart-v1';
  let products = [];
  let cart = [];
  let checkingOut = false;
  let settled = [];
  const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  const message = text => {
    const toast = document.querySelector('#cart-message');
    toast.textContent = text;
    toast.classList.add('visible');
    clearTimeout(message.timer);
    message.timer = setTimeout(() => toast.classList.remove('visible'), 4000);
  };
  function normalize(value) {
    const merged = new Map();
    if (!Array.isArray(value)) return [];
    for (const item of value) {
      if (!item || !Number.isInteger(item.quantity) || item.quantity < 1) continue;
      const product = products.find(p => p.id === item.productId);
      if (!product?.sizes.some(s => s.id === item.sizeId)) continue;
      const key = item.productId + ':' + item.sizeId;
      const previous = merged.get(key)?.quantity || 0;
      merged.set(key, { productId: product.id, sizeId: item.sizeId, quantity: Math.min(99, previous + item.quantity) });
    }
    return [...merged.values()];
  }
  function read() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) || '[]');
      settled = Array.isArray(stored?.settled) ? stored.settled : [];
      return normalize(Array.isArray(stored) ? stored : stored.items);
    }
    catch { return []; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ items: cart, settled })); }
    catch { message('Your basket works for this visit, but this browser could not save it.'); }
    render();
  }
  // Use DOM textContent for all catalog and cart text, avoiding HTML injection.
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function render() {
    document.querySelectorAll('[data-cart-count]').forEach(node => node.textContent = cart.reduce((sum, item) => sum + item.quantity, 0));
    const container = document.querySelector('#cart-items');
    if (!container) return;
    container.replaceChildren();
    let total = 0;
    if (!cart.length) {
      container.append(element('h2', 'Your next favorite is waiting.'), element('p', 'Your basket is empty. Explore the pantry to add a jar or two.'));
      const link = element('a', 'Shop the pantry ↗', 'button');
      link.href = '/shop';
      container.append(link);
    }
    cart.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const size = product.sizes.find(s => s.id === item.sizeId);
      total += size.price * item.quantity;
      const row = element('article', undefined, 'cart-row');
      const image = element('img'); image.src = '/images/butter.png'; image.alt = ''; image.width = 90;
      const info = element('div');
      const link = element('a', product.name); link.href = '/products/' + product.slug;
      info.append(link, element('p', size.label + ' · ' + money(size.price) + ' each'));
      const label = element('label', 'Quantity', 'quantity-label');
      const input = element('input'); input.type = 'number'; input.min = '1'; input.max = '99'; input.value = item.quantity;
      input.setAttribute('aria-label', 'Quantity for ' + product.name + ', ' + size.label);
      input.addEventListener('change', () => {
        const quantity = Number(input.value);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) { input.value = item.quantity; message('Choose a quantity from 1 to 99.'); return; }
        item.quantity = quantity; save();
        // render replaces the input; restore focus for keyboard users.
        const inputs = container.querySelectorAll('input');
        inputs[cart.indexOf(item)]?.focus();
      });
      label.append(input);
      const remove = element('button', 'Remove', 'remove-button'); remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove ' + product.name + ', ' + size.label);
      remove.addEventListener('click', () => { cart = cart.filter(entry => entry !== item); save(); message(product.name + ' removed from your basket.'); container.querySelector('button, a')?.focus(); });
      row.append(image, info, label, element('strong', money(size.price * item.quantity)), remove);
      container.append(row);
    });
    document.querySelector('#cart-subtotal').textContent = money(total);
    const checkout = document.querySelector('#checkout-button');
    if (checkout) checkout.disabled = !cart.length || checkingOut;
  }
  async function setupCheckout() {
    const button = document.querySelector('#checkout-button');
    const status = document.querySelector('#checkout-status');
    if (!status) return;
    const heading = document.querySelector('#confirmation-heading');
    const summary = document.querySelector('#confirmation-summary');
    button?.addEventListener('click', async () => {
      if (checkingOut || !cart.length) return;
      checkingOut = true;
      button.disabled = true;
      status.textContent = 'Opening Stripe sandbox checkout…';
      const checkoutItems = cart.map(item => ({ ...item }));
      try {
        const response = await fetch('/.netlify/functions/create-checkout', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: checkoutItems })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Checkout could not start.');
        if (new URL(result.url).origin !== 'https://checkout.stripe.com') throw new Error('Invalid checkout address.');
        if (!/^cs_test_[A-Za-z0-9_]+$/.test(result.sessionId || '')) throw new Error('Invalid checkout reference.');
        try {
          localStorage.setItem('stonebridge-checkout-' + result.sessionId, JSON.stringify(checkoutItems));
        } catch { throw new Error('Please allow browser storage before checkout so your purchased items can be removed safely.'); }
        window.location.assign(result.url);
      } catch (error) {
        status.textContent = error.message === 'Failed to fetch' ? 'Checkout could not connect. Please try again.' : error.message;
        checkingOut = false;
        render();
      }
    });
    const query = new URLSearchParams(window.location.search);
    if (query.get('checkout') === 'canceled') status.textContent = 'Test checkout canceled. Your basket is still here.';
    const id = query.get('session_id');
    if (!id) {
      if (heading) { heading.textContent = 'No payment reference found.'; status.textContent = 'Open this page using the return link from Stripe checkout. No payment has been verified.'; }
      return;
    }
    status.textContent = 'Checking your test payment with Stripe…';
    try {
      const response = await fetch('/.netlify/functions/' + (summary ? 'checkout-summary' : 'checkout-status') + '?session_id=' + encodeURIComponent(id));
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not verify the test payment.');
      if (result.paid) {
        if (heading) heading.textContent = 'Thank you! Your test payment is confirmed.';
        if (summary) {
          const format = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: result.currency || 'usd' }).format(cents / 100);
          const list = document.querySelector('#confirmation-items');
          list.replaceChildren();
          result.items.forEach(item => {
            const row = element('li');
            const name = element('span', item.name);
            name.append(element('small', 'Quantity: ' + item.quantity));
            row.append(name, element('strong', format(item.total)));
            list.append(row);
          });
          for (const field of ['subtotal', 'shipping', 'tax', 'discount', 'total']) {
            document.querySelector('#confirmation-' + field).textContent = (field === 'discount' ? '−' : '') + format(result[field]);
          }
          document.querySelector('#confirmation-discount-row').hidden = !result.discount;
          document.querySelector('#confirmation-reference').textContent = result.reference;
          summary.hidden = false;
        }
        // Re-read after the network request to preserve changes from other tabs.
        try {
        cart = read();
        const snapshotKey = 'stonebridge-checkout-' + id;
        const snapshot = localStorage.getItem(snapshotKey);
        if (snapshot && !settled.includes(id)) {
          const purchased = normalize(JSON.parse(snapshot));
          const remaining = window.StonebridgeCart.subtractPurchased(cart, purchased);
          // Save basket and receipt together: refreshing cannot subtract twice.
          const receipts = [...settled, id];
          localStorage.setItem(KEY, JSON.stringify({ items: remaining, settled: receipts }));
          cart = remaining;
          settled = receipts;
          localStorage.removeItem(snapshotKey);
        }
        render();
        status.textContent = 'Test payment confirmed by Stripe. No real order will be shipped.' +
          (snapshot || settled.includes(id) ? ' Purchased items have been removed from your basket.' : ' This older checkout has no saved basket reference, so your current basket was left unchanged.');
        } catch {
          status.textContent = 'Test payment confirmed by Stripe. Your browser could not update the saved basket; please remove the purchased items manually. No order will be shipped.';
        }
      } else {
        if (heading) heading.textContent = result.status === 'expired' ? 'This checkout has expired.' : 'Your payment is not confirmed yet.';
        status.textContent = 'Stripe has not confirmed a completed test payment. Your basket is still here.';
      }
    } catch {
      if (heading) heading.textContent = 'We could not verify your payment.';
      status.textContent = 'Could not verify the test payment. Check Stripe’s sandbox Payments page before retrying.';
    }
    // Keep the reference on the confirmation page so refresh can reload its summary.
    if (!summary) window.history.replaceState(null, '', window.location.pathname);
  }
  async function init() {
    const forms = document.querySelectorAll('[data-add-to-cart]');
    forms.forEach(form => form.querySelector('button').disabled = true);
    try {
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('Catalog unavailable');
      products = await response.json();
      cart = read(); render();
      setupCheckout();
      forms.forEach(form => {
        form.querySelector('button').disabled = false;
        form.addEventListener('submit', event => {
          event.preventDefault();
          const quantity = Number(form.elements.quantity.value);
          const product = products.find(p => p.id === form.dataset.productId);
          const sizeId = form.elements.size.value;
          if (!product?.sizes.some(s => s.id === sizeId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return;
          const existing = cart.find(item => item.productId === product.id && item.sizeId === sizeId);
          if ((existing?.quantity || 0) + quantity > 99) { message('You can add up to 99 of each jar size.'); return; }
          if (existing) existing.quantity += quantity;
          else cart.push({ productId: product.id, sizeId, quantity });
          save(); message(product.name + ' added to your basket.');
        });
      });
      window.addEventListener('storage', event => { if (event.key === KEY || event.key === null) { cart = read(); render(); } });
    } catch {
      message('The pantry could not load. Please refresh to try again.');
      const container = document.querySelector('#cart-items');
      if (container) container.textContent = 'Your basket could not load. Refresh this page to try again.';
    }
  }
  init();
})();
