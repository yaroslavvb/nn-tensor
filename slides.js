/* ============================================================
   Shared slide-deck engine for nn-tensor paper decks.
   Expects: <main class="deck"> with <section class="slide"> children,
   and a .deck-chrome bar containing #deck-fill, #deck-counter,
   #deck-prev, #deck-next. Optional .frag elements reveal stepwise.
   Navigation: ← → space PgUp/PgDn Home/End, buttons, swipe, #hash.
   ============================================================ */
"use strict";

(function deckEngine() {
  const slides = Array.from(document.querySelectorAll(".deck .slide"));
  if (!slides.length) return;
  const fill = document.getElementById("deck-fill");
  const counter = document.getElementById("deck-counter");
  let cur = -1;

  const fragsOf = s => Array.from(s.querySelectorAll(".frag"));

  function clampIdx(i) { return Math.max(0, Math.min(slides.length - 1, i)); }

  function show(i, revealAllFrags) {
    i = clampIdx(i);
    if (i === cur) return;
    cur = i;
    slides.forEach((s, j) => s.classList.toggle("active", j === i));
    fragsOf(slides[i]).forEach(f => f.classList.toggle("on", !!revealAllFrags));
    if (fill) fill.style.width = ((i + 1) / slides.length * 100).toFixed(1) + "%";
    if (counter) counter.textContent = `${i + 1} / ${slides.length}`;
    if (location.hash !== "#" + (i + 1)) history.replaceState(null, "", "#" + (i + 1));
    slides[i].scrollTop = 0;
  }

  function next() {
    const pending = fragsOf(slides[cur]).find(f => !f.classList.contains("on"));
    if (pending) { pending.classList.add("on"); return; }
    show(cur + 1, false);
  }
  function prev() {
    const on = fragsOf(slides[cur]).filter(f => f.classList.contains("on"));
    if (on.length) { on[on.length - 1].classList.remove("on"); return; }
    show(cur - 1, true);
  }

  document.addEventListener("keydown", e => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    switch (e.key) {
      case "ArrowRight": case " ": case "PageDown": e.preventDefault(); next(); break;
      case "ArrowLeft": case "PageUp": e.preventDefault(); prev(); break;
      case "Home": e.preventDefault(); show(0, false); break;
      case "End": e.preventDefault(); show(slides.length - 1, true); break;
    }
  });
  const bp = document.getElementById("deck-prev"), bn = document.getElementById("deck-next");
  if (bp) bp.addEventListener("click", prev);
  if (bn) bn.addEventListener("click", next);

  // swipe
  let tx = null;
  document.addEventListener("touchstart", e => { tx = e.changedTouches[0].clientX; }, { passive: true });
  document.addEventListener("touchend", e => {
    if (tx == null) return;
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 60) (dx < 0 ? next() : prev());
    tx = null;
  }, { passive: true });

  window.addEventListener("hashchange", () => {
    const k = parseInt(location.hash.slice(1), 10);
    if (!isNaN(k)) show(k - 1, false);
  });

  const k0 = parseInt((location.hash || "#1").slice(1), 10);
  show(isNaN(k0) ? 0 : k0 - 1, false);
})();
