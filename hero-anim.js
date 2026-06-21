/* Animation d'entrée du hero (GSAP).
   Dégrade proprement : si GSAP n'est pas chargé (hors ligne / échec réseau),
   on ne touche à rien et le « reveal » natif du site prend le relais.
   Respecte prefers-reduced-motion : contenu visible, aucune animation. */
(function () {
  var hero = document.querySelector(".hero");
  if (!hero || !window.gsap) return;

  // On neutralise le reveal natif sur le hero pour éviter un double effet :
  // les éléments deviennent visibles tout de suite, puis GSAP joue l'entrée.
  hero.querySelectorAll(".reveal").forEach(function (el) {
    el.classList.add("in");
    el.style.transition = "none";
  });

  var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (RM) return; // mouvement réduit : on s'arrête, tout reste visible

  var tl = window.gsap.timeline({ defaults: { ease: "power3.out" } });
  function step(sel, vars, pos) {
    var els = hero.querySelectorAll(sel);
    if (els.length) tl.from(els, vars, pos);
  }

  step(".eyebrow", { y: 16, autoAlpha: 0, duration: 0.55 });
  step("h1", { y: 30, autoAlpha: 0, duration: 0.8 }, "-=0.25");
  step("h1 .hl", { color: "#ffffff", duration: 0.7 }, "-=0.45"); // balayage blanc -> rouge de marque
  step(".wrap > p", { y: 20, autoAlpha: 0, duration: 0.7 }, "-=0.5");
  step(".paths > *", { y: 34, autoAlpha: 0, duration: 0.7, stagger: 0.12 }, "-=0.4");
  step(".scroll-cue", { autoAlpha: 0, duration: 0.6 }, "-=0.2");
})();
