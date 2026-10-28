(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const revealTargets = document.querySelectorAll('main > section, main > .values-strip, .product-card, .faq-list > details');
  let revealObserver;
  function reveal(element) {
    element.classList.remove('is-waiting');
    revealObserver?.unobserve(element);
  }
  if ('IntersectionObserver' in window && !reduced.matches) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) reveal(entry.target); });
    }, { threshold: 0, rootMargin: '0px 0px -32px 0px' });
    revealTargets.forEach((element, index) => {
      // Don't hide the first screen or a current in-page anchor target.
      if (element.getBoundingClientRect().top < window.innerHeight || element.matches(':target')) return;
      element.classList.add('scroll-reveal', 'is-waiting');
      if (element.matches('.product-card')) element.style.setProperty('--reveal-delay', (index % 3) * 70 + 'ms');
      revealObserver.observe(element);
    });
    document.addEventListener('focusin', event => {
      let element = event.target;
      while (element && element !== document.body) {
        if (element.classList.contains('is-waiting')) reveal(element);
        element = element.parentElement;
      }
    });
    window.addEventListener('hashchange', () => {
      revealTargets.forEach(element => { if (element.matches(':target') || element.querySelector(':target')) reveal(element); });
    });
  }
  const gingerbread = document.querySelector('.gingerbread-feature');
  if (gingerbread && 'IntersectionObserver' in window && !reduced.matches) {
    const featureObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          gingerbread.classList.add('spice-motion-ready');
          featureObserver.unobserve(gingerbread);
        }
      });
    }, { threshold: 0.15 });
    featureObserver.observe(gingerbread);
  }
  const videos = [...document.querySelectorAll('video[data-visible-loop]')];
  const visible = new Set();
  function updateVideo(video) {
    if (!visible.has(video) || document.hidden || reduced.matches) { video.pause(); return; }
    video.muted = true;
    video.defaultMuted = true;
    const source = video.querySelector('source[data-src]');
    if (source) { source.src = source.dataset.src; source.removeAttribute('data-src'); video.load(); }
    const playing = video.play();
    if (playing?.catch) playing.catch(() => { /* Autoplay may be blocked; keep the product poster visible. */ });
  }
  if ('IntersectionObserver' in window) {
    const videoObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) visible.add(entry.target); else visible.delete(entry.target);
        updateVideo(entry.target);
      });
    }, { threshold: 0 });
    videos.forEach(video => videoObserver.observe(video));
  }
  document.addEventListener('visibilitychange', () => videos.forEach(updateVideo));
  reduced.addEventListener('change', () => {
    if (reduced.matches) revealTargets.forEach(reveal);
    videos.forEach(updateVideo);
  });
})();
