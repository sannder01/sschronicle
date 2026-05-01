'use client';
// ╔═══════════════════════════════════════════════════════════════╗
// ║  CHRONICLE — AUTH PAGE  v2.0                                  ║
// ║  Aesthetic: Digital Ritual / High-tech Minimalism             ║
// ║  Stack: Next.js 14 · Vanilla CSS animations · Canvas API     ║
// ╚═══════════════════════════════════════════════════════════════╝

import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, useCallback, Suspense } from 'react';

// ─── Particle field ─────────────────────────────────────────────
function useParticleCanvas(canvasRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    let mouse = { x: -9999, y: -9999 };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', e => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    const N = 90;
    const particles = Array.from({ length: N }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.3,
      alpha: Math.random() * 0.5 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        // Mouse repulsion
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          const force = (120 - dist) / 120;
          p.vx += (dx / dist) * force * 0.08;
          p.vy += (dy / dist) * force * 0.08;
        }

        p.vx *= 0.98;
        p.vy *= 0.98;
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139,120,250,${p.alpha})`;
        ctx.fill();
      });

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(100,90,220,${(1 - d / 100) * 0.12})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);
}

// ─── Custom cursor ───────────────────────────────────────────────
function useCursor() {
  useEffect(() => {
    // Skip on touch devices
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const dot = document.createElement('div');
    const ring = document.createElement('div');
    dot.className = '__chr-cursor-dot';
    ring.className = '__chr-cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    let mx = 0, my = 0, rx = 0, ry = 0;
    let raf;
    const onMove = e => { mx = e.clientX; my = e.clientY; };
    window.addEventListener('mousemove', onMove);

    const loop = () => {
      dot.style.transform = `translate(${mx - 4}px, ${my - 4}px)`;
      rx += (mx - rx) * 0.12;
      ry += (my - ry) * 0.12;
      ring.style.transform = `translate(${rx - 20}px, ${ry - 20}px)`;
      raf = requestAnimationFrame(loop);
    };
    loop();

    // Use event delegation so dynamically added buttons/links are covered
    const onOver = e => {
      if (e.target.closest('button, a, [role=button]')) {
        ring.classList.add('__chr-cursor-hover');
      }
    };
    const onOut = e => {
      if (e.target.closest('button, a, [role=button]')) {
        ring.classList.remove('__chr-cursor-hover');
      }
    };
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      dot.remove();
      ring.remove();
    };
  }, []);
}

// ─── Main auth content ───────────────────────────────────────────
function AuthContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const canvasRef = useRef(null);
  const error = params.get('error');

  useParticleCanvas(canvasRef);
  useCursor();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/app');
  }, [status, router]);

  const handleGoogle = async () => {
    setLoading(true);
    await signIn('google', { callbackUrl: '/app' });
  };

  if (status === 'loading') return <LoadingScreen />;

  return (
    <>
      <style>{STYLES}</style>

      {/* Particle canvas */}
      <canvas ref={canvasRef} className="chr-canvas" />

      {/* Background orbs */}
      <div className="chr-orb chr-orb-1" />
      <div className="chr-orb chr-orb-2" />
      <div className="chr-orb chr-orb-3" />

      {/* Scan lines overlay */}
      <div className="chr-scanlines" />

      <main className="chr-auth">

        {/* Top bar */}
        <header className="chr-topbar">
          <div className="chr-logo">
            <LogoMark />
            <span className="chr-logo-text">Chronicle</span>
          </div>
          <div className="chr-topbar-badge">
            <span className="chr-pulse-dot" />
            <span>v2.0</span>
          </div>
        </header>

        {/* Hero section */}
        <section className="chr-hero">
          <div className="chr-eyebrow">— Personal Intelligence System</div>

          <h1 className="chr-headline">
            <span className="chr-headline-line chr-anim-1">Your tasks.</span>
            <span className="chr-headline-line chr-gradient chr-anim-2">Your ranks.</span>
            <span className="chr-headline-line chr-headline-faded chr-anim-3">Your chronicle.</span>
          </h1>

          <p className="chr-subline chr-anim-4">
            A task system engineered for focus.<br />
            Powered by XP. Driven by discipline.
          </p>

          {/* Auth card */}
          <div className="chr-card chr-anim-5">
            <div className="chr-card-header">
              <span className="chr-card-label">Authentication</span>
              <div className="chr-card-dots">
                <span /><span /><span />
              </div>
            </div>

            <div className="chr-card-body">
              {error && (
                <div className="chr-error">
                  <ErrorIcon />
                  <span>
                    {error === 'OAuthAccountNotLinked'
                      ? 'Email уже используется с другим провайдером'
                      : 'Что-то пошло не так — попробуй снова'}
                  </span>
                </div>
              )}

              <button
                className={`chr-btn-google ${loading ? 'chr-btn-loading' : ''}`}
                onClick={handleGoogle}
                disabled={loading}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
              >
                <span className="chr-btn-bg" />
                <span className="chr-btn-content">
                  {loading ? (
                    <>
                      <Spinner />
                      <span>Входим в систему...</span>
                    </>
                  ) : (
                    <>
                      <GoogleIcon />
                      <span>Продолжить с Google</span>
                      <ArrowIcon />
                    </>
                  )}
                </span>
              </button>

              <div className="chr-divider">
                <span />
                <span className="chr-divider-text">возможности системы</span>
                <span />
              </div>

              <ul className="chr-features">
                {FEATURES.map(({ icon, title, sub }) => (
                  <li key={title} className="chr-feature">
                    <div className="chr-feature-icon">{icon}</div>
                    <div>
                      <div className="chr-feature-title">{title}</div>
                      <div className="chr-feature-sub">{sub}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="chr-footer-note chr-anim-6">
            Войдя в систему, ты принимаешь условия использования Chronicle.
          </p>
        </section>

        {/* Rank ladder — decorative right side */}
        <aside className="chr-ranks" aria-hidden="true">
          {RANKS_PREVIEW.map(({ rank, label, color }, i) => (
            <div
              key={rank}
              className="chr-rank-row"
              style={{
                '--rank-color': color,
                animationDelay: `${i * 0.08}s`,
              }}
            >
              <span className="chr-rank-badge">{rank}</span>
              <span className="chr-rank-label">{label}</span>
            </div>
          ))}
        </aside>

      </main>
    </>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AuthContent />
    </Suspense>
  );
}

// ─── Sub-components ──────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="chr-loading">
      <style>{`
        @keyframes __chr_spin { to { transform: rotate(360deg); } }
        .chr-loading {
          min-height: 100vh;
          background: #030305;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .chr-loading-ring {
          width: 40px; height: 40px;
          border-radius: 50%;
          border: 2px solid rgba(139,120,250,0.15);
          border-top-color: #8B78FA;
          animation: __chr_spin 0.7s linear infinite;
        }
      `}</style>
      <div className="chr-loading-ring" />
    </div>
  );
}

function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="8" fill="url(#logo-grad)" />
      <path d="M8 10h12M8 14h8M8 18h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="28" y2="28">
          <stop stopColor="#7C6AF7" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 'auto' }}>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7" stroke="#FF4466" strokeWidth="1.5" />
      <path d="M8 5v4M8 11v.5" stroke="#FF4466" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: 16, height: 16,
      borderRadius: '50%',
      border: '2px solid rgba(255,255,255,0.2)',
      borderTopColor: '#fff',
      animation: '__chr_gspin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  );
}

// ─── Data ────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1l1.8 3.6L14 5.2l-3 2.9.7 4.1L8 10.2l-3.7 1.9.7-4.1L2 5.2l4.2-.6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    ),
    title: 'XP & Ранги',
    sub: 'Система Solo Leveling: E → SSS',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
    title: 'Папки и дедлайны',
    sub: 'Приоритеты, категории, сроки',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 8a6 6 0 1012 0A6 6 0 002 8z" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Telegram-уведомления',
    sub: 'Напоминания прямо в мессенджере',
  },
];

const RANKS_PREVIEW = [
  { rank: 'SSS', label: 'Sung Jin-Woo',    color: '#E040FB' },
  { rank: 'SS',  label: 'Shadow Sovereign', color: '#FFD700' },
  { rank: 'S',   label: 'Monarch',          color: '#E63946' },
  { rank: 'A',   label: 'Raid Commander',   color: '#F0A30A' },
  { rank: 'B',   label: 'Shadow Walker',    color: '#9F5CE8' },
  { rank: 'C',   label: 'Steel Mind',       color: '#5BC0DE' },
  { rank: 'D',   label: 'Iron Will',        color: '#5CB85C' },
  { rank: 'E',   label: 'Novice Hunter',    color: '#888888' },
];

// ─── Styles ──────────────────────────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --chr-bg:       #030305;
  --chr-surface:  #0a0a12;
  --chr-border:   rgba(255,255,255,0.07);
  --chr-border-hi: rgba(139,120,250,0.3);
  --chr-primary:  #8B78FA;
  --chr-primary-2: #A78BFA;
  --chr-text:     #F0EEFF;
  --chr-text-2:   #9994BB;
  --chr-text-3:   #4D4970;
  --chr-danger:   #FF4466;
  --chr-glow:     rgba(139,120,250,0.2);
}

html, body {
  background: var(--chr-bg);
  color: var(--chr-text);
  font-family: 'DM Sans', sans-serif;
  min-height: 100%;
  overflow-x: hidden;
  cursor: none;
}

/* ── Custom cursor ── */
.__chr-cursor-dot {
  position: fixed;
  top: 0; left: 0;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--chr-primary);
  pointer-events: none;
  z-index: 9999;
  mix-blend-mode: normal;
  transition: width 0.2s, height 0.2s, background 0.2s;
}
.__chr-cursor-ring {
  position: fixed;
  top: 0; left: 0;
  width: 40px; height: 40px;
  border-radius: 50%;
  border: 1px solid rgba(139,120,250,0.5);
  pointer-events: none;
  z-index: 9998;
  transition: border-color 0.3s, transform 0.2s, width 0.2s, height 0.2s, margin 0.2s;
}
.__chr-cursor-ring.__chr-cursor-hover {
  border-color: var(--chr-primary);
  width: 48px;
  height: 48px;
  margin: -4px;
}

/* ── Canvas ── */
.chr-canvas {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

/* ── Background orbs ── */
.chr-orb {
  position: fixed;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(80px);
}
.chr-orb-1 {
  top: -15%;
  left: -10%;
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(100,80,220,0.12) 0%, transparent 70%);
  animation: __chr_orb_drift1 20s ease-in-out infinite;
}
.chr-orb-2 {
  bottom: -20%;
  right: -5%;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 70%);
  animation: __chr_orb_drift2 25s ease-in-out infinite;
}
.chr-orb-3 {
  top: 50%;
  left: 40%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(80,60,180,0.07) 0%, transparent 70%);
  animation: __chr_orb_drift3 18s ease-in-out infinite;
}

@keyframes __chr_orb_drift1 {
  0%, 100% { transform: translate(0, 0); }
  33%  { transform: translate(30px, 20px); }
  66%  { transform: translate(-20px, 40px); }
}
@keyframes __chr_orb_drift2 {
  0%, 100% { transform: translate(0, 0); }
  40%  { transform: translate(-40px, -20px); }
  70%  { transform: translate(20px, -30px); }
}
@keyframes __chr_orb_drift3 {
  0%, 100% { transform: translate(0, 0); }
  50%  { transform: translate(-30px, 20px); }
}

/* ── Scanlines ── */
.chr-scanlines {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0,0,0,0.025) 2px,
    rgba(0,0,0,0.025) 4px
  );
}

/* ── Layout ── */
.chr-auth {
  position: relative;
  z-index: 2;
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: auto 1fr;
  grid-template-areas:
    "topbar"
    "hero";
  padding: 0 24px 48px;
  max-width: 1200px;
  margin: 0 auto;
}

@media (min-width: 1024px) {
  .chr-auth {
    grid-template-columns: 1fr 280px;
    grid-template-areas:
      "topbar topbar"
      "hero ranks";
    align-items: start;
    gap: 0 64px;
  }
}

/* ── Top bar ── */
.chr-topbar {
  grid-area: topbar;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px 0 48px;
  animation: __chr_fade_up 0.6s ease both;
}
.chr-logo {
  display: flex;
  align-items: center;
  gap: 10px;
}
.chr-logo-text {
  font-family: 'Syne', sans-serif;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--chr-text);
}
.chr-topbar-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(139,120,250,0.08);
  border: 1px solid rgba(139,120,250,0.2);
  border-radius: 99px;
  padding: 6px 14px;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  color: var(--chr-primary-2);
  letter-spacing: 0.04em;
}
.chr-pulse-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--chr-primary);
  box-shadow: 0 0 6px var(--chr-primary);
  animation: __chr_pulse 2s ease-in-out infinite;
}

/* ── Hero ── */
.chr-hero {
  grid-area: hero;
  display: flex;
  flex-direction: column;
}
.chr-eyebrow {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.15em;
  color: var(--chr-text-3);
  margin-bottom: 24px;
  animation: __chr_fade_up 0.5s 0.1s ease both;
}
.chr-headline {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 28px;
}
.chr-headline-line {
  font-family: 'Syne', sans-serif;
  font-size: clamp(44px, 7vw, 80px);
  font-weight: 800;
  line-height: 1.0;
  letter-spacing: -0.04em;
  color: var(--chr-text);
  display: block;
}
.chr-gradient {
  background: linear-gradient(135deg, #8B78FA 0%, #C4B5FD 50%, #8B78FA 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: __chr_gradient_shift 4s linear infinite;
}
.chr-headline-faded { color: var(--chr-text-3); }

@keyframes __chr_gradient_shift {
  0%   { background-position: 0% center; }
  100% { background-position: 200% center; }
}

.chr-subline {
  font-size: 16px;
  line-height: 1.7;
  color: var(--chr-text-2);
  margin-bottom: 48px;
}

/* ── Staggered entry animations ── */
.chr-anim-1 { animation: __chr_fade_up 0.6s 0.15s ease both; }
.chr-anim-2 { animation: __chr_fade_up 0.6s 0.25s ease both; }
.chr-anim-3 { animation: __chr_fade_up 0.6s 0.35s ease both; }
.chr-anim-4 { animation: __chr_fade_up 0.6s 0.45s ease both; }
.chr-anim-5 { animation: __chr_fade_up 0.6s 0.55s ease both; }
.chr-anim-6 { animation: __chr_fade_up 0.6s 0.65s ease both; }

@keyframes __chr_fade_up {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Auth card ── */
.chr-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--chr-border);
  border-radius: 20px;
  overflow: hidden;
  backdrop-filter: blur(20px);
  max-width: 440px;
  box-shadow:
    0 0 0 1px rgba(139,120,250,0.05),
    0 30px 80px rgba(0,0,0,0.5),
    inset 0 1px 0 rgba(255,255,255,0.05);
  transition: border-color 0.4s;
}
.chr-card:hover {
  border-color: var(--chr-border-hi);
}

.chr-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--chr-border);
  background: rgba(255,255,255,0.02);
}
.chr-card-label {
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--chr-text-3);
  text-transform: uppercase;
}
.chr-card-dots {
  display: flex;
  gap: 6px;
}
.chr-card-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,0.15);
}
.chr-card-dots span:first-child { background: rgba(255,80,80,0.5); }
.chr-card-dots span:nth-child(2) { background: rgba(255,200,50,0.5); }
.chr-card-dots span:last-child { background: rgba(80,220,80,0.5); }

.chr-card-body {
  padding: 28px 28px 32px;
}

/* ── Error ── */
.chr-error {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: rgba(255,68,102,0.08);
  border: 1px solid rgba(255,68,102,0.2);
  border-radius: 12px;
  padding: 14px 16px;
  font-size: 13px;
  color: rgba(255,180,180,0.9);
  margin-bottom: 20px;
  line-height: 1.5;
}

/* ── Google button ── */
.chr-btn-google {
  position: relative;
  width: 100%;
  border: 1px solid var(--chr-border);
  border-radius: 14px;
  padding: 15px 20px;
  cursor: pointer;
  background: rgba(255,255,255,0.04);
  color: var(--chr-text);
  font-family: 'DM Sans', sans-serif;
  font-size: 15px;
  font-weight: 500;
  overflow: hidden;
  transition: border-color 0.3s, transform 0.2s;
  margin-bottom: 24px;
}
.chr-btn-google:hover:not(:disabled) {
  border-color: rgba(255,255,255,0.18);
  transform: translateY(-2px);
}
.chr-btn-google:active {
  transform: translateY(0);
}
.chr-btn-google:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.chr-btn-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(139,120,250,0.06) 100%);
  opacity: 0;
  transition: opacity 0.3s;
}
.chr-btn-google:hover .chr-btn-bg { opacity: 1; }
.chr-btn-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 1;
}
@keyframes __chr_gspin { to { transform: rotate(360deg); } }

/* ── Divider ── */
.chr-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.chr-divider span:not(.chr-divider-text) {
  flex: 1;
  height: 1px;
  background: var(--chr-border);
}
.chr-divider-text {
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--chr-text-3);
  white-space: nowrap;
  font-family: 'DM Mono', monospace;
}

/* ── Features ── */
.chr-features {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.chr-feature {
  display: flex;
  align-items: center;
  gap: 14px;
}
.chr-feature-icon {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: rgba(139,120,250,0.08);
  border: 1px solid rgba(139,120,250,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--chr-primary-2);
  flex-shrink: 0;
}
.chr-feature-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--chr-text);
}
.chr-feature-sub {
  font-size: 12px;
  color: var(--chr-text-3);
  margin-top: 2px;
}

/* ── Footer note ── */
.chr-footer-note {
  font-size: 12px;
  color: var(--chr-text-3);
  margin-top: 20px;
  line-height: 1.5;
  max-width: 440px;
}

/* ── Rank ladder ── */
.chr-ranks {
  grid-area: ranks;
  display: none;
  flex-direction: column;
  gap: 4px;
  padding-top: 12px;
}

@media (min-width: 1024px) {
  .chr-ranks { display: flex; }
}

.chr-rank-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  border-radius: 12px;
  border: 1px solid transparent;
  opacity: 0;
  animation: __chr_fade_up 0.5s ease both;
  transition: background 0.2s, border-color 0.2s;
}
.chr-rank-row:hover {
  background: rgba(255,255,255,0.03);
  border-color: var(--chr-border);
}
.chr-rank-badge {
  font-family: 'DM Mono', monospace;
  font-size: 13px;
  font-weight: 500;
  color: var(--rank-color);
  text-shadow: 0 0 12px var(--rank-color);
  min-width: 32px;
  letter-spacing: 0.05em;
}
.chr-rank-label {
  font-size: 13px;
  color: var(--chr-text-2);
}

/* ── Pulse ── */
@keyframes __chr_pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 6px var(--chr-primary); }
  50%       { opacity: 0.5; box-shadow: 0 0 12px var(--chr-primary); }
}

@media (max-width: 640px) {
  .chr-headline-line { font-size: 40px; }
  .chr-card-body { padding: 20px 20px 24px; }
}
`;
