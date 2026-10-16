(() => {
  const init = (root) => {
    if (!root || root.dataset.galleryReady === 'true') return;

    const slides = Array.from(root.querySelectorAll('[data-sj-slide]'));
    const dots = Array.from(root.querySelectorAll('[data-sj-dot]'));
    if (!slides.length || !dots.length) return;

    const desktopIndex = Number.parseInt(root.dataset.galleryDesktop, 10);
    const mobileIndex = Number.parseInt(root.dataset.galleryMobile, 10);
    const desktopStart = Number.isInteger(desktopIndex) ? desktopIndex : 2;
    const mobileStart = Number.isInteger(mobileIndex) ? mobileIndex : 1;
    const mobileQuery = window.matchMedia('(max-width: 749px)');

    const show = (index) => {
      slides.forEach((slide, slideIndex) => {
        slide.classList.toggle('is-active', slideIndex === index);
        slide.setAttribute('aria-hidden', slideIndex === index ? 'false' : 'true');
      });
      dots.forEach((dot, dotIndex) => {
        dot.classList.toggle('is-active', dotIndex === index);
        dot.setAttribute('aria-current', dotIndex === index ? 'true' : 'false');
      });
    };

    dots.forEach((dot, index) => dot.addEventListener('click', () => show(index)));
    const showConfiguredStart = () => show(mobileQuery.matches ? mobileStart : desktopStart);
    showConfiguredStart();
    mobileQuery.addEventListener?.('change', showConfiguredStart);
    root.dataset.galleryReady = 'true';
  };

  const initAll = (scope = document) => {
    scope.querySelectorAll('[data-sj-landing]').forEach(init);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAll());
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', (event) => initAll(event.target));
})();
