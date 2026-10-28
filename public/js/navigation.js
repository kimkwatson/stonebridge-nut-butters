(() => {
  const header = document.querySelector('.site-header');
  const button = header?.querySelector('.menu-toggle');
  const nav = header?.querySelector('nav');
  if (!header || !button || !nav) return;
  const mobile = window.matchMedia('(max-width: 760px)');
  let open = false;
  function setOpen(value, restoreFocus = false) {
    open = mobile.matches && value;
    header.classList.toggle('menu-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    nav.inert = mobile.matches && !open;
    if (restoreFocus) button.focus();
  }
  header.classList.add('nav-enhanced');
  button.hidden = false;
  setOpen(false);
  button.addEventListener('click', () => setOpen(!open));
  nav.addEventListener('click', event => { if (event.target.closest('a') && mobile.matches) setOpen(false, true); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false, true); }
  });
  document.addEventListener('click', event => { if (open && !header.contains(event.target)) setOpen(false); });
  document.addEventListener('focusin', event => { if (open && !header.contains(event.target)) setOpen(false); });
  mobile.addEventListener('change', () => setOpen(false));
})();
