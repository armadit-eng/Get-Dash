import React from 'react';
import { CockpitColors } from '../theme/cockpitTheme';
import { ElevationSample, TelemetryPoint } from '../types/dashboard';

interface SingleChartProps {
  title: string;
  unit: string;
  values: number[];
  color: string;
  colors: CockpitColors;
  minVal?: number;
  maxVal?: number;
}

export const LiveSeriesChart: React.FC<SingleChartProps> = ({
  title,
  unit,
  values,
  color,
  colors,
  minVal,
  maxVal,
}) => {
  const latest = values.length > 0 ? values[values.length - 1] : undefined;
  const lo = minVal ?? (values.length > 0 ? Math.min(...values) : 0);
  const hi = maxVal ?? (values.length > 0 ? Math.max(...values, lo + 1) : 100);
  const span = Math.max(0.01, hi - lo);

  const w = 360;
  const h = 92;
  const pad = 6;

  const points = values.map((v, i) => {
    const x = values.length === 1 ? w / 2 : pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - lo) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polyline = points.join(' ');
  const area =
    points.length > 1
      ? `${pad},${h - pad} ${polyline} ${w - pad},${h - pad}`
      : '';

  return (
    <div
      className="rounded-2xl p-3.5 border"
      style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: colors.textMuted }}>
          {title}
        </span>
        <span className="text-sm font-bold tnum" style={{ color }}>
          {latest !== undefined ? `${latest.toFixed(1)} ${unit}` : `-- ${unit}`}
        </span>
      </div>
      <div className="w-full h-24">
        {values.length < 2 ? (
          <div
            className="w-full h-full flex items-center justify-center text-xs rounded-xl"
            style={{ backgroundColor: colors.surfaceElevated, color: colors.textMuted }}
          >
            Menunggu data telemetri 1 Hz…
          </div>
        ) : (
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full overflow-visible">
            <line
              x1={pad}
              y1={h / 2}
              x2={w - pad}
              y2={h / 2}
              stroke={colors.borderSubtle}
              strokeDasharray="4 4"
            />
            {area && <polygon points={area} fill={color} fillOpacity={0.14} />}
            <polyline
              fill="none"
              stroke={color}
              strokeWidth={2.2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={polyline}
            />
          </svg>
        )}
      </div>
    </div>
  );
};

export const TelemetryLiveCharts: React.FC<{
  history: TelemetryPoint[];
  colors: CockpitColors;
}> = ({ history, colors }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <LiveSeriesChart
        title="Kecepatan Motor"
        unit="km/h"
        values={history.map((p) => p.speedKmh)}
        color={colors.accent}
        colors={colors}
        minVal={0}
      />
      <LiveSeriesChart
        title="Daya Keluar / Regen"
        unit="W"
        values={history.map((p) => p.powerW)}
        color={colors.warning}
        colors={colors}
      />
      <LiveSeriesChart
        title="Tegangan Pack Rata-Rata"
        unit="V"
        values={history.map((p) => p.voltageV)}
        color={colors.accentSecondary}
        colors={colors}
      />
      <LiveSeriesChart
        title="State of Charge (SOC)"
        unit="%"
        values={history.map((p) => p.socPct)}
        color="#10B981"
        colors={colors}
        minVal={0}
        maxVal={100}
      />
    </div>
  );
};

export const ElevationProfileChart: React.FC<{
  samples: ElevationSample[];
  colors: CockpitColors;
}> = ({ samples, colors }) => {
  if (samples.length < 2) return null;
  const w = 360;
  const h = 88;
  const pad = 8;
  const minE = Math.min(...samples.map((s) => s.elevationM));
  const maxE = Math.max(...samples.map((s) => s.elevationM), minE + 5);
  const span = Math.max(1, maxE - minE);

  const pts = samples.map((s, i) => {
    const x = pad + (i / (samples.length - 1)) * (w - pad * 2);
    const y = h - pad - ((s.elevationM - minE) / span) * (h - pad * 2);
    return { x, y, sample: s };
  });

  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[11px] mb-1" style={{ color: colors.textMuted }}>
        <span>Profil Elevasi Rute ({Math.round(minE)}m – {Math.round(maxE)}m)</span>
        <span>{samples[samples.length - 1].distanceKm.toFixed(1)} km</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20 rounded-xl" style={{ backgroundColor: colors.surfaceElevated }}>
        <polygon points={area} fill={colors.accentSecondary} fillOpacity={0.18} />
        <polyline fill="none" stroke={colors.accentSecondary} strokeWidth={2.2} points={line} />
        {pts.map((p, idx) =>
          p.sample.gradeType === 'UPHILL_STEEP' ? (
            <circle key={idx} cx={p.x} cy={p.y} r={3} fill={colors.danger} />
          ) : p.sample.gradeType === 'DOWNHILL' ? (
            <circle key={idx} cx={p.x} cy={p.y} r={2.5} fill={colors.regen} />
          ) : null
        )}
      </svg>
    </div>
  );
};
