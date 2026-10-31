export function HeroScene() {
  const stars = [
    [8, 12, 1.6], [18, 8, 1.1], [30, 18, 1.4], [45, 6, 1.0], [58, 14, 1.7],
    [70, 9, 1.2], [82, 16, 1.5], [92, 7, 1.1], [12, 26, 1.0], [40, 28, 1.3],
    [66, 26, 1.0], [88, 30, 1.4], [24, 38, 1.0], [52, 36, 1.2], [78, 40, 1.1],
  ] as const;

  return (
    <svg
      viewBox="0 0 400 320"
      className="h-auto w-full"
      role="img"
      aria-label="Friends gathered around a glowing campfire beneath a starry night sky, mountains and a still lake behind them"
    >
      <defs>
        <radialGradient id="skyGlow" cx="50%" cy="72%" r="60%">
          <stop offset="0%" stopColor="#3b2a55" />
          <stop offset="55%" stopColor="#171233" />
          <stop offset="100%" stopColor="#0b0b1e" />
        </radialGradient>
        <radialGradient id="fireGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff922e" stopOpacity="0.85" />
          <stop offset="45%" stopColor="#ff7a1a" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ff7a1a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1c1740" />
          <stop offset="100%" stopColor="#0d0c24" />
        </linearGradient>
        <linearGradient id="mtn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#251d4a" />
          <stop offset="100%" stopColor="#141132" />
        </linearGradient>
        <linearGradient id="flame1" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#ff6a00" />
          <stop offset="100%" stopColor="#ffc24b" />
        </linearGradient>
        <linearGradient id="flame2" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#ff922e" />
          <stop offset="100%" stopColor="#ffe3a3" />
        </linearGradient>
      </defs>

      <rect width="400" height="320" rx="20" fill="url(#skyGlow)" />

      {stars.map(([x, y, r], i) => (
        <circle
          key={i}
          cx={x * 4}
          cy={y * 3}
          r={r}
          fill="#e9e4ff"
          className="animate-twinkle"
          style={{ animationDelay: `${(i % 5) * 0.8}s` }}
        />
      ))}

      <circle cx="322" cy="58" r="22" fill="#f3ead2" opacity="0.9" />
      <circle cx="314" cy="52" r="20" fill="url(#skyGlow)" opacity="0.55" />

      <path d="M0 190 L70 118 L120 165 L165 100 L230 190 Z" fill="url(#mtn)" />
      <path d="M150 190 L235 105 L300 175 L345 130 L400 190 L400 190 Z" fill="#1d1740" />
      <path d="M165 100 L178 118 L152 118 Z" fill="#3d3565" opacity="0.8" />
      <path d="M235 105 L248 124 L222 124 Z" fill="#372f5e" opacity="0.7" />

      <rect x="0" y="190" width="400" height="130" fill="url(#lake)" />

      <ellipse cx="235" cy="204" rx="60" ry="3.5" fill="#ff922e" opacity="0.18" />
      <ellipse cx="235" cy="216" rx="42" ry="3" fill="#ff922e" opacity="0.12" />
      <ellipse cx="70" cy="206" rx="46" ry="3" fill="#b9a5e8" opacity="0.12" />

      <g className="animate-flicker">
        <circle cx="200" cy="238" r="52" fill="url(#fireGlow)" />
      </g>

      <g>
        <ellipse cx="200" cy="262" rx="26" ry="7" fill="#241d42" />
        <path d="M182 262 L186 252 L214 252 L218 262 Z" fill="#3a2c22" />
        <path d="M188 258 L212 252 M188 252 L212 258" stroke="#553f2e" strokeWidth="3" strokeLinecap="round" />
        <path d="M200 254 C 192 244 194 238 200 230 C 206 238 208 244 200 254 Z" fill="url(#flame1)" />
        <path d="M200 250 C 195 244 196 240 200 234 C 204 240 205 244 200 250 Z" fill="url(#flame2)" />
      </g>

      <g fill="#171233" stroke="#2b2450" strokeWidth="1.5">
        <g>
          <circle cx="152" cy="246" r="9" />
          <path d="M143 268 C 143 257 161 257 161 268" />
        </g>
        <g>
          <circle cx="176" cy="256" r="9" />
          <path d="M167 278 C 167 267 185 267 185 278" />
        </g>
        <g>
          <circle cx="226" cy="256" r="9" />
          <path d="M217 278 C 217 267 235 267 235 278" />
        </g>
        <g>
          <circle cx="248" cy="246" r="9" />
          <path d="M239 268 C 239 257 257 257 257 268" />
        </g>
      </g>

      <g stroke="#b9a5e8" strokeWidth="1.2" strokeLinecap="round" opacity="0.9">
        <line x1="118" y1="196" x2="118" y2="242" />
        <path d="M112 242 L124 242 L121 252 L115 252 Z" fill="#ffce7a" stroke="none" className="animate-flicker" />
        <line x1="284" y1="196" x2="284" y2="242" />
        <path d="M278 242 L290 242 L287 252 L281 252 Z" fill="#ffce7a" stroke="none" className="animate-flicker" style={{ animationDelay: "1.2s" }} />
      </g>
    </svg>
  );
}
