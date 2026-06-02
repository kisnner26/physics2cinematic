// animations.js — GSAP sequences

// ── LANDING ────────────────────────────────────────────────────────────────
export function animateLanding() {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.to('.landing-eyebrow',  { opacity: 1, duration: 0.6, delay: 0.2 })
    .to('#lt1',              { opacity: 1, y: 0, duration: 0.8 }, '-=0.2')
    .to('#lt2',              { opacity: 1, y: 0, duration: 0.8 }, '-=0.5')
    .to('.landing-desc',     { opacity: 1, duration: 0.7 }, '-=0.4')
    .to('.landing-formula',  { opacity: 1, duration: 0.6 }, '-=0.3')
    .to('.landing-cta',      { opacity: 1, duration: 0.5 }, '-=0.3')
    .to('.landing-credits',  { opacity: 1, duration: 0.4 }, '-=0.3');
}

// ── TRANSICIÓN LANDING → APP ───────────────────────────────────────────────
export function transitionToApp(onComplete) {
  const tl = gsap.timeline({ onComplete });
  tl.to('.landing-content', { opacity: 0, y: -20, duration: 0.4, ease: 'power2.in' })
    .to('.landing', { opacity: 0, duration: 0.35, ease: 'power2.in' }, '-=0.1');
}

// ── ANIMACIÓN INICIAL DEL APP ─────────────────────────────────────────────
export function animateAppIn() {
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.fromTo('.site-header', { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 })
    .fromTo('.controls-bar', { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, '-=0.4')
    .fromTo('#scene-realistic canvas', { opacity: 0 }, { opacity: 1, duration: 0.5 }, '-=0.3');
}

// ── MODO SWITCH ───────────────────────────────────────────────────────────
export function animateModeSwitch(incoming, outgoing) {
  gsap.to(outgoing, { opacity: 0, duration: 0.2, ease: 'power2.in',
    onComplete: () => outgoing.classList.remove('active') });
  gsap.fromTo(incoming,
    { opacity: 0 },
    { opacity: 1, duration: 0.3, ease: 'power2.out', delay: 0.15,
      onStart: () => incoming.classList.add('active') });
}

// ── IMPACTO ───────────────────────────────────────────────────────────────
export function animateImpact() {
  // Flash de papel
  const flash = document.createElement('div');
  Object.assign(flash.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(26,58,110,0.08)',
    zIndex: '200', pointerEvents: 'none'
  });
  document.body.appendChild(flash);
  gsap.to(flash, { opacity: 0, duration: 0.8, ease: 'power2.out',
    onComplete: () => flash.remove() });

  // Shake del stage
  gsap.fromTo('#stage', { x: 0 },
    { x: 4, duration: 0.04, ease: 'none', yoyo: true, repeat: 8,
      onComplete: () => gsap.set('#stage', { x: 0 }) });

  // Impact banner
  const banner = document.getElementById('impact-banner');
  if (banner) {
    banner.classList.remove('hidden');
    gsap.fromTo(banner,
      { opacity: 0, scale: 0.85 },
      { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(1.5)' });
    setTimeout(() => {
      gsap.to(banner, { opacity: 0, duration: 0.4, ease: 'power2.in',
        onComplete: () => banner.classList.add('hidden') });
    }, 2000);
  }
}

// ── FIRE BUTTON ───────────────────────────────────────────────────────────
export function animateFireButton(btn) {
  gsap.fromTo(btn,
    { scale: 0.93 },
    { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' });
}

// ── HEADER ────────────────────────────────────────────────────────────────
export function animateHeader() {}    // no-op (lo maneja animateAppIn)

// ── COMPAT ────────────────────────────────────────────────────────────────
export function animateFormulaPanels() {}
export function animateMatrixRow() {}
export function pulseOrange(el) {}
