/* ============================================================
   St. Paul's English High School — site interactions
   ============================================================ */
(function () {
  "use strict";

  gsap.registerPlugin(ScrollTrigger);

  /* ---------------------------------------------------------
     0. CONFIG
  --------------------------------------------------------- */
  var FRAME_COUNT = 128;
  var FRAME_PATH = function (i) {
    return "frames/frame-" + String(i).padStart(3, "0") + ".jpg";
  };

  /* ---------------------------------------------------------
     1. PRELOAD HERO FRAMES
  --------------------------------------------------------- */
  var images = [];
  var loaded = 0;
  var preloader = document.getElementById("preloader");
  var fillEl = document.getElementById("preloaderFill");
  var pctEl = document.getElementById("preloaderPct");

  function onFrameLoaded() {
    loaded++;
    var pct = Math.round((loaded / FRAME_COUNT) * 100);
    if (fillEl) fillEl.style.width = pct + "%";
    if (pctEl) pctEl.textContent = pct + "%";
    if (loaded >= FRAME_COUNT) ready();
  }

  for (var i = 1; i <= FRAME_COUNT; i++) {
    var img = new Image();
    img.onload = onFrameLoaded;
    img.onerror = onFrameLoaded;
    img.src = FRAME_PATH(i);
    images.push(img);
  }

  /* ---------------------------------------------------------
     2. CANVAS SETUP
  --------------------------------------------------------- */
  var canvas = document.getElementById("heroCanvas");
  var ctx = canvas.getContext("2d");
  var stage = document.getElementById("heroStage");

  function sizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = stage.clientWidth, h = stage.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFrame(currentFrame, true);
  }

  var currentFrame = 1;
  function drawFrame(index, force) {
    index = Math.max(1, Math.min(FRAME_COUNT, index));
    if (!force && index === currentFrame) return;
    currentFrame = index;
    var img = images[index - 1];
    if (!img || !img.complete || img.naturalWidth === 0) return;
    var w = stage.clientWidth, h = stage.clientHeight;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var scale = Math.max(w / iw, h / ih);
    var dw = iw * scale, dh = ih * scale;
    var dx = (w - dw) / 2, dy = (h - dh) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  window.addEventListener("resize", debounce(sizeCanvas, 150));

  /* ---------------------------------------------------------
     3. READY — hide preloader, wire up hero scroll
  --------------------------------------------------------- */
  function ready() {
    sizeCanvas();
    drawFrame(1, true);

    if (preloader) {
      preloader.classList.add("is-done");
      setTimeout(function () { preloader.style.display = "none"; }, 700);
    }

    var heroMini = document.getElementById("heroMini");
    gsap.set(heroMini, { opacity: 0, y: -8 });
    gsap.to(heroMini, { opacity: 1, y: 0, duration: 0.9, delay: 0.3, ease: "power2.out" });

    initHeroScroll();
    initReveals();
    initCounters();
    initLegacySlideshow();
  }

  /* ---------------------------------------------------------
     LEGACY SLIDESHOW — crossfades archival photos every ~2.5s
  --------------------------------------------------------- */
  function initLegacySlideshow() {
    var container = document.getElementById("legacySlideshow");
    if (!container) return;
    var imgs = Array.prototype.slice.call(container.querySelectorAll("img"));
    if (imgs.length < 2) return;
    var i = 0;
    setInterval(function () {
      imgs[i].classList.remove("is-active");
      i = (i + 1) % imgs.length;
      imgs[i].classList.add("is-active");
    }, 2600);
  }

  /* ---------------------------------------------------------
     4. HERO SCROLL FILM
  --------------------------------------------------------- */
  function initHeroScroll() {
    var heroMini = document.getElementById("heroMini");
    var heroBlur = document.getElementById("heroBlur");
    var heroReveal = document.getElementById("heroReveal");
    var progressFill = document.getElementById("heroProgressFill");

    var SCRUB_END = 0.80; // frames play across 0 -> 80% of pin scroll
    var revealed = false;

    var revealTl = gsap.timeline({ paused: true })
      .to(heroMini, { opacity: 0, y: -10, duration: 0.35, ease: "power1.in" }, 0)
      .to(heroBlur, { opacity: 1, duration: 0.6, ease: "power2.out" }, 0.05)
      .fromTo(heroReveal, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" }, 0.18);

    ScrollTrigger.create({
      trigger: "#hero",
      start: "top top",
      end: "bottom bottom",
      scrub: 0.4,
      onUpdate: function (self) {
        var p = self.progress;
        if (progressFill) progressFill.style.width = Math.min(p, 1) * 100 + "%";

        if (p <= SCRUB_END) {
          var fp = p / SCRUB_END;
          var idx = 1 + Math.round(fp * (FRAME_COUNT - 1));
          drawFrame(idx);
        } else {
          drawFrame(FRAME_COUNT);
        }

        if (p > SCRUB_END && !revealed) {
          revealed = true;
          revealTl.play();
        } else if (p <= SCRUB_END && revealed) {
          revealed = false;
          revealTl.reverse();
        }
      }
    });

    // scroll-cue click scrolls to end of hero pin
    var cta = document.querySelector(".hero__scroll-cta");
    if (cta) {
      cta.addEventListener("click", function (e) {
        e.preventDefault();
        document.getElementById("story").scrollIntoView({ behavior: "smooth" });
      });
    }
  }

  /* ---------------------------------------------------------
     5. NAV — solid state + mobile drawer
  --------------------------------------------------------- */
  var nav = document.getElementById("siteNav");
  window.addEventListener("scroll", debounce(function () {
    if (window.scrollY > 10) nav.classList.add("is-solid");
    else nav.classList.remove("is-solid");
  }, 10));

  var burger = document.getElementById("navBurger");
  var drawer = document.getElementById("drawer");
  if (burger && drawer) {
    burger.addEventListener("click", function () {
      var open = drawer.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    drawer.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        drawer.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------------------------------------------------------
     6. TIMELINE — click + scroll-driven active stop
  --------------------------------------------------------- */
  (function initTimeline() {
    var stops = Array.prototype.slice.call(document.querySelectorAll(".timeline__stop"));
    var fill = document.getElementById("timelineFill");
    if (!stops.length) return;

    function setActive(idx) {
      stops.forEach(function (s, i) { s.classList.toggle("is-active", i === idx); });
      if (fill) fill.style.width = (idx / (stops.length - 1)) * 100 + "%";
    }

    stops.forEach(function (s, i) {
      s.addEventListener("click", function () { setActive(i); });
    });

    ScrollTrigger.create({
      trigger: "#timeline",
      start: "top 65%",
      end: "bottom 40%",
      scrub: true,
      onUpdate: function (self) {
        var idx = Math.min(stops.length - 1, Math.round(self.progress * (stops.length - 1)));
        setActive(idx);
      }
    });
  })();

  /* ---------------------------------------------------------
     7. PROGRAMS CAROUSEL — snap + arrows + drag
  --------------------------------------------------------- */
  (function initCarousel() {
    var track = document.getElementById("programsTrack");
    var prev = document.getElementById("progPrev");
    var next = document.getElementById("progNext");
    if (!track) return;

    function step(dir) {
      var slide = track.querySelector(".program-slide");
      var gap = 26;
      var dist = (slide ? slide.getBoundingClientRect().width : 400) + gap;
      track.scrollBy({ left: dir * dist, behavior: "smooth" });
    }
    if (prev) prev.addEventListener("click", function () { step(-1); });
    if (next) next.addEventListener("click", function () { step(1); });

    var isDown = false, startX, scrollLeft;
    track.addEventListener("pointerdown", function (e) {
      isDown = true; track.setPointerCapture(e.pointerId);
      startX = e.clientX; scrollLeft = track.scrollLeft;
      track.style.scrollSnapType = "none";
    });
    track.addEventListener("pointermove", function (e) {
      if (!isDown) return;
      track.scrollLeft = scrollLeft - (e.clientX - startX);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) {
      track.addEventListener(ev, function () {
        isDown = false;
        track.style.scrollSnapType = "x mandatory";
      });
    });
  })();

  /* ---------------------------------------------------------
     8. COUNTERS
  --------------------------------------------------------- */
  function initCounters() {
    document.querySelectorAll(".highlight__num").forEach(function (el) {
      var target = parseFloat(el.getAttribute("data-count")) || 0;
      var proxy = { val: 0 };
      ScrollTrigger.create({
        trigger: el,
        start: "top 85%",
        once: true,
        onEnter: function () {
          gsap.to(proxy, {
            val: target,
            duration: 1.6,
            ease: "power2.out",
            onUpdate: function () { el.textContent = Math.round(proxy.val); }
          });
        }
      });
    });
  }

  /* ---------------------------------------------------------
     9. SCROLL REVEALS
  --------------------------------------------------------- */
  function initReveals() {
    var groups = [
      ".story__block", ".exp-row", ".g-tile", ".program-slide",
      ".timeline__head", ".programs__head", ".gallery__head",
      ".experience__head", ".affiliations__head", ".highlight",
      ".mun-teaser__card"
    ];
    groups.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        gsap.fromTo(el, { opacity: 0, y: 36 }, {
          opacity: 1, y: 0, duration: 0.9, ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%" }
        });
      });
    });

    gsap.fromTo(".statement__text, .statement__attr", { opacity: 0, y: 20 }, {
      opacity: 1, y: 0, duration: 1, ease: "power2.out", stagger: 0.15,
      scrollTrigger: { trigger: ".statement", start: "top 80%" }
    });

    gsap.fromTo(".cta h2, .cta p, .cta__btn", { opacity: 0, y: 24 }, {
      opacity: 1, y: 0, duration: 0.9, stagger: 0.12, ease: "power2.out",
      scrollTrigger: { trigger: ".cta", start: "top 75%" }
    });
  }

  /* ---------------------------------------------------------
     CURSOR-FOLLOW IMAGE (subtle parallax on hover)
  --------------------------------------------------------- */
  function initCursorParallax(containerSel, imgSel, strength) {
    var container = document.querySelector(containerSel);
    if (!container) return;
    var img = container.querySelector(imgSel);
    if (!img) return;
    container.addEventListener("mousemove", function (e) {
      var rect = container.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width - 0.5;
      var y = (e.clientY - rect.top) / rect.height - 0.5;
      img.style.transform = "scale(1.16) translate(" + (-x * strength) + "px," + (-y * strength) + "px)";
    });
    container.addEventListener("mouseleave", function () {
      img.style.transform = "scale(1.16) translate(0,0)";
    });
  }
  initCursorParallax(".mun-teaser__card", ".mun-teaser__media img", 42);

  /* ---------------------------------------------------------
     UTIL
  --------------------------------------------------------- */
  function debounce(fn, wait) {
    var t;
    return function () {
      clearTimeout(t);
      var args = arguments, ctx = this;
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  // Fallback: if images take too long, reveal UI anyway after 6s
  setTimeout(function () {
    if (loaded < FRAME_COUNT && preloader && !preloader.classList.contains("is-done")) {
      ready();
    }
  }, 6000);

})();
