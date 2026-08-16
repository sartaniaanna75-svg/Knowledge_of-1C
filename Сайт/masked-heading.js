/**
 * MaskedHeading — vanilla JS адаптация React-компонента
 * Текст = SVG clipPath, внутри — фото со склада + GSAP reveal
 */
(function () {
  'use strict';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function parseOptions(el) {
    const ds = el.dataset;
    return {
      fillScale: Number(ds.fillScale || 1.25),
      parallax: Number(ds.parallax || 26),
      drift: Number(ds.drift || 18),
      brightness: Number(ds.brightness || 1),
      saturation: Number(ds.saturation || 1.05),
      grayscale: ds.grayscale === 'true',
      reveal: ds.reveal || 'rise',
      duration: Number(ds.duration || 1.1),
      stagger: Number(ds.stagger || 0.09),
      trigger: ds.trigger || 'load',
      textScale: Number(ds.textScale || 0.095),
      minFont: Number(ds.minFont || 28),
      maxFont: Number(ds.maxFont || 68)
    };
  }

  function initMaskedHeading(root) {
    if (!root || root.dataset.mhReady) return;
    if (typeof gsap === 'undefined') {
      root.classList.add('is-fallback');
      return;
    }

    const settings = parseOptions(root);
    const measure = root.querySelector('.masked-heading__measure');
    const revealLayer = root.querySelector('.masked-heading__reveal');
    const media = root.querySelector('.masked-heading__media');
    const wordEls = Array.from(root.querySelectorAll('.masked-heading__word'));
    const baseEls = Array.from(root.querySelectorAll('.masked-heading__baseline'));
    const glyphEls = Array.from(root.querySelectorAll('.masked-heading__glyph'));

    if (!measure || !revealLayer || !media || !wordEls.length || !glyphEls.length) {
      root.classList.add('is-fallback');
      return;
    }

    root.dataset.mhReady = '1';

    const offset = { x: 0, y: 0, tx: 0, ty: 0 };
    let tween = null;
    let raf = 0;

    const place = () => {
      const W = root.clientWidth;
      const H = root.clientHeight;
      const maxX = Math.max(0, ((settings.fillScale - 1) / 2) * W);
      const maxY = Math.max(0, ((settings.fillScale - 1) / 2) * H);

      media.style.transform =
        `translate3d(${clamp(offset.x, -maxX, maxX).toFixed(2)}px, ` +
        `${clamp(offset.y, -maxY, maxY).toFixed(2)}px, 0) scale(${settings.fillScale})`;

      media.style.filter =
        `brightness(${settings.brightness}) saturate(${settings.saturation})` +
        (settings.grayscale ? ' grayscale(1)' : '');
    };

    const sync = () => {
      root.style.fontSize =
        `${clamp(root.clientWidth * settings.textScale, settings.minFont, settings.maxFont).toFixed(1)}px`;

      const cs = window.getComputedStyle(measure);
      const rootRect = root.getBoundingClientRect();

      wordEls.forEach((box, i) => {
        const base = baseEls[i];
        const glyph = glyphEls[i];
        if (!box || !base || !glyph) return;

        const boxRect = box.getBoundingClientRect();
        const baseRect = base.getBoundingClientRect();

        glyph.setAttribute('x', `${(boxRect.left - rootRect.left).toFixed(2)}`);
        glyph.setAttribute('y', `${(baseRect.top - rootRect.top).toFixed(2)}`);
        glyph.style.fontFamily = cs.fontFamily;
        glyph.style.fontSize = cs.fontSize;
        glyph.style.fontWeight = cs.fontWeight;
        glyph.style.fontStyle = cs.fontStyle;
        glyph.style.letterSpacing = cs.letterSpacing;
      });
      place();
    };

    const riseDistance = () => (parseFloat(window.getComputedStyle(root).fontSize) || 48) * 1.15;

    const settle = () => {
      gsap.set(glyphEls, { y: 0 });
      gsap.set(revealLayer, { opacity: 1, scale: 1, clipPath: 'inset(0% 0% 0% 0%)' });
    };

    const rest = () => {
      if (settings.reveal === 'rise') {
        gsap.set(glyphEls, { y: riseDistance() });
      } else if (settings.reveal === 'wipe') {
        gsap.set(revealLayer, { clipPath: 'inset(0% 100% 0% 0%)' });
      } else if (settings.reveal === 'fade') {
        gsap.set(revealLayer, { opacity: 0, scale: 1.08 });
      }
    };

    const play = () => {
      tween?.kill();
      if (settings.reveal === 'rise') {
        gsap.set(revealLayer, { opacity: 1, scale: 1, clipPath: 'inset(0% 0% 0% 0%)' });
        tween = gsap.fromTo(
          glyphEls,
          { y: riseDistance() },
          {
            y: 0,
            duration: settings.duration,
            stagger: settings.stagger,
            ease: 'power4.out',
            overwrite: 'auto'
          }
        );
      } else if (settings.reveal === 'wipe') {
        gsap.set(glyphEls, { y: 0 });
        const state = { p: 100 };
        tween = gsap.to(state, {
          p: 0,
          duration: settings.duration,
          ease: 'power3.inOut',
          overwrite: 'auto',
          onUpdate: () => {
            revealLayer.style.clipPath = `inset(0% ${state.p}% 0% 0%)`;
          }
        });
      } else {
        gsap.set(glyphEls, { y: 0 });
        tween = gsap.fromTo(
          revealLayer,
          { opacity: 0, scale: 1.08 },
          {
            opacity: 1,
            scale: 1,
            duration: settings.duration,
            ease: 'power3.out',
            overwrite: 'auto'
          }
        );
      }
    };

    /* Layout + parallax/drift */
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(root);
    if (document.fonts?.ready) {
      document.fonts.ready.then(sync).catch(() => {});
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reduce) {
      let last = performance.now();
      let clock = 0;

      const frame = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        clock += dt;

        const dx = Math.sin(clock * 0.21) * settings.drift;
        const dy = Math.cos(clock * 0.17) * settings.drift * 0.6;
        const ease = 1 - Math.exp(-dt / 0.18);

        offset.x += (offset.tx + dx - offset.x) * ease;
        offset.y += (offset.ty + dy - offset.y) * ease;

        place();
        raf = requestAnimationFrame(frame);
      };

      const onMove = (e) => {
        if (settings.parallax <= 0) return;
        const r = root.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / (r.width || 1)) * 2 - 1;
        const ny = ((e.clientY - r.top) / (r.height || 1)) * 2 - 1;
        offset.tx = clamp(nx, -1, 1) * -settings.parallax;
        offset.ty = clamp(ny, -1, 1) * -settings.parallax;
      };

      const onLeave = () => {
        offset.tx = 0;
        offset.ty = 0;
      };

      root.addEventListener('pointermove', onMove);
      root.addEventListener('pointerleave', onLeave);
      raf = requestAnimationFrame(frame);
    } else {
      place();
    }

    /* Reveal */
    if (settings.reveal === 'none' || reduce) {
      settle();
      return;
    }

    if (settings.trigger === 'hover') {
      settle();
      root.addEventListener('pointerenter', play);
      return;
    }

    if (settings.trigger === 'view') {
      settle();
      rest();
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            play();
            io.disconnect();
          }
        },
        { threshold: 0.25 }
      );
      io.observe(root);
      return;
    }

    /* trigger === 'load' */
    settle();
    rest();
    requestAnimationFrame(() => {
      requestAnimationFrame(play);
    });
  }

  function boot() {
    document.querySelectorAll('[data-masked-heading]').forEach(initMaskedHeading);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
