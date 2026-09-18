/**
 * Lightweight, 60fps HTML5 Canvas Confetti Burst
 * Triggers delightful celebratory particles without heavy external libraries.
 */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  vRot: number;
  alpha: number;
}

const BRAND_PALETTE = ['#4f46e5', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6'];

export function triggerConfetti(options: { count?: number; durationMs?: number } = {}) {
  if (typeof window === 'undefined') return;

  // Guard dla preferencji redukcji ruchu — nie odpalamy animacji canvas cząstek confetti
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const count = options.count || 80;
  const durationMs = options.durationMs || 2500;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    document.body.removeChild(canvas);
    return;
  }

  const particles: Particle[] = [];
  const startX = window.innerWidth / 2;
  const startY = window.innerHeight * 0.4;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
    const speed = 4 + Math.random() * 8;

    particles.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      color: BRAND_PALETTE[Math.floor(Math.random() * BRAND_PALETTE.length)],
      size: 5 + Math.random() * 5,
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 10,
      alpha: 1,
    });
  }

  const startTime = performance.now();

  function animate(now: number) {
    const elapsed = now - startTime;
    const progress = elapsed / durationMs;

    if (progress >= 1) {
      if (document.body.contains(canvas)) {
        document.body.removeChild(canvas);
      }
      return;
    }

    ctx?.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2; // gravity
      p.rotation += p.vRot;
      p.alpha = Math.max(0, 1 - progress);

      if (!ctx) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }

    window.requestAnimationFrame(animate);
  }

  window.requestAnimationFrame(animate);
}
