/**
 * Reviews Stack — верхний отзыв уходит вверх и открывает нижний
 * GSAP + ScrollTrigger
 */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function init() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      console.warn('[reviews-stack] GSAP/ScrollTrigger не загружены');
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(max-width: 700px)').matches) return;

    document.querySelectorAll('[data-reviews-stack]').forEach(setupStack);
  }

  function setupStack(root) {
    const track = root.querySelector('.reviews-stack__track');
    const cards = gsap.utils.toArray(root.querySelectorAll('.reviews-stack__card'));
    if (!track || cards.length < 2) return;

    const n = cards.length;
    // сегменты скролла: улетают все кроме последней
    const leaveCount = n - 1;
    track.style.height = `${leaveCount * 100 + 100}vh`;

    // стартовая колода: 1-я сверху, остальные чуть ниже
    cards.forEach((card, i) => {
      gsap.set(card, {
        zIndex: n - i,
        y: i * 16,
        scale: 1 - i * 0.03,
        opacity: 1,
        rotation: 0,
        transformOrigin: '50% 80%'
      });
    });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.45,
        invalidateOnRefresh: true
      }
    });

    // каждая верхняя карточка уходит вверх → видна следующая
    for (let i = 0; i < leaveCount; i += 1) {
      const topCard = cards[i];
      const at = i;

      tl.to(
        topCard,
        {
          y: () => -window.innerHeight * 0.95,
          opacity: 0,
          scale: 0.96,
          rotation: -6,
          ease: 'none',
          duration: 1
        },
        at
      );

      // нижние карточки поднимаются на место верхней
      for (let j = i + 1; j < n; j += 1) {
        const depth = j - i - 1;
        tl.to(
          cards[j],
          {
            y: depth * 16,
            scale: 1 - depth * 0.03,
            ease: 'none',
            duration: 1
          },
          at
        );
      }
    }

    ScrollTrigger.refresh();
  }

  ready(init);
})();
