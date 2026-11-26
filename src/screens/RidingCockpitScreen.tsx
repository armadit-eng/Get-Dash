import React, { useEffect } from 'react';
import { ArrowRight, BatteryCharging, Compass, Minimize2, Navigation, Zap } from 'lucide-react';
import { SpeedoGauge } from '../components/SpeedoGauge';
import { useDashboard } from '../context/DashboardContext';

interface RidingCockpitScreenProps {
  onClose: () => void;
}

function compassLabel(deg?: number): string {
  if (deg === undefined) return 'Arah --';
  const dirs = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
  return `${dirs[Math.round(((deg % 360) / 45)) % 8]} (${Math.round(deg)}°)`;
}

export const RidingCockpitScreen: React.FC<RidingCockpitScreenProps> = ({ onClose }) => {
  const {
    colors,
    settings,
    updateSettings,
    effective,
    liveTrip,
    gpsState,
    activeRoute,
    isNavigating,
    activeStepIndex,
    distToNextStepM,
  } = useDashboard();

  // Request Screen Wake Lock when supported
  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null;
    const nav = navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((s) => {
      sentinel = s;
    }).catch(() => {});
    return () => {
      sentinel?.release().catch(() => {});
    };
  }, []);

  const powerW = effective.combinedPowerW ?? 0;
  const isFlowActive = Math.abs(powerW) > 15;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between p-4 sm:p-6 overflow-y-auto"
      style={{ backgroundColor: '#05080D', color: '#F1F5F9' }}
    >
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {isNavigating && activeRoute ? (
            <div
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border truncate"
              style={{
                backgroundColor: `${colors.accent}1E`,
                borderColor: `${colors.accent}66`,
              }}
            >
              <Navigation size={16} style={{ color: colors.accent }} className="shrink-0" />
              <span className="text-xs sm:text-sm font-bold truncate" style={{ color: colors.accent }}>
                {Math.round(distToNextStepM)}m •{' '}
                {activeRoute.steps[activeStepIndex]?.instruction ?? 'Ikuti rute'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-400">
              <Compass size={16} style={{ color: colors.accent }} />
              <span>{compassLabel(gpsState.headingDeg)}</span>
              <span>•</span>
              <span>{gpsState.roadName || 'Mode Berkendara'}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-0.5 text-xs font-bold">
            {(['compact', 'complete'] as const).map((layout) => (
              <button
                key={layout}
                onClick={() => updateSettings({ ...settings, cockpitLayout: layout })}
                className="px-3 py-1.5 rounded-lg cursor-pointer"
                style={{
                  backgroundColor: settings.cockpitLayout === layout ? colors.accent : 'transparent',
                  color: settings.cockpitLayout === layout ? '#041418' : '#94A3B8',
                }}
              >
                {layout === 'compact' ? 'Ringkas' : 'Lengkap'}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white cursor-pointer"
            title="Keluar Fullscreen"
          >
            <Minimize2 size={18} />
          </button>
        </div>
      </div>

      {/* Main Landscape HUD Stage */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 my-6">
        {/* Left Pack Metrics */}
        {settings.cockpitLayout === 'complete' && (
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 w-full max-w-xs">
            <HudBox
              label="BATERAI 1"
              value={effective.b1SocPct !== undefined ? `${Math.round(effective.b1SocPct)}%` : '--%'}
              sub={`${effective.b1Vbat?.toFixed(1) ?? '--'}V • ${effective.b1Ibat?.toFixed(1) ?? '--'}A`}
              color={colors.accent}
            />
            <HudBox
              label="BATERAI 2"
              value={
                effective.b2Active && effective.b2SocPct !== undefined
                  ? `${Math.round(effective.b2SocPct)}%`
                  : 'Standby'
              }
              sub={
                effective.b2Active
                  ? `${effective.b2Vbat?.toFixed(1) ?? '--'}V • ${effective.b2Ibat?.toFixed(1) ?? '--'}A`
                  : 'ESP32 #2 Offline'
              }
              color={colors.accentSecondary}
            />
          </div>
        )}

        {/* Center Oversized Speedo + Energy Flow */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className="px-3 py-1 rounded-full text-xs font-extrabold"
              style={{ backgroundColor: `${colors.accent}24`, color: colors.accent }}
            >
              MODE {effective.modeLabel}
            </span>
            {effective.cruiseActive && (
              <span
                className="px-3 py-1 rounded-full text-xs font-extrabold"
                style={{ backgroundColor: `${colors.regen}24`, color: colors.regen }}
              >
                CRUISE AKTIF
              </span>
            )}
          </div>

          <SpeedoGauge
            speedKmh={effective.speedKmh ?? 0}
            powerW={effective.combinedPowerW}
            socPct={effective.combinedSocPct}
            isRegen={effective.isRegen}
            colors={{ ...colors, textPrimary: '#F8FAFC', borderSubtle: '#1E293B' }}
            size={280}
          />

          {/* Animated Energy Flow Bar */}
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-slate-800 bg-slate-900/80">
            <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: colors.accent }}>
              <BatteryCharging size={15} />
              <span className="tnum">{effective.combinedSocPct?.toFixed(0) ?? '--'}% PACK</span>
            </div>
            <div className="flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <ArrowRight
                  key={i}
                  size={14}
                  className={isFlowActive ? 'animate-pulse' : 'opacity-30'}
                  style={{
                    color: effective.isRegen ? colors.regen : colors.accent,
                    transform: effective.isRegen ? 'rotate(180deg)' : undefined,
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: effective.isRegen ? colors.regen : colors.warning }}>
              <Zap size={15} />
              <span className="tnum">
                {effective.isRegen ? 'REGEN' : 'MOTOR'} {Math.round(Math.abs(powerW))}W
              </span>
            </div>
          </div>
        </div>

        {/* Right Trip & Range Metrics */}
        {settings.cockpitLayout === 'complete' && (
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 w-full max-w-xs">
            <HudBox
              label="ESTIMASI JARAK"
              value={effective.rangeKm !== undefined ? `${effective.rangeKm.toFixed(1)} km` : '-- km'}
              sub={`${effective.blendedWhPerKm.toFixed(1)} Wh/km`}
              color={colors.accentSecondary}
            />
            <HudBox
              label="TRIP BERJALAN"
              value={`${liveTrip.distanceKm.toFixed(2)} km`}
              sub={`+${Math.round(liveTrip.regenWh)} Wh Regen`}
              color={colors.warning}
            />
          </div>
        )}
      </div>

      {/* Bottom Footer Strip */}
      <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-3">
        <span className="tnum">ODO {effective.odoKm?.toFixed(1) ?? '--'} km</span>
        <span className="tnum">T_MOTOR {effective.b1TempC?.toFixed(1) ?? '--'}°C</span>
        <span className="tnum">THROTTLE {Math.round(effective.throttlePct ?? 0)}%</span>
      </div>
    </div>
  );
};

const HudBox: React.FC<{ label: string; value: string; sub: string; color: string }> = ({
  label,
  value,
  sub,
  color,
}) => (
  <div className="rounded-2xl p-4 border border-slate-800 bg-slate-900/75">
    <div className="text-[11px] font-bold tracking-wider text-slate-400">{label}</div>
    <div className="text-2xl font-extrabold tnum mt-0.5" style={{ color }}>
      {value}
    </div>
    <div className="text-xs text-slate-400 tnum mt-0.5">{sub}</div>
  </div>
);
