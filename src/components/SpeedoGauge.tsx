import React from 'react';
import { CockpitColors } from '../theme/cockpitTheme';

interface SpeedoGaugeProps {
  speedKmh: number;
  maxSpeedKmh?: number;
  powerW?: number;
  socPct?: number;
  isRegen?: boolean;
  colors: CockpitColors;
  size?: number;
}

export const SpeedoGauge: React.FC<SpeedoGaugeProps> = ({
  speedKmh,
  maxSpeedKmh = 100,
  powerW,
  socPct,
  isRegen = false,
  colors,
  size = 210,
}) => {
  const cx = 120;
  const cy = 120;
  const radius = 96;
  const startAngle = 135;
  const sweepTotal = 270;

  const polar = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const describeArc = (startDeg: number, endDeg: number, r: number) => {
    const s = polar(startDeg, r);
    const e = polar(endDeg, r);
    const largeArc = endDeg - startDeg <= 180 ? '0' : '1';
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  };

  const spdFrac = Math.min(1, Math.max(0, speedKmh / maxSpeedKmh));
  const spdEnd = startAngle + spdFrac * sweepTotal;
  const arcColor = spdFrac > 0.82 ? colors.danger : colors.accent;

  const socFrac = socPct !== undefined ? Math.min(1, Math.max(0, socPct / 100)) : 0;
  const socEnd = startAngle + socFrac * sweepTotal;

  const ticks = Array.from({ length: 21 }, (_, i) => {
    const frac = i / 20;
    const deg = startAngle + frac * sweepTotal;
    const major = i % 4 === 0;
    const p1 = polar(deg, radius - (major ? 19 : 13));
    const p2 = polar(deg, radius - 7);
    return { p1, p2, major };
  });

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 240 240" className="w-full h-full">
        {/* Outer Track */}
        <path
          d={describeArc(startAngle, startAngle + sweepTotal, radius)}
          fill="none"
          stroke={colors.borderSubtle}
          strokeWidth={13}
          strokeLinecap="round"
        />
        {/* Inner SOC track */}
        {socPct !== undefined && (
          <path
            d={describeArc(startAngle, socEnd, radius - 17)}
            fill="none"
            stroke={socFrac <= 0.2 ? colors.danger : colors.accentSecondary}
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.7}
          />
        )}
        {/* Ticks */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.p1.x}
            y1={t.p1.y}
            x2={t.p2.x}
            y2={t.p2.y}
            stroke={t.major ? colors.accent : colors.textMuted}
            strokeOpacity={t.major ? 0.65 : 0.3}
            strokeWidth={t.major ? 2.4 : 1.3}
            strokeLinecap="round"
          />
        ))}
        {/* Active Speed Arc */}
        {spdFrac > 0.005 && (
          <path
            d={describeArc(startAngle, spdEnd, radius)}
            fill="none"
            stroke={arcColor}
            strokeWidth={13}
            strokeLinecap="round"
          />
        )}
        {/* Center Readout */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fill={colors.textPrimary}
          fontSize={48}
          fontWeight={800}
          className="tnum"
        >
          {Math.round(speedKmh)}
        </text>
        <text
          x={cx}
          y={cy + 20}
          textAnchor="middle"
          fill={colors.textMuted}
          fontSize={12}
          fontWeight={700}
          letterSpacing={1.5}
        >
          KM/H
        </text>
        {powerW !== undefined && (
          <g>
            <rect
              x={cx - 46}
              y={cy + 40}
              width={92}
              height={24}
              rx={12}
              fill={isRegen ? `${colors.regen}28` : `${colors.accent}22`}
            />
            <text
              x={cx}
              y={cy + 56}
              textAnchor="middle"
              fill={isRegen ? colors.regen : colors.accent}
              fontSize={12}
              fontWeight={700}
              className="tnum"
            >
              {isRegen ? `+${Math.round(Math.abs(powerW))} W REGEN` : `${Math.round(powerW)} W`}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};
