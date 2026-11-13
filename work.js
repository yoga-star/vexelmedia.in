/* =========================================================
   VEXEL MEDIA — RECENT WORK helpers
   1. Muted preview loops play only while on screen.
   2. Lightbox: [data-lb="video"] opens the full film with sound,
      [data-lb="image"] opens the full-size picture.
   Links keep a real href, so without JS they still open the file.
   ========================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- 1. preview loops ---------------------------------- */
  var loops = Array.prototype.slice.call(document.querySelectorAll('video[data-loop]'));
  loops.forEach(function (v) {
    v.muted = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.loop = true;
  });

  function load(v) {
    if (!v.getAttribute('src') && v.dataset.src) {
      v.setAttribute('src', v.dataset.src);
      v.load();
    }
  }
  function play(v) {
    if (reduceMotion) return;
    load(v);
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }

  if (loops.length) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) play(en.target);
          else en.target.pause();
        });
      }, { rootMargin: '120px 120px', threshold: 0.2 });
      loops.forEach(function (v) { io.observe(v); });
    } else {
      loops.forEach(play);
    }
  }

  /* ---- 2. lightbox --------------------------------------- */
  var lb = document.createElement('div');
  lb.className = 'lb';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Viewer');
  lb.innerHTML = '<button type="button" class="lb__close" aria-label="Close">&times;</button>' +
                 '<div class="lb__stage"></div><p class="lb__cap"></p>';
  document.body.appendChild(lb);
  var stage = lb.querySelector('.lb__stage');
  var cap = lb.querySelector('.lb__cap');
  var closeBtn = lb.querySelector('.lb__close');
  var lastFocus = null;

  function openLb(kind, src, caption, poster) {
    stage.innerHTML = '';
    var el;
    if (kind === 'video') {
      el = document.createElement('video');
      el.src = src;
      el.controls = true;
      el.autoplay = true;
      el.playsInline = true;
      el.setAttribute('playsinline', '');
      if (poster) el.poster = poster;
    } else {
      el = document.createElement('img');
      el.src = src;
      el.alt = caption || '';
    }
    stage.appendChild(el);
    cap.textContent = caption || '';
    lastFocus = document.activeElement;
    lb.classList.add('is-open');
    document.body.classList.add('is-lb');
    loops.forEach(function (v) { v.pause(); });
    closeBtn.focus();
    if (kind === 'video') {
      var p = el.play();
      if (p && p.catch) p.catch(function () {});
    }
  }

  function closeLb() {
    var v = stage.querySelector('video');
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    stage.innerHTML = '';
    lb.classList.remove('is-open');
    document.body.classList.remove('is-lb');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-lb]') : null;
    if (!t) return;
    e.preventDefault();
    openLb(t.getAttribute('data-lb'), t.getAttribute('href'), t.getAttribute('data-cap'), t.getAttribute('data-poster'));
  });
  closeBtn.addEventListener('click', closeLb);
  lb.addEventListener('click', function (e) { if (e.target === lb || e.target === stage) closeLb(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && lb.classList.contains('is-open')) closeLb();
  });
})();
