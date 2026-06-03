'use client'
// ╔═══════════════════════════════════════════════════════════════════╗
// ║  CHRONICLE — CHARACTER PANEL                                      ║
// ║  Animated rank character with XP progression                     ║
// ╚═══════════════════════════════════════════════════════════════════╝

import { useMemo } from 'react'

const RANKS = [
  { rank: 'E',   min: 0,    max: 100,      color: '#888888', glow: '#444444', label: 'Novice Hunter',     aura: 'gray' },
  { rank: 'D',   min: 100,  max: 300,      color: '#5CB85C', glow: '#2d7a30', label: 'Iron Will',         aura: 'green' },
  { rank: 'C',   min: 300,  max: 600,      color: '#5BC0DE', glow: '#1a7fa0', label: 'Steel Mind',        aura: 'cyan' },
  { rank: 'B',   min: 600,  max: 1000,     color: '#9F5CE8', glow: '#6c35b0', label: 'Shadow Walker',     aura: 'purple' },
  { rank: 'A',   min: 1000, max: 1500,     color: '#F0A30A', glow: '#b07000', label: 'Raid Commander',    aura: 'gold' },
  { rank: 'S',   min: 1500, max: 2200,     color: '#E63946', glow: '#900020', label: 'Monarch',           aura: 'red' },
  { rank: 'SS',  min: 2200, max: 3000,     color: '#FFD700', glow: '#CC8800', label: 'Shadow Sovereign',  aura: 'bright-gold' },
  { rank: 'SSS', min: 3000, max: Infinity, color: '#E040FB', glow: '#9900CC', label: 'Sung Jin-Woo',      aura: 'cosmic' },
]

export function getRank(xp) {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (xp >= RANKS[i].min) return RANKS[i]
  }
  return RANKS[0]
}

function xpProgress(xp) {
  const r = getRank(xp)
  if (r.max === Infinity) return 100
  return Math.round(((xp - r.min) / (r.max - r.min)) * 100)
}

// ── SVG character layers by rank tier (0-7)
function CharacterSVG({ rankIndex, color, glow }) {
  // Armor and aura intensity increases with rank
  const armored = rankIndex >= 3
  const heavy   = rankIndex >= 5
  const cosmic  = rankIndex >= 7

  return (
    <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: 120 }}>
      <defs>
        <radialGradient id={`cg-aura-${rankIndex}`} cx="50%" cy="70%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity={heavy ? 0.45 : armored ? 0.25 : 0.12} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <filter id={`cg-glow-${rankIndex}`}>
          <feGaussianBlur stdDeviation={heavy ? 3 : 1.5} result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id={`cg-body-${rankIndex}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={armored ? 0.8 : 0.5} />
          <stop offset="100%" stopColor={glow} stopOpacity={armored ? 0.9 : 0.6} />
        </linearGradient>
      </defs>

      {/* Aura / ground glow */}
      <ellipse cx="50" cy="125" rx="34" ry="10"
        fill={`url(#cg-aura-${rankIndex})`}
        className="char-aura"
        style={{ animationDuration: heavy ? '1.8s' : '3s' }}
      />

      {/* Cosmic particles (SSS only) */}
      {cosmic && [
        [20, 30], [78, 22], [15, 80], [84, 70], [50, 15],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={1.5}
          fill={color}
          className="char-particle"
          style={{ animationDelay: `${i * 0.4}s` }}
        />
      ))}

      {/* ── Body ── */}

      {/* Legs */}
      <rect x="37" y="100" width="11" height="28" rx="4"
        fill={`url(#cg-body-${rankIndex})`}
        filter={armored ? `url(#cg-glow-${rankIndex})` : undefined}
      />
      <rect x="52" y="100" width="11" height="28" rx="4"
        fill={`url(#cg-body-${rankIndex})`}
        filter={armored ? `url(#cg-glow-${rankIndex})` : undefined}
      />

      {/* Armor boots (rank >= 3) */}
      {armored && <>
        <rect x="34" y="118" width="17" height="10" rx="4"
          fill={color} opacity="0.7"
          filter={`url(#cg-glow-${rankIndex})`}
        />
        <rect x="49" y="118" width="17" height="10" rx="4"
          fill={color} opacity="0.7"
          filter={`url(#cg-glow-${rankIndex})`}
        />
      </>}

      {/* Torso */}
      <rect x="33" y="65" width="34" height="38" rx="8"
        fill={`url(#cg-body-${rankIndex})`}
        filter={armored ? `url(#cg-glow-${rankIndex})` : undefined}
      />

      {/* Chest plate (rank >= 2) */}
      {rankIndex >= 2 && (
        <rect x="38" y="70" width="24" height="22" rx="5"
          fill={color} opacity={armored ? 0.6 : 0.3}
          filter={armored ? `url(#cg-glow-${rankIndex})` : undefined}
        />
      )}

      {/* Emblem (rank >= 4) */}
      {rankIndex >= 4 && (
        <polygon points="50,74 53,81 60,81 55,86 57,93 50,89 43,93 45,86 40,81 47,81"
          fill={color}
          opacity="0.9"
          filter={`url(#cg-glow-${rankIndex})`}
        />
      )}

      {/* Arms */}
      <rect x="18" y="66" width="14" height="28" rx="5"
        fill={`url(#cg-body-${rankIndex})`}
        filter={armored ? `url(#cg-glow-${rankIndex})` : undefined}
      />
      <rect x="68" y="66" width="14" height="28" rx="5"
        fill={`url(#cg-body-${rankIndex})`}
        filter={armored ? `url(#cg-glow-${rankIndex})` : undefined}
      />

      {/* Pauldrons (rank >= 3) */}
      {armored && <>
        <ellipse cx="24" cy="67" rx="9" ry="7"
          fill={color} opacity="0.75"
          filter={`url(#cg-glow-${rankIndex})`}
        />
        <ellipse cx="76" cy="67" rx="9" ry="7"
          fill={color} opacity="0.75"
          filter={`url(#cg-glow-${rankIndex})`}
        />
      </>}

      {/* Weapon: sword (rank ≥ 1), glowing sword (rank ≥ 4) */}
      {rankIndex >= 1 && (
        <g filter={rankIndex >= 4 ? `url(#cg-glow-${rankIndex})` : undefined}>
          <rect x="11" y="60" width="4" height="40" rx="2"
            fill={rankIndex >= 4 ? color : '#aaaaaa'}
            opacity={rankIndex >= 4 ? 0.9 : 0.55}
          />
          <rect x="5" y="75" width="16" height="4" rx="2"
            fill={rankIndex >= 4 ? color : '#888888'}
            opacity={rankIndex >= 4 ? 0.9 : 0.55}
          />
        </g>
      )}

      {/* Shield (rank >= 5) */}
      {heavy && (
        <g filter={`url(#cg-glow-${rankIndex})`}>
          <path d="M82 64 L92 64 L92 84 L87 90 L82 84 Z"
            fill={color} opacity="0.8"
          />
          <line x1="87" y1="64" x2="87" y2="90" stroke={glow} strokeWidth="1.5" opacity="0.7" />
          <line x1="82" y1="74" x2="92" y2="74" stroke={glow} strokeWidth="1.5" opacity="0.7" />
        </g>
      )}

      {/* ── Head ── */}
      <ellipse cx="50" cy="50" rx="17" ry="17"
        fill={`url(#cg-body-${rankIndex})`}
        filter={heavy ? `url(#cg-glow-${rankIndex})` : undefined}
        className="char-head"
      />

      {/* Visor / face */}
      <ellipse cx="50" cy="50" rx="11" ry="8"
        fill={armored ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.08)'}
      />

      {/* Eyes */}
      <ellipse cx="45" cy="49" rx={heavy ? 3.5 : 2} ry={heavy ? 2.5 : 1.5}
        fill={color}
        filter={`url(#cg-glow-${rankIndex})`}
        opacity="0.95"
        className="char-eye"
      />
      <ellipse cx="55" cy="49" rx={heavy ? 3.5 : 2} ry={heavy ? 2.5 : 1.5}
        fill={color}
        filter={`url(#cg-glow-${rankIndex})`}
        opacity="0.95"
        className="char-eye"
      />

      {/* Helmet crest (rank >= 2) */}
      {rankIndex >= 2 && (
        <path d={heavy
          ? "M42 34 L50 24 L58 34"
          : "M45 35 L50 28 L55 35"}
          stroke={color}
          strokeWidth={heavy ? 3 : 2}
          fill="none"
          filter={`url(#cg-glow-${rankIndex})`}
          strokeLinecap="round"
        />
      )}

      {/* Crown / halo (rank >= 6) */}
      {rankIndex >= 6 && (
        <circle cx="50" cy="33" r={rankIndex >= 7 ? 6 : 4}
          fill="none"
          stroke={color}
          strokeWidth="2"
          opacity="0.8"
          filter={`url(#cg-glow-${rankIndex})`}
          className="char-crown"
        />
      )}

      {/* Cosmic aura ring (SSS) */}
      {cosmic && (
        <circle cx="50" cy="75" r="42"
          fill="none"
          stroke={color}
          strokeWidth="1"
          opacity="0.2"
          strokeDasharray="4 6"
          className="char-ring"
        />
      )}
    </svg>
  )
}

// ── Main export
export default function CharacterPanel({ xp = 0, completedCount = 0, theme = {}, lang = 'ru', compact = false }) {
  const t        = theme
  const rankInfo = getRank(xp)
  const rankIdx  = RANKS.findIndex(r => r.rank === rankInfo.rank)
  const progress = xpProgress(xp)
  const nextRank = RANKS[rankIdx + 1]

  const text    = t.text    || '#ffffff'
  const textSub = t.textSub || '#7a7a9a'
  const border  = t.cardBorder || 'rgba(255,255,255,0.07)'

  return (
    <div style={{
      ...S.panel,
      background: t.card || 'rgba(255,255,255,0.028)',
      borderColor: `${rankInfo.color}33`,
      boxShadow: `0 0 40px ${rankInfo.glow}22`,
    }}>

      {/* ── Rank badge (top-right) ── */}
      <div style={{ ...S.rankBadge, color: rankInfo.color, textShadow: `0 0 18px ${rankInfo.glow}` }}>
        {rankInfo.rank}
      </div>

      {/* ── Character visual ── */}
      <div style={S.charWrap} className="char-float">
        <CharacterSVG
          rankIndex={rankIdx}
          color={rankInfo.color}
          glow={rankInfo.glow}
        />
      </div>

      {/* ── Info ── */}
      <div style={S.info}>
        <div style={{ ...S.rankLabel, color: rankInfo.color, textShadow: `0 0 12px ${rankInfo.glow}` }}>
          {rankInfo.label}
        </div>

        <div style={{ ...S.statsRow }}>
          <div style={S.statItem}>
            <div style={{ ...S.statValue, color: text }}>{xp.toLocaleString()}</div>
            <div style={{ ...S.statLabel, color: textSub }}>XP</div>
          </div>
          <div style={{ ...S.statDivider, borderColor: border }} />
          <div style={S.statItem}>
            <div style={{ ...S.statValue, color: text }}>{completedCount}</div>
            <div style={{ ...S.statLabel, color: textSub }}>{lang === 'en' ? 'Tasks' : 'Задач'}</div>
          </div>
        </div>

        {/* XP bar */}
        <div style={{ marginTop: 10 }}>
          <div style={{ ...S.xpTrack, background: `${rankInfo.color}15` }}>
            <div
              className="char-xp-fill"
              style={{
                ...S.xpFill,
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${rankInfo.glow}, ${rankInfo.color})`,
                boxShadow: `0 0 10px ${rankInfo.color}66`,
              }}
            />
          </div>
          <div style={{ ...S.xpMeta, color: textSub }}>
            {nextRank
              ? lang === 'en' ? `To ${nextRank.rank}: ${nextRank.min - xp} XP` : `До ${nextRank.rank}: ${nextRank.min - xp} XP`
              : <span style={{ color: rankInfo.color }}>{lang === 'en' ? 'MAX RANK ✦' : 'МАКСИМАЛЬНЫЙ РАНГ ✦'}</span>
            }
          </div>
        </div>
      </div>

      <style>{CHAR_CSS}</style>
    </div>
  )
}

const S = {
  panel: {
    borderRadius: 20,
    border: '1px solid',
    padding: '20px 18px 18px',
    position: 'relative',
    overflow: 'hidden',
    backdropFilter: 'blur(16px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
    userSelect: 'none',
  },
  rankBadge: {
    position: 'absolute',
    top: 14, right: 18,
    fontFamily: "'Orbitron', monospace",
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: '0.06em',
    lineHeight: 1,
    animation: 'char-rank-pulse 3s ease-in-out infinite',
  },
  charWrap: {
    width: 100,
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  info: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  rankLabel: {
    textAlign: 'center',
    fontFamily: "'Orbitron', monospace",
    fontSize: 10,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  statsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 4,
  },
  statItem: {
    textAlign: 'center',
  },
  statValue: {
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1,
  },
  statLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  statDivider: {
    width: 1, height: 28,
    borderLeft: '1px solid',
    opacity: 0.3,
  },
  xpTrack: {
    height: 5,
    borderRadius: 99,
    overflow: 'hidden',
    marginBottom: 5,
  },
  xpFill: {
    height: '100%',
    borderRadius: 99,
    transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
  },
  xpMeta: {
    fontFamily: 'monospace',
    fontSize: 10,
    textAlign: 'right',
    letterSpacing: '0.04em',
  },
}

const CHAR_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');

  /* Float animation */
  .char-float {
    animation: char-float 4s ease-in-out infinite;
  }
  @keyframes char-float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-6px); }
  }

  /* Aura pulse */
  .char-aura {
    animation: char-aura-pulse 3s ease-in-out infinite;
  }
  @keyframes char-aura-pulse {
    0%, 100% { opacity: 0.6; transform: scaleX(1); }
    50%       { opacity: 1;   transform: scaleX(1.12); }
  }

  /* Eye blink */
  .char-eye {
    animation: char-blink 5s ease-in-out infinite;
  }
  @keyframes char-blink {
    0%, 90%, 100% { transform: scaleY(1); }
    93%            { transform: scaleY(0.1); }
  }

  /* Crown rotate */
  .char-crown {
    animation: char-crown-spin 8s linear infinite;
    transform-origin: 50px 33px;
  }
  @keyframes char-crown-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  /* Cosmic ring */
  .char-ring {
    animation: char-ring-spin 12s linear infinite;
    transform-origin: 50px 75px;
  }
  @keyframes char-ring-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  /* Particle twinkle */
  .char-particle {
    animation: char-twinkle 2s ease-in-out infinite;
  }
  @keyframes char-twinkle {
    0%, 100% { opacity: 0.2; r: 1.5px; }
    50%       { opacity: 1;   r: 2.5px; }
  }

  /* Rank badge pulse */
  @keyframes char-rank-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.7; }
  }

  /* XP fill */
  .char-xp-fill {
    animation: char-xp-in 1.4s cubic-bezier(0.4,0,0.2,1) both;
  }
  @keyframes char-xp-in {
    from { width: 0 !important; }
  }
`
