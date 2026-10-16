/* Naqsha pitch deck runtime.
   - Scales the 1920 x 1080 stage to any viewport.
   - Arrow keys, space, PageUp/PageDown, Home/End, click and swipe navigation.
   - URL hash per slide (#1 ... #N). ?static=1 renders the final frame with no motion (for PNG renders).
   - "P" toggles presenter notes. "F" toggles full screen.
   - Resolves every [data-asset] from the single manifest in assets.js. */
(function () {
  "use strict";

  var root = document.documentElement;
  var params = new URLSearchParams(location.search);
  var STATIC = params.has("static") && params.get("static") !== "0";
  var PRINT = params.has("print") && params.get("print") !== "0";
  if (PRINT) STATIC = true;
  if (STATIC) root.classList.add("static");
  if (PRINT) root.classList.add("print-mode");

  /* ---------- Status chips ----------
     Every .st.build chip marks a feature from the 18 Oct build that was not yet live when the deck was written.
     Once it is verified on the live URL, set DECK_SHIPPED = true in assets.js (or open with ?shipped=1)
     and every such chip reads "Live" instead. */
  var SHIPPED = params.get("shipped") === "1" || window.DECK_SHIPPED === true;
  if (SHIPPED) {
    document.querySelectorAll(".st.build:not(.legend)").forEach(function (el) {
      el.classList.remove("build"); el.classList.add("live");
      el.textContent = el.getAttribute("data-live") || "Live";
    });
    document.querySelectorAll("[data-shipped-text]").forEach(function (el) { el.textContent = el.getAttribute("data-shipped-text"); });
  }

  /* ---------- Assets from the manifest ---------- */
  var manifest = window.DECK_ASSETS || {};
  document.querySelectorAll("[data-asset]").forEach(function (el) {
    var key = el.getAttribute("data-asset");
    var a = manifest[key];
    if (!a) { console.warn("[deck] missing asset key:", key); return; }
    if (el.tagName.toLowerCase() === "image") {
      el.setAttribute("href", a.src);
    } else {
      el.setAttribute("src", a.src);
      if (!el.getAttribute("alt")) el.setAttribute("alt", a.alt || "");
      el.setAttribute("decoding", "sync");
      el.setAttribute("loading", "eager");
    }
  });

  /* ---------- Slides ---------- */
  var stage = document.querySelector(".stage");
  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var total = slides.length;
  var progress = document.querySelector(".progress");
  var notesPanel = document.getElementById("notes-panel");
  var current = -1;

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  slides.forEach(function (s, i) {
    s.setAttribute("aria-label", "Slide " + (i + 1) + " of " + total);
    s.querySelectorAll(".pg").forEach(function (p) { p.textContent = pad(i + 1) + " / " + pad(total); });
  });

  function fit() {
    if (PRINT) { stage.style.transform = "none"; return; }
    var w = window.innerWidth, h = window.innerHeight;
    var s = Math.min(w / 1920, h / 1080);
    var x = (w - 1920 * s) / 2, y = (h - 1080 * s) / 2;
    stage.style.transform = "translate(" + x + "px," + y + "px) scale(" + s + ")";
  }
  window.addEventListener("resize", fit);
  fit();

  /* ---------- Counting numbers ---------- */
  function fmt(v, el) {
    var dec = parseInt(el.getAttribute("data-dec") || "0", 10);
    var s = v.toFixed(dec);
    if (el.hasAttribute("data-comma")) s = Number(s).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return s;
  }
  function runCounts(slide) {
    var els = slide.querySelectorAll("[data-count]");
    els.forEach(function (el) {
      if (!el.hasAttribute("data-final")) el.setAttribute("data-final", el.textContent);
      var final = el.getAttribute("data-final");
      if (STATIC) { el.textContent = final; return; }
      var to = parseFloat(el.getAttribute("data-count"));
      var from = parseFloat(el.getAttribute("data-from") || "0");
      var delay = parseFloat(el.getAttribute("data-delay") || "0.25") * 1000;
      var dur = parseFloat(el.getAttribute("data-dur") || "1.3") * 1000;
      var t0 = null;
      el.textContent = fmt(from, el);
      if (el._raf) cancelAnimationFrame(el._raf);
      function step(t) {
        if (t0 === null) t0 = t + delay;
        var p = Math.max(0, Math.min(1, (t - t0) / dur));
        var e = 1 - Math.pow(1 - p, 4);
        el.textContent = p >= 1 ? final : fmt(from + (to - from) * e, el);
        if (p < 1) el._raf = requestAnimationFrame(step);
      }
      el._raf = requestAnimationFrame(step);
    });
  }

  /* ---------- Navigation ---------- */
  function go(n, opts) {
    n = Math.max(0, Math.min(total - 1, n));
    if (n === current && !(opts && opts.force)) return;
    if (current >= 0) slides[current].classList.remove("is-active");
    var s = slides[n];
    // restart CSS animations on re-entry
    void s.offsetWidth;
    s.classList.add("is-active");
    current = n;
    runCounts(s);
    if (progress) progress.style.width = ((n + 1) / total) * 100 + "%";
    var hash = "#" + (n + 1);
    if (location.hash !== hash) history.replaceState(null, "", location.pathname + location.search + hash);
    document.title = "Naqsha deck · " + (n + 1) + "/" + total;
    updateNotes();
  }
  function next() { go(current + 1); }
  function prev() { go(current - 1); }

  function fromHash() {
    var m = /^#(\d+)/.exec(location.hash);
    return m ? parseInt(m[1], 10) - 1 : 0;
  }
  window.addEventListener("hashchange", function () { go(fromHash()); });

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (k === "ArrowRight" || k === "ArrowDown" || k === " " || k === "PageDown" || k === "Enter") { e.preventDefault(); next(); }
    else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp" || k === "Backspace") { e.preventDefault(); prev(); }
    else if (k === "Home") { e.preventDefault(); go(0); }
    else if (k === "End") { e.preventDefault(); go(total - 1); }
    else if (k === "p" || k === "P") { document.body.classList.toggle("show-notes"); }
    else if (k === "f" || k === "F") {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      else document.exitFullscreen && document.exitFullscreen();
    }
  });

  document.addEventListener("click", function (e) {
    if (e.target.closest("a, button, #notes-panel")) return;
    if (window.getSelection && String(window.getSelection())) return;
    if (e.clientX < window.innerWidth * 0.25) prev(); else next();
  });

  var tx = null;
  document.addEventListener("touchstart", function (e) { tx = e.touches[0].clientX; }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (tx === null) return;
    var dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); }
    tx = null;
  });

  /* ---------- Presenter notes ---------- */
  function updateNotes() {
    if (!notesPanel) return;
    var n = slides[current].querySelector(".notes");
    var title = slides[current].getAttribute("data-title") || "";
    notesPanel.innerHTML =
      '<div class="meta"><span>' + pad(current + 1) + " / " + pad(total) + " · " + title +
      "</span><span>P to hide · arrows to move</span></div>" +
      (n ? n.innerHTML : "<p>No notes.</p>");
  }

  /* ---------- Print: show every slide in its final state ---------- */
  window.addEventListener("beforeprint", function () { root.classList.add("static"); slides.forEach(function (s) { s.querySelectorAll("[data-final]").forEach(function (el) { el.textContent = el.getAttribute("data-final"); }); }); });
  window.addEventListener("afterprint", function () { if (!STATIC) root.classList.remove("static"); });

  if (PRINT) {
    slides.forEach(function (s) { s.classList.add("is-active"); runCounts(s); });
    return;
  }
  go(fromHash(), { force: true });
})();
