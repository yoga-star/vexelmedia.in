/* =========================================================
   VEXEL MEDIA — INTERACTIONS
   ========================================================= */

const PREFERS_REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const IS_TOUCH = matchMedia('(hover:none)').matches || ('ontouchstart' in window);

/* Initialize the mobile menu IMMEDIATELY — it must not be blocked by the
   loader, Lenis, or any other init failing. Burger tap should always work. */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileMenuEarly);
} else {
  initMobileMenuEarly();
}
function initMobileMenuEarly(){
  try { initMobileMenu(); } catch (e) { console.error('mobi init failed', e); }
}

/* ---------- LOADER (disabled — kick off instantly) ---------- */
(function loader(){
  const el = document.getElementById('loader');
  if (el) {
    el.classList.add('is-done','is-gone');
    el.setAttribute('hidden','');
  }
  document.body.classList.add('is-loaded');
  kickOff();
})();

/* ---------- KICK OFF after loader ---------- */
function kickOff(){
  // Wrap each init in try/catch so one failure doesn't kill the chain
  const safe = (label, fn) => { try { fn(); } catch (e) { console.warn('[init]', label, e); } };
  safe('heroReveal', heroReveal);
  if (!PREFERS_REDUCED){
    safe('initCursor', initCursor);
    safe('initLenis', initLenis);
    safe('initMagnetic', initMagnetic);
    safe('initTilt', initTilt);
    safe('initMarqueeVelocity', initMarqueeVelocity);
    safe('initManifesto', initManifesto);
    safe('initDragRail', initDragRail);
  } else {
    document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('is-in'));
  }
  safe('initRevealOnScroll', initRevealOnScroll);
  safe('initCounters', initCounters);
  safe('initNavScroll', initNavScroll);
}

/* ---------- SMOOTH SCROLL HELPER (bypasses Lenis hijack) ---------- */
function smoothScrollToEl(el, offset = 0, duration = 900){
  if (!el) return;
  const startY = window.pageYOffset;
  const targetY = el.getBoundingClientRect().top + startY + offset;
  const distance = targetY - startY;
  if (Math.abs(distance) < 2) return;
  const startTime = performance.now();
  // ease-in-out cubic
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  let rafId = null;
  let stopped = false;
  function step(now){
    if (stopped) return;
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    const y = startY + distance * ease(t);
    window.scrollTo(0, y); // legacy form is instant — bypasses smooth hijack
    if (t < 1) rafId = requestAnimationFrame(step);
    else if (lenis) {
      try { lenis.resize(); } catch(e) {}
    }
  }
  rafId = requestAnimationFrame(step);
  // Failsafe: if RAF never runs (e.g. backgrounded tab) for 100ms, jump instantly
  setTimeout(() => {
    if (Math.abs(window.pageYOffset - startY) < 2 && rafId !== null) {
      stopped = true;
      cancelAnimationFrame(rafId);
      window.scrollTo(0, targetY);
      if (lenis) { try { lenis.resize(); } catch(e) {} }
    }
  }, 100);
}

/* ---------- MOBILE MENU ---------- */
function initMobileMenu(){
  const burger = document.getElementById('navBurger');
  const menu   = document.getElementById('mobileMenu');
  const close  = document.getElementById('mobileMenuClose');
  if (!burger || !menu) return;

  // NOTE: We deliberately do NOT call lenis.stop() / lenis.start() here.
  // body.overflow:hidden (via .is-mobi-open) is enough to prevent page scroll,
  // and keeping Lenis running means lenis.scrollTo() works correctly when a
  // menu link is tapped. Stopping/starting Lenis breaks scrollTo silently.
  const open = () => {
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    burger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('is-mobi-open');
  };
  const shut = () => {
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    burger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-mobi-open');
  };

  burger.addEventListener('click', e => { e.stopPropagation(); open(); });
  close?.addEventListener('click', shut);

  // Link tap handler — handle same-page anchors specially because Lenis
  // is paused while the menu is open, so its anchor handler can't scroll.
  const onLinkTap = e => {
    const a = e.currentTarget;
    const href = a.getAttribute('href') || '';
    const isHashOnly = href.startsWith('#') && href.length > 1;

    if (isHashOnly){
      e.preventDefault();
      // Stop the document-level Lenis anchor handler from firing — its
      // scrollTo() is unreliable right after a menu open/close cycle.
      e.stopImmediatePropagation();
      const tgt = document.querySelector(href);
      shut(); // closes menu and clears body scroll-lock
      if (tgt){
        // Wait for menu transition to finish, then smooth-scroll. We use a
        // hand-rolled rAF animation that calls window.scrollTo(_, _) (legacy
        // signature, instant) on each frame — this bypasses Lenis's smooth
        // hijack while still feeling smooth.
        setTimeout(() => smoothScrollToEl(tgt, -64, 900), 600);
      }
      return;
    }

    // External / cross-page / mailto / tel — just close after a tick
    // so the browser still does the navigation.
    setTimeout(shut, 50);
  };
  menu.querySelectorAll('[data-mobi-link]').forEach(a => {
    a.addEventListener('click', onLinkTap);
  });

  // ESC key closes
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) shut();
  });

  // Close when crossing back to desktop width
  matchMedia('(min-width:781px)').addEventListener('change', e => {
    if (e.matches) shut();
  });
}

/* ---------- HERO CHARACTER REVEAL ---------- */
function heroReveal(){
  const title = document.querySelector('.hero__title');
  if (!title || PREFERS_REDUCED) {
    if (title) title.style.opacity = 1;
    return;
  }
  // Split into words/chars while preserving <em>
  const walk = (node, out=[]) => {
    node.childNodes.forEach(n => {
      if (n.nodeType === 3) {
        out.push({text:n.textContent, em:false, parent:n.parentNode});
      } else if (n.nodeType === 1) {
        const isEm = n.tagName === 'EM';
        n.childNodes.forEach(cn => {
          if (cn.nodeType === 3) out.push({text:cn.textContent, em:isEm});
        });
      }
    });
    return out;
  };
  const segments = walk(title);
  title.innerHTML = '';
  let i = 0;
  segments.forEach(seg => {
    const words = seg.text.split(/(\s+)/);
    words.forEach(w => {
      if (/^\s+$/.test(w)) { title.appendChild(document.createTextNode(' ')); return; }
      if (!w) return;
      const wrap = document.createElement('span');
      wrap.className = 'word';
      [...w].forEach(c => {
        const ch = document.createElement('span');
        ch.className = 'char';
        ch.textContent = c;
        ch.style.transitionDelay = (i * 0.022) + 's';
        if (seg.em) {
          ch.style.fontStyle = 'italic';
          ch.style.color = 'var(--accent)';
        }
        wrap.appendChild(ch);
        i++;
      });
      title.appendChild(wrap);
    });
  });
  // Use double-RAF to ensure layout settles
  requestAnimationFrame(() => requestAnimationFrame(() => {
    title.querySelectorAll('.char').forEach(c => c.classList.add('is-in'));
  }));
}

/* ---------- CUSTOM CURSOR ---------- */
let cursorState = { x: 0, y: 0, tx: 0, ty: 0 };
function initCursor(){
  if (IS_TOUCH) return;
  const c = document.getElementById('cursor');
  const label = document.getElementById('cursorLabel');
  if (!c) return;

  window.addEventListener('mousemove', e => {
    cursorState.tx = e.clientX;
    cursorState.ty = e.clientY;
  });

  function loop(){
    cursorState.x += (cursorState.tx - cursorState.x) * 0.22;
    cursorState.y += (cursorState.ty - cursorState.y) * 0.22;
    c.style.transform = `translate(${cursorState.x}px, ${cursorState.y}px) translate(-50%,-50%)`;
    requestAnimationFrame(loop);
  }
  loop();

  const setState = (kind, text='') => {
    c.classList.remove('is-link','is-view','is-drag');
    if (kind) c.classList.add('is-' + kind);
    label.textContent = text;
  };

  document.addEventListener('mouseover', e => {
    const t = e.target.closest('[data-cursor]');
    if (!t) { setState(null); return; }
    const kind = t.dataset.cursor;
    if (kind === 'view') setState('view','view');
    else if (kind === 'drag') setState('drag','drag');
    else setState('link');
  });
  document.addEventListener('mouseout', e => {
    if (!e.relatedTarget || !e.relatedTarget.closest?.('[data-cursor]')) setState(null);
  });
  window.addEventListener('blur', () => setState(null));
}

/* ---------- SMOOTH SCROLL ---------- */
let lenis = null;
function initLenis(){
  if (typeof Lenis === 'undefined') return;
  lenis = new Lenis({
    lerp: 0.08,
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1.5,
  });
  function raf(time){
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // anchor links
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const tgt = document.querySelector(id);
      if (!tgt) return;
      e.preventDefault();
      lenis.scrollTo(tgt, { offset: -40, duration: 1.4 });
    });
  });
}

/* ---------- MAGNETIC BUTTONS ---------- */
function initMagnetic(){
  if (IS_TOUCH) return;
  document.querySelectorAll('.magnetic').forEach(el => {
    let r = null;
    el.addEventListener('mouseenter', () => { r = el.getBoundingClientRect(); });
    el.addEventListener('mousemove', e => {
      if (!r) r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width/2;
      const y = e.clientY - r.top - r.height/2;
      el.style.transform = `translate(${x*0.25}px, ${y*0.25}px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
      r = null;
    });
  });
}

/* ---------- 3D TILT CARDS ---------- */
function initTilt(){
  if (IS_TOUCH) return;
  document.querySelectorAll('.tilt').forEach(el => {
    let r = null;
    el.addEventListener('mouseenter', () => {
      r = el.getBoundingClientRect();
      el.style.transition = 'transform 0.1s linear';
    });
    el.addEventListener('mousemove', e => {
      if (!r) r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (py - 0.5) * -8;
      const ry = (px - 0.5) * 10;
      el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
      el.style.setProperty('--mx', (px*100)+'%');
      el.style.setProperty('--my', (py*100)+'%');
    });
    el.addEventListener('mouseleave', () => {
      el.style.transition = 'transform .6s cubic-bezier(.2,.8,.2,1)';
      el.style.transform = '';
      r = null;
    });
  });
}

/* ---------- VELOCITY MARQUEE ---------- */
function initMarqueeVelocity(){
  const track = document.getElementById('marqueeTrack');
  if (!track) return;
  let pos = 0;
  let baseSpeed = 0.6; // px per frame
  let velocityBoost = 0;
  let lastY = window.scrollY;
  let firstGroupW = 0;

  const measure = () => {
    const first = track.querySelector('.marquee__group');
    if (first) firstGroupW = first.getBoundingClientRect().width + 32;
  };
  measure();
  window.addEventListener('resize', measure);

  // capture scroll velocity
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const dy = Math.abs(y - lastY);
    velocityBoost = Math.min(velocityBoost + dy * 0.2, 30);
    lastY = y;
  }, { passive:true });

  function raf(){
    velocityBoost *= 0.9;
    pos -= baseSpeed + velocityBoost * 0.4;
    if (firstGroupW && Math.abs(pos) >= firstGroupW) pos = 0;
    track.style.transform = `translateX(${pos}px)`;
    requestAnimationFrame(raf);
  }
  raf();
}

/* ---------- MANIFESTO STICKY SCRUBBER (scroll-driven, smooth) ---------- */
function initManifesto(){
  const section = document.querySelector('.manifesto');
  if (!section) return;
  const stages = section.querySelectorAll('.manifesto__stage');
  const numEl = document.getElementById('stageNum');
  const progEl = document.getElementById('manifestoProgress');
  const total = stages.length;
  if (!total) return;

  let activeIdx = -1;
  let ticking = false;

  // Easing for fade in/out segments — soft start, soft end
  const ease = t => t < .5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2;

  const update = () => {
    ticking = false;
    const r = section.getBoundingClientRect();
    const totalScrollable = section.offsetHeight - window.innerHeight;
    if (totalScrollable <= 0) return;
    const scrolled = Math.max(0, Math.min(totalScrollable, -r.top));
    const k = scrolled / totalScrollable;     // overall progress 0..1
    const slot = 1 / total;                    // size of each stage's slot
    const FADE = 0.18;                         // % of each slot used to fade in/out

    stages.forEach((s, i) => {
      const local = (k - i * slot) / slot;     // this stage's local progress
      let opacity, ty;
      if (local <= -FADE){
        opacity = 0; ty = 28;
      } else if (local >= 1 + FADE){
        opacity = 0; ty = -28;
      } else if (local < FADE){
        const t = ease((local + FADE) / (2*FADE));
        opacity = t;
        ty = 28 * (1 - t);
      } else if (local > 1 - FADE){
        const t = ease((local - (1 - FADE)) / (2*FADE));
        opacity = 1 - t;
        ty = -28 * t;
      } else {
        opacity = 1; ty = 0;
      }
      s.style.opacity = opacity.toFixed(3);
      s.style.transform = 'translate3d(0,' + ty.toFixed(1) + 'px,0)';
    });

    // Snap the integer counter at slot midpoint (feels stable)
    const idx = Math.min(total - 1, Math.max(0, Math.floor(k * total + 0.0001)));
    if (idx !== activeIdx){
      activeIdx = idx;
      numEl.textContent = String(idx + 1).padStart(2, '0');
    }
    progEl.style.width = (k * 100).toFixed(2) + '%';
  };

  const onScroll = () => {
    if (!ticking){
      requestAnimationFrame(update);
      ticking = true;
    }
  };

  update();
  window.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', onScroll);
}

/* ---------- HORIZONTAL DRAG RAIL ---------- */
function initDragRail(){
  const rail = document.getElementById('workRail');
  const prog = document.getElementById('workProgress');
  if (!rail) return;

  let isDown = false, startX = 0, startScroll = 0;

  rail.addEventListener('mousedown', e => {
    isDown = true;
    startX = e.pageX;
    startScroll = rail.scrollLeft;
    rail.style.scrollSnapType = 'none';
  });
  window.addEventListener('mouseup', () => {
    isDown = false;
    rail.style.scrollSnapType = '';
  });
  window.addEventListener('mousemove', e => {
    if (!isDown) return;
    e.preventDefault();
    rail.scrollLeft = startScroll - (e.pageX - startX) * 1.6;
  });

  // wheel → horizontal
  rail.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      rail.scrollLeft += e.deltaY;
    }
  }, { passive:false });

  // progress
  const updateProg = () => {
    const max = rail.scrollWidth - rail.clientWidth;
    const k = max > 0 ? rail.scrollLeft / max : 0;
    prog.style.width = (k * 100) + '%';
  };
  rail.addEventListener('scroll', updateProg, { passive:true });
  window.addEventListener('resize', updateProg);
  updateProg();
}

/* ---------- REVEAL ON SCROLL ---------- */
function initRevealOnScroll(){
  const els = [...document.querySelectorAll('[data-reveal]')];
  if (PREFERS_REDUCED){
    els.forEach(e => e.classList.add('is-in'));
    return;
  }
  const checkInView = el => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    // Treat element as "in view" once its top crosses ~92% of viewport
    return r.top < vh * 0.92 && r.bottom > 0;
  };
  const revealIfIn = el => {
    if (!el.classList.contains('is-in') && checkInView(el)) el.classList.add('is-in');
  };
  // Pass 1 — immediate
  els.forEach(revealIfIn);
  // Pass 2 — after layout settles
  requestAnimationFrame(() => requestAnimationFrame(() => els.forEach(revealIfIn)));
  // Try IntersectionObserver first (preferred path)
  let io = null;
  if (typeof IntersectionObserver !== 'undefined'){
    io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting){
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => { if (!el.classList.contains('is-in')) io.observe(el); });
  }
  // Belt-and-braces — also fire on scroll, throttled to rAF. This guarantees
  // reveals work even in environments where IntersectionObserver doesn't
  // fire correctly (some iframes / older WebViews).
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      els.forEach(el => {
        if (!el.classList.contains('is-in') && checkInView(el)){
          el.classList.add('is-in');
          if (io) io.unobserve(el);
        }
      });
    });
  };
  window.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', onScroll);
}

/* ---------- ANIMATED COUNTERS ---------- */
function initCounters(){
  const counters = document.querySelectorAll('.stat__count');
  const ease = t => 1 - Math.pow(1 - t, 3);
  const run = el => {
    const target = +el.dataset.target;
    const suffix = el.dataset.suffix || '';
    const dur = 1600;
    const start = performance.now();
    const step = t => {
      const k = Math.min(1, (t - start)/dur);
      const v = Math.round(target * ease(k));
      el.textContent = v + suffix;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting){
        run(en.target);
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.4 });
  counters.forEach(c => io.observe(c));
}

/* ---------- NAV SCROLLED ---------- */
function initNavScroll(){
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const onScroll = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 30);
  };
  window.addEventListener('scroll', onScroll, { passive:true });
  onScroll();
}

/* ---------- IFRAME PREVIEW SCALER ----------
   Scales fixed-pixel iframes inside .browser__frame and .phone
   so they fit their responsive container at the right ratio.
   Browser iframes render at 1400x875 → scale to container width.
   Phone iframes render at 420x840 → scale to container width.        */
function initPreviewScaler(){
  const scaleOne = (frameEl, iframeWidth) => {
    const iframe = frameEl.querySelector('iframe');
    if (!iframe) return;
    const w = frameEl.clientWidth;
    if (!w) return;
    const scale = w / iframeWidth;
    iframe.style.transform = `scale(${scale})`;
  };
  const applyAll = () => {
    document.querySelectorAll('.browser__frame').forEach(f => scaleOne(f, 1400));
    document.querySelectorAll('.phone').forEach(f => scaleOne(f, 420));
  };
  // Initial run, then after iframes load, then on resize
  applyAll();
  document.querySelectorAll('.browser__frame iframe, .phone iframe').forEach(f => {
    f.addEventListener('load', applyAll);
  });
  // ResizeObserver for container width changes
  if (window.ResizeObserver){
    const ro = new ResizeObserver(applyAll);
    document.querySelectorAll('.browser__frame, .phone').forEach(el => ro.observe(el));
  }
  window.addEventListener('resize', applyAll);
  // Safety: run again after a short delay (in case iframe loaded before listener attached)
  setTimeout(applyAll, 500);
  setTimeout(applyAll, 1500);
  setTimeout(applyAll, 3000);
}

// Run scaler on DOM ready, regardless of loader
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPreviewScaler);
} else {
  initPreviewScaler();
}
