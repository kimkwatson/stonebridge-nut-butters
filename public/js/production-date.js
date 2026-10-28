(() => {
  const dates = document.querySelectorAll('[data-production-date]');
  if (!dates.length) return;
  const update = () => {
    // Use Arizona's calendar day, regardless of the shopper's time zone.
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Phoenix', year: 'numeric', month: 'numeric', day: 'numeric'
    }).formatToParts(new Date());
    const part = type => Number(parts.find(value => value.type === type).value);
    const date = new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
    // Wednesday orders are included in the current Wednesday's batch.
    date.setUTCDate(date.getUTCDate() + (3 - date.getUTCDay() + 7) % 7);
    const label = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    }).format(date);
    dates.forEach(element => {
      element.dateTime = date.toISOString().slice(0, 10);
      element.textContent = label;
    });
  };
  update();
  // Keep the date fresh when a page remains open overnight or is revisited.
  window.setInterval(update, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
})();
