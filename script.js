/* =========================================================
   VEXEL MEDIA — INTERACTIONS
   ========================================================= */

const PREFERS_REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const IS_TOUCH = matchMedia('(hover:none)').matches || ('ontouchstart' in window);

/* ---------- LOADER ---------- */
(function loader(){
  const el = document.getElementById('loader');
  const count = document.getElementById('loaderCount');
  const bar = document.getElementById('loaderBar');
  let p = 0;
  const dur = PREFERS_REDUCED ? 200 : 1400;
  const start = performance.now();
  function tick(t){
    const k = Math.min(1, (t - start) / dur);
    p = Math.round(k * 100);
    count.textContent = p;
    bar.style.width = (k * 100) + '%';
    if (k < 1) requestAnimationFrame(tick);
    else finish();
  }
  function finish(){
    el.classList.add('is-done');
    setTimeout(()=>{ el.classList.add('is-gone'); document.body.classList.add('is-loaded'); kickOff(); }, 1000);
  }
  requestAnimationFrame(tick);
})();

/* ---------- KICK OFF after loader ---------- */
function kickOff(){
  heroReveal();
  if (!PREFERS_REDUCED){
    initCursor();
    initLenis();
    initMagnetic();
    initTilt();
    initMarqueeVelocity();
    initManifesto();
    initDragRail();
  } else {
    document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('is-in'));
  }
  initRevealOnScroll();
  initCounters();
  initNavScroll();
  initMobileMenu();
}

/* ---------- MOBILE MENU ---------- */
function initMobileMenu(){
  const burger = document.getElementById('navBurger');
  const menu   = document.getElementById('mobileMenu');
  const close  = document.getElementById('mobileMenuClose');
  if (!burger || !menu) return;

  const open = () => {
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    burger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('is-mobi-open');
    if (lenis) lenis.stop();
  };
  const shut = () => {
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    burger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-mobi-open');
    if (lenis) lenis.start();
  };

  burger.addEventListener('click', e => { e.stopPropagation(); open(); });
  close?.addEventListener('click', shut);

  // Auto-close when any internal link is tapped
  menu.querySelectorAll('[data-mobi-link]').forEach(a => {
    a.addEventListener('click', () => {
      // Let same-page anchors scroll naturally — close after a brief tick
      setTimeout(shut, 50);
    });
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

/* ---------- MANIFESTO STICKY SCRUBBER ---------- */
function initManifesto(){
  const section = document.querySelector('.manifesto');
  if (!section) return;
  const stages = section.querySelectorAll('.manifesto__stage');
  const numEl = document.getElementById('stageNum');
  const progEl = document.getElementById('manifestoProgress');
  const total = stages.length;
  let activeIdx = -1;

  const update = () => {
    const r = section.getBoundingClientRect();
    const totalScrollable = section.offsetHeight - window.innerHeight;
    const scrolled = -r.top;
    const k = Math.max(0, Math.min(1, scrolled / totalScrollable));
    const idx = Math.min(total - 1, Math.floor(k * total));
    if (idx !== activeIdx){
      activeIdx = idx;
      stages.forEach((s,i) => s.classList.toggle('is-active', i === idx));
      numEl.textContent = String(idx + 1).padStart(2, '0');
    }
    progEl.style.width = ((idx + 1) / total * 100) + '%';
  };
  // initial
  stages[0].classList.add('is-active');
  update();
  window.addEventListener('scroll', update, { passive:true });
  window.addEventListener('resize', update);
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
  if (PREFERS_REDUCED){
    document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting){
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
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
