(() => {
  document.querySelectorAll('[data-size-card]').forEach(card => {
    const select = card.querySelector('[data-card-size-select]');
    if (!select) return;
    const update = () => {
      const option = select.selectedOptions[0];
      if (!option) return;
      card.style.setProperty('--jar-scale', option.value === '8oz' ? '1' : '.82');
      card.querySelector('[data-card-price]').textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(option.dataset.price) / 100);
      card.querySelector('[data-card-size-label]').textContent = '/ ' + option.dataset.label;
      const link = card.querySelector('[data-card-order-link]');
      const url = new URL(link.href);
      url.searchParams.set('size', option.value);
      link.href = url.href;
    };
    select.addEventListener('change', update);
    update();
  });
  const detailSize = document.querySelector('[data-add-to-cart] select[name="size"]');
  const requested = new URLSearchParams(window.location.search).get('size');
  if (detailSize && [...detailSize.options].some(option => option.value === requested)) detailSize.value = requested;
})();
