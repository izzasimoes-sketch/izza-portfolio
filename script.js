/* ═══════════════════════════════════════════════
   IZZA SIMÕES — Portfolio Script
   GSAP ScrollTrigger + Typewriter Sound + Animations
════════════════════════════════════════════════ */

/* ── Lenis smooth scroll — silencio-style buttery scrolling ── */
const lenis = new Lenis({
  duration: 1.3,
  easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  wheelMultiplier: 0.9,
  touchMultiplier: 1.8,
  autoRaf: false, // We'll drive it via GSAP ticker
});

/* ── Sound Engine (Web Audio API — vintage mechanical typewriter) ── */
const Sound = (() => {
  let ctx = null;
  let muted = false;
  let keyBuffers  = [];   // 5 human-variation key samples
  let spaceBuffer = null;
  let paperBuffer = null;
  let ambientGain = null;
  let ambientStarted = false;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    keyBuffers  = buildKeyBuffers();
    spaceBuffer = buildSpaceBuffer();
    paperBuffer = buildPaperBuffer();
    startAmbient();
  }

  /* 5 distinct key-strike variants — subtle human variation */
  function buildKeyBuffers() {
    const clunkWeights = [1.10, 0.92, 1.04, 0.88, 1.00];
    const tailLengths  = [0.44, 0.52, 0.38, 0.50, 0.42];
    return clunkWeights.map((cw, idx) => {
      const rate   = ctx.sampleRate;
      const frames = Math.floor(rate * (0.074 + idx * 0.006));
      const buf    = ctx.createBuffer(1, frames, rate);
      const data   = buf.getChannelData(0);
      for (let i = 0; i < frames; i++) {
        const t      = i / frames;
        const clunk  = t < 0.022 ? (1 - t / 0.022) * cw       : 0;
        const trans  = t < 0.054 ? (1 - t / 0.054) * 0.62     : 0;
        const tail   = Math.pow(Math.max(0, 1 - t / tailLengths[idx]), 5) * 0.36;
        data[i] = (Math.random() * 2 - 1) * (clunk + trans + tail);
      }
      return buf;
    });
  }

  /* Heavier thud for spacebar / return */
  function buildSpaceBuffer() {
    const rate   = ctx.sampleRate;
    const frames = Math.floor(rate * 0.11);
    const buf    = ctx.createBuffer(1, frames, rate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      const t = i / frames;
      data[i] = (Math.random() * 2 - 1) * Math.pow(Math.max(0, 1 - t / 0.5), 4) * 1.15;
    }
    return buf;
  }

  /* SFX_PAPER_MOVEMENT — soft paper rustle */
  function buildPaperBuffer() {
    const rate   = ctx.sampleRate;
    const frames = Math.floor(rate * 0.22);
    const buf    = ctx.createBuffer(1, frames, rate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      const t   = i / frames;
      const env = t < 0.12
        ? Math.pow(t / 0.12, 0.5)
        : Math.pow(1 - (t - 0.12) / 0.88, 2.2);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    return buf;
  }

  /* AMBIENT_ANALOG_ROOM_TONE — tape hiss, almost imperceptible */
  function startAmbient() {
    if (ambientStarted) return;
    ambientStarted = true;

    const rate   = ctx.sampleRate;
    const frames = rate * 4; // 4-second looping noise
    const buf    = ctx.createBuffer(1, frames, rate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop   = true;

    const lp = ctx.createBiquadFilter();
    lp.type            = 'lowpass';
    lp.frequency.value = 850;
    lp.Q.value         = 0.3;

    ambientGain              = ctx.createGain();
    ambientGain.gain.value   = muted ? 0 : 0.011;

    src.connect(lp);
    lp.connect(ambientGain);
    ambientGain.connect(ctx.destination);
    src.start();
  }

  function playClick(isSpace = false) {
    if (muted || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const buf = isSpace
      ? spaceBuffer
      : keyBuffers[Math.floor(Math.random() * keyBuffers.length)];

    const src = ctx.createBufferSource();
    src.buffer             = buf;
    src.playbackRate.value = 0.65 + Math.random() * 0.32;

    const bp = ctx.createBiquadFilter();
    bp.type            = 'bandpass';
    bp.frequency.value = 580 + Math.random() * 440;
    bp.Q.value         = 0.75;

    const shelf = ctx.createBiquadFilter();
    shelf.type            = 'highshelf';
    shelf.frequency.value = 3000;
    shelf.gain.value      = 4;

    const gain = ctx.createGain();
    gain.gain.value = isSpace ? 0.28 : 0.19 + Math.random() * 0.10;

    src.connect(bp);
    bp.connect(shelf);
    shelf.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  /* Carriage-return "ding" — three-partial bell */
  function playBell() {
    if (muted || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    [[880, 0.13], [1108, 0.07], [1480, 0.04]].forEach(([freq, amp]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type            = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.4);
    });
  }

  /* SFX_PAPER_MOVEMENT — soft rustle for transitions */
  function playPaper() {
    if (muted || !ctx || !paperBuffer) return;
    if (ctx.state === 'suspended') ctx.resume();

    const src = ctx.createBufferSource();
    src.buffer             = paperBuffer;
    src.playbackRate.value = 0.5 + Math.random() * 0.55;

    const lp = ctx.createBiquadFilter();
    lp.type            = 'lowpass';
    lp.frequency.value = 2600 + Math.random() * 900;

    const gain = ctx.createGain();
    gain.gain.value = 0.065 + Math.random() * 0.035;

    src.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  function toggleMute() {
    muted = !muted;
    if (ambientGain) ambientGain.gain.value = muted ? 0 : 0.011;
    return muted;
  }

  return { init, playClick, playBell, playPaper, toggleMute };
})();

/* ── Mute Button ── */
const muteBtn   = document.getElementById('mute-btn');
const iconSound = document.getElementById('icon-sound');
const iconMuted = document.getElementById('icon-muted');

muteBtn.addEventListener('click', () => {
  Sound.init();
  const nowMuted = Sound.toggleMute();
  iconSound.style.display = nowMuted ? 'none'  : '';
  iconMuted.style.display = nowMuted ? ''      : 'none';
});

/* ── Scroll Progress Bar (driven by Lenis, not native scroll) ── */
const progressBar = document.getElementById('progress-bar');

/* ── GSAP Setup ── */
gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════════════════
   HERO — Paper feeds out of typewriter on scroll
════════════════════════════════════════════════ */

const VH = window.innerHeight;

/* ── Phase 1: typewriter types content on load ── */
function typeHeroContent() {
  const name    = document.querySelector('.hero-name');
  const role    = document.querySelector('.hero-role');
  const tagline = document.querySelector('.hero-tagline');
  const cursor  = document.querySelector('.hero-cursor');

  function wrapChars(el) {
    el.innerHTML = el.innerHTML.replace(
      /(<[^>]*>)|([^<>])/g,
      (_, tag, char) => tag ? tag : `<span class="hchar" style="opacity:0">${char}</span>`
    );
  }
  [name, role, tagline].forEach(wrapChars);

  const tl = gsap.timeline({ delay: 0.5 });

  // Reveal paper content
  tl.to('.paper-content', { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' });

  // Type name
  tl.to(name.querySelectorAll('.hchar'), {
    opacity: 1, duration: 0,
    stagger: { each: 0.09, onStart() { Sound.init(); Sound.playClick(); } }
  });
  tl.add(() => Sound.playClick(true), '+=0.05');

  // Type role
  tl.to(role.querySelectorAll('.hchar'), {
    opacity: 1, duration: 0,
    stagger: { each: 0.036, onStart() { Sound.playClick(); } }
  }, '+=0.2');
  tl.add(() => Sound.playBell(), '+=0.06');

  // Type tagline
  tl.to(tagline.querySelectorAll('.hchar'), {
    opacity: 1, duration: 0,
    stagger: { each: 0.03, onStart() { Sound.playClick(); } }
  }, '+=0.3');
  tl.add(() => Sound.playBell(), '+=0.1');

  tl.to(cursor, { opacity: 1, duration: 0 });
  tl.to('.scroll-hint', { opacity: 1, duration: 0.5 }, '+=0.7');
}

typeHeroContent();

/* ── Phase 2: Scroll-driven paper expansion ── */
const paperTl = gsap.timeline({ paused: true });

// A — Paper grows tall (feeds out of platen upward)
paperTl.to('.paper-roll', {
  height: VH * 1.15,
  ease: 'none',
  duration: 0.6
});

// B — Typewriter slides off bottom
paperTl.to('.typewriter-img', {
  yPercent: 85,
  opacity: 0,
  ease: 'power1.in',
  duration: 0.35
}, 0.42);

// C — Paper expands horizontally to fill full width
paperTl.to('.paper-roll', {
  width: '100%',
  left: '0%',
  borderRadius: 0,
  ease: 'power2.inOut',
  duration: 0.22
}, 0.62);

// D — Snap to full viewport coverage
paperTl.to('.paper-roll', {
  bottom: '0%',
  height: '100%',
  ease: 'none',
  duration: 0.18
}, 0.82);

ScrollTrigger.create({
  trigger: '#hero',
  pin: true,
  pinSpacing: true,
  start: 'top top',
  end: '+=230%',
  scrub: 0.8,
  animation: paperTl,
  onLeave() {
    gsap.to('.scroll-hint', { opacity: 0, duration: 0.15 });
  }
});

/* ── Typewriter Text Reveal (scroll-triggered) ── */
function initTypedLines() {
  document.querySelectorAll('.typed-line').forEach(line => {
    // Wrap chars
    const original = line.innerHTML;
    let wrapped = '';
    let inTag = false;
    for (const ch of original) {
      if (ch === '<') { inTag = true; wrapped += ch; continue; }
      if (ch === '>') { inTag = false; wrapped += ch; continue; }
      if (inTag) { wrapped += ch; continue; }
      wrapped += `<span class="char">${ch}</span>`;
    }
    line.innerHTML = wrapped;

    const chars = line.querySelectorAll('.char');
    if (!chars.length) return;

    ScrollTrigger.create({
      trigger: line,
      start: 'top 86%',
      once: true,
      onEnter() {
        gsap.to(chars, {
          opacity: 1,
          duration: 0,
          stagger: {
            each: 0.028,
            onStart() { Sound.playClick(); }
          },
          onComplete() { Sound.playBell(); }
        });
      }
    });
  });
}

initTypedLines();

/* ── Photo Collage Paste-in ── */
function initPhotos() {
  document.querySelectorAll('.photo-wrap').forEach(photo => {
    const rotate  = photo.dataset.rotate || '0deg';
    const delay   = parseFloat(photo.dataset.delay || '0');

    // Set initial state via GSAP (avoids CSS transform conflicts)
    gsap.set(photo, { opacity: 0, scale: 0.85, rotation: parseFloat(rotate), y: 20 });

    ScrollTrigger.create({
      trigger: photo,
      start: 'top 88%',
      once: true,
      onEnter() {
        gsap.to(photo, {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.55,
          delay,
          ease: 'back.out(1.4)',
          onStart() {
            // Tape-slap sound effect (repurpose click with lower pitch)
            Sound.playClick();
          }
        });
      }
    });
  });
}

initPhotos();

/* ── Project Cards Reveal ── */
function initCards() {
  document.querySelectorAll('.project-card').forEach((card, i) => {
    ScrollTrigger.create({
      trigger: card,
      start: 'top 90%',
      once: true,
      onEnter() {
        gsap.to(card, {
          opacity: 1,
          y: 0,
          duration: 0.6,
          delay: i * 0.08,
          ease: 'power2.out'
        });
      }
    });
  });
}

initCards();

/* (hero parallax handled by ScrollTrigger pin animation above) */

/* ── Envelope Animation ── */
function initEnvelope() {
  const scene   = document.getElementById('envelope-scene');
  const letter  = document.getElementById('letter');
  const flap    = document.getElementById('env-flap');
  const stamp   = document.getElementById('env-stamp');
  const ctaBtn  = document.getElementById('cta-btn');

  if (!scene) return;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: scene,
      start: 'top 70%',
      once: true
    }
  });

  // 1. Letter slides down into envelope
  tl.fromTo(letter,
    { y: -180, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.7, ease: 'power2.inOut' }
  );

  // 2. Flap opens
  tl.to(flap, {
    rotateX: -180,
    duration: 0.5,
    ease: 'power2.inOut',
    transformOrigin: 'top center',
    transformStyle: 'preserve-3d'
  }, '+=0.1');

  // 3. Letter folds and goes in (shrinks)
  tl.to(letter, {
    scaleY: 0,
    y: 60,
    duration: 0.45,
    ease: 'power2.in'
  }, '+=0.2');

  // 4. Flap closes
  tl.to(flap, {
    rotateX: 0,
    duration: 0.5,
    ease: 'power2.inOut',
    transformOrigin: 'top center'
  }, '-=0.1');

  // 5. Stamp appears with thump
  tl.to(stamp, {
    opacity: 1,
    scale: 1,
    rotation: -5,
    duration: 0.25,
    ease: 'back.out(2)',
    onStart() { Sound.playBell(); }
  }, '+=0.15');

  // 6. CTA button appears
  tl.to(ctaBtn, {
    opacity: 1,
    y: 0,
    duration: 0.5,
    ease: 'power2.out',
    onStart() {
      ctaBtn.classList.add('visible');
    }
  }, '+=0.2');
}

initEnvelope();

/* ── Chapter markers fade in ── */
document.querySelectorAll('.chapter-marker').forEach(marker => {
  gsap.fromTo(marker,
    { opacity: 0, x: -20 },
    {
      opacity: 1, x: 0, duration: 0.7, ease: 'power2.out',
      scrollTrigger: { trigger: marker, start: 'top 85%', once: true }
    }
  );
});

/* ── Dark section parallax background ── */
gsap.to('#work', {
  backgroundPositionY: '30%',
  ease: 'none',
  scrollTrigger: {
    trigger: '#work',
    start: 'top bottom',
    end: 'bottom top',
    scrub: true
  }
});

/* ── Lenis → ScrollTrigger sync + progress bar (GSAP ticker drives Lenis) ── */
lenis.on('scroll', ({ scroll, limit }) => {
  ScrollTrigger.update();
  progressBar.style.width = (scroll / limit * 100) + '%';
});
gsap.ticker.add((time) => { lenis.raf(time * 1000); });
gsap.ticker.lagSmoothing(0);

/* ── Refresh ScrollTrigger after fonts load (prevents misaligned triggers) ── */
document.fonts.ready.then(() => { ScrollTrigger.refresh(); });

/* ── Refresh ScrollTrigger on resize (mobile rotation / window resize) ── */
let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => { ScrollTrigger.refresh(); }, 250);
}, { passive: true });

/* ── Chapter section entrances — silencio-style panel slide ── */
gsap.utils.toArray('.chapter').forEach(section => {
  gsap.fromTo(section,
    { opacity: 0, y: 48 },
    {
      opacity: 1,
      y: 0,
      duration: 0.85,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: section,
        start: 'top 92%',
        once: true
      }
    }
  );
});

/* ── Marquee strip entrances — with paper sound ── */
gsap.utils.toArray('.marquee-strip').forEach(strip => {
  gsap.fromTo(strip,
    { scaleX: 0, transformOrigin: 'left center' },
    {
      scaleX: 1,
      duration: 0.6,
      ease: 'power2.inOut',
      scrollTrigger: {
        trigger: strip,
        start: 'top 96%',
        once: true,
        onEnter() { Sound.playPaper(); }
      }
    }
  );
});

/* ═══════════════════════════════════════════════
   UNIVERSE_EXPANSION_ZOOM
   Sertão → World — ripple rings + text reveal
════════════════════════════════════════════════ */
function UNIVERSE_EXPANSION_ZOOM() {
  const bridge = document.getElementById('universe-bridge');
  if (!bridge) return;

  const rings = bridge.querySelectorAll('.u-ring');
  const text  = bridge.querySelector('.universe-text');

  gsap.set(rings, { scale: 0, opacity: 0 });
  gsap.set(text,  { opacity: 0, y: 10 });

  ScrollTrigger.create({
    trigger: bridge,
    start: 'top 78%',
    once: true,
    onEnter() {
      Sound.playPaper();
      const tl = gsap.timeline();

      // Rings expand outward like a stone in water
      rings.forEach((ring, i) => {
        tl.fromTo(ring,
          { scale: 0, opacity: 0.7 },
          { scale: 16 + i * 10, opacity: 0, duration: 1.9, ease: 'power2.out' },
          i * 0.16
        );
      });

      // Text fades in then gently out
      tl.to(text, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }, 0.18);
      tl.to(text, { opacity: 0, duration: 0.45, ease: 'power2.in' }, 1.1);
    }
  });
}

UNIVERSE_EXPANSION_ZOOM();

/* ═══════════════════════════════════════════════
   FILM_GRAIN_LOOP
   Animated canvas grain overlay — ~30fps, half-res for perf
════════════════════════════════════════════════ */
function FILM_GRAIN_LOOP() {
  const canvas = document.createElement('canvas');
  canvas.id = 'film-grain';
  Object.assign(canvas.style, {
    position:      'fixed',
    top:           '0',
    left:          '0',
    width:         '100%',
    height:        '100%',
    pointerEvents: 'none',
    zIndex:        '850',
    opacity:       '0.036',
    mixBlendMode:  'overlay'
  });
  document.body.appendChild(canvas);

  const g = canvas.getContext('2d');
  let w, h;

  function resize() {
    // Half-res for performance — still effective at overlay blend
    w = canvas.width  = Math.ceil(window.innerWidth  / 2);
    h = canvas.height = Math.ceil(window.innerHeight / 2);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  let tick = 0;
  (function grain() {
    // Re-render every 2nd frame (~30fps) for performance
    if (++tick % 2 === 0) {
      const img  = g.createImageData(w, h);
      const data = img.data;
      for (let i = 0; i < data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }
    requestAnimationFrame(grain);
  })();
}

FILM_GRAIN_LOOP();
