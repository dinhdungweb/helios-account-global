(() => {
  const init = (root) => {
    if (!root || root.dataset.galleryReady === 'true') return;

    const slides = Array.from(root.querySelectorAll('[data-sj-slide]'));
    const dots = Array.from(root.querySelectorAll('[data-sj-dot]'));
    const gallery = root.querySelector('.sj-lp__gallery');
    if (!slides.length || !dots.length) return;

    const desktopIndex = Number.parseInt(root.dataset.galleryDesktop, 10);
    const mobileIndex = Number.parseInt(root.dataset.galleryMobile, 10);
    const desktopStart = Number.isInteger(desktopIndex) ? desktopIndex : 2;
    const mobileStart = Number.isInteger(mobileIndex) ? mobileIndex : 1;
    const mobileQuery = window.matchMedia('(max-width: 749px)');
    let activeIndex = 0;

    const hydrateSlide = (index) => {
      const image = slides[index]?.querySelector('[data-sj-gallery-image]');
      const source = image?.dataset.src;
      if (!image || !source || image.getAttribute('src')) return;

      image.src = source;
      image.removeAttribute('data-src');
    };

    const show = (index) => {
      activeIndex = ((index % slides.length) + slides.length) % slides.length;
      hydrateSlide(activeIndex);

      slides.forEach((slide, slideIndex) => {
        slide.classList.toggle('is-active', slideIndex === activeIndex);
        slide.setAttribute('aria-hidden', slideIndex === activeIndex ? 'false' : 'true');
      });
      dots.forEach((dot, dotIndex) => {
        dot.classList.toggle('is-active', dotIndex === activeIndex);
        dot.setAttribute('aria-current', dotIndex === activeIndex ? 'true' : 'false');
      });
    };

    dots.forEach((dot, index) => dot.addEventListener('click', () => show(index)));

    if (gallery) {
      let gesture = null;

      const resetGesture = () => {
        gesture = null;
        gallery.classList.remove('is-dragging');
      };

      gallery.addEventListener('pointerdown', (event) => {
        if (!event.isPrimary || event.target.closest('[data-sj-dot]')) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        gesture = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY
        };
        gallery.classList.add('is-dragging');
        gallery.setPointerCapture?.(event.pointerId);
      });

      gallery.addEventListener('pointerup', (event) => {
        if (!gesture || gesture.id !== event.pointerId) return;

        const deltaX = event.clientX - gesture.x;
        const deltaY = event.clientY - gesture.y;
        const swipeThreshold = Math.max(40, Math.min(gallery.clientWidth * 0.08, 80));
        resetGesture();

        if (Math.abs(deltaX) < swipeThreshold || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;
        show(activeIndex + (deltaX < 0 ? 1 : -1));
      });

      gallery.addEventListener('pointercancel', resetGesture);
      gallery.addEventListener('lostpointercapture', resetGesture);
    }

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
