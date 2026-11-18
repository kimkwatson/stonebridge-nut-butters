// Reuse the existing Google tag; no additional base tag or Ads conversion.
(() => {
  if (window.StonebridgePurchase) return;
  const attempted = new Set();
  async function track(summary) {
    const data = summary?.purchase;
    const debug = new URLSearchParams(window.location.search).get('ga_debug') === '1';
    if (summary?.paid !== true || (summary.sandbox !== false && !debug) ||
        !data || data.transaction_id !== summary.reference ||
        !/^cs_(live|test)_[A-Za-z0-9_]+$/.test(data.transaction_id) ||
        data.currency !== 'USD' || !['value', 'shipping', 'tax'].every(k => Number.isFinite(data[k]) && data[k] >= 0) ||
        !Array.isArray(data.items) || !data.items.length || typeof window.gtag !== 'function') return;
    const key = 'stonebridge-ga4-purchase-v1-' + data.transaction_id;
    const send = () => {
      if (attempted.has(key)) return;
      try { if (localStorage.getItem(key)) return; } catch { /* Memory guard still works. */ }
      attempted.add(key);
      try {
        window.gtag('event', 'purchase', { ...data, send_to: 'G-M571TGWTG8', ...(debug ? { debug_mode: true } : {}) });
      } catch {
        // Allow a later call or refresh to retry a synchronous queue failure.
        attempted.delete(key);
        return;
      }
      // A successful call means queued, not confirmed delivery to Google.
      // Keep the memory guard even if persistence fails; don't resend immediately.
      try { localStorage.setItem(key, 'queued'); } catch { /* Storage may be blocked. */ }
    };
    try {
      if (window.navigator?.locks) await window.navigator.locks.request(key, send);
      else send();
    } catch { /* Analytics must never interrupt the receipt or basket. */ }
  }
  window.StonebridgePurchase = { track };
})();
