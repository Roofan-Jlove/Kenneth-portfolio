/* ============================================================
   PaulMUN page interactions (nav, timeline, counters, reveals)
   ============================================================ */
(function () {
  "use strict";

  gsap.registerPlugin(ScrollTrigger);

  /* ---------------------------------------------------------
     NAV — solid state + mobile drawer
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
     TIMELINE — click + scroll-driven active stop
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
     COUNTERS
  --------------------------------------------------------- */
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

  /* ---------------------------------------------------------
     SCROLL REVEALS
  --------------------------------------------------------- */
  [".story__block", ".exp-row", ".timeline__head", ".experience__head", ".highlight", ".committees__head", ".committee-card"].forEach(function (sel) {
    document.querySelectorAll(sel).forEach(function (el) {
      gsap.fromTo(el, { opacity: 0, y: 36 }, {
        opacity: 1, y: 0, duration: 0.9, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 88%" }
      });
    });
  });

  gsap.fromTo(".cta h2, .cta p, .cta .mun-hero__cta-row", { opacity: 0, y: 24 }, {
    opacity: 1, y: 0, duration: 0.9, stagger: 0.12, ease: "power2.out",
    scrollTrigger: { trigger: ".cta", start: "top 75%" }
  });

  /* ---------------------------------------------------------
     CURSOR-FOLLOW IMAGE (subtle parallax on hover)
  --------------------------------------------------------- */
  (function initCursorParallax() {
    var container = document.querySelector(".mun-hero");
    if (!container) return;
    var img = container.querySelector(".mun-hero__media img");
    if (!img) return;
    var strength = 50;
    container.addEventListener("mousemove", function (e) {
      var rect = container.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width - 0.5;
      var y = (e.clientY - rect.top) / rect.height - 0.5;
      img.style.transform = "scale(1.16) translate(" + (-x * strength) + "px," + (-y * strength) + "px)";
    });
    container.addEventListener("mouseleave", function () {
      img.style.transform = "scale(1.16) translate(0,0)";
    });
  })();

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

})();
