import React from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  Bluetooth,
  Compass,
  Cpu,
  Flame,
  Gauge,
  MapPin,
  Maximize2,
  Navigation,
  Pin,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  Sun,
  Trophy,
  Wrench,
  Zap,
} from 'lucide-react';
import { SpeedoGauge } from '../components/SpeedoGauge';
import { useDashboard } from '../context/DashboardContext';
import { computeIdleDrainPct, computeRidingScore } from '../engine/telemetryEngine';

interface HomeCockpitScreenProps {
  onOpenDevices: () => void;
  onOpenRidingCockpit: () => void;
  onNavigateTab: (idx: number) => void;
}

export const HomeCockpitScreen: React.FC<HomeCockpitScreenProps> = ({
  onOpenDevices,
  onOpenRidingCockpit,
  onNavigateTab,
}) => {
  const {
    settings,
    colors,
    motorConnState,
    jkConnState,
    esp1ConnState,
    esp2ConnState,
    motorData,
    jkData,
    devSimActive,
    toggleDevSim,
    effective,
    chargeState,
    activeAlerts,
    liveTrip,
    ridingScore,
    weather,
    gpsState,
    parkedLocation,
    dailyChallenge,
    maintStatus,
    saveLiveTrip,
    resetLiveTrip,
    parkHere,
    clearParkPin,
    refreshWeatherAndGeo,
  } = useDashboard();

  const { score, label: scoreLabel } = computeRidingScore(ridingScore);
  const idleDrainPct = computeIdleDrainPct(
    settings.lastParkSocPct,
    settings.lastParkTsMs,
    effective.combinedSocPct
  );

  const ctrlBadgeLabel = settings.controllerProtocol === 'fardriver' ? 'FARDRIVER' : 'ORI / MID';
  const bmsBadgeMap = {
    jk: 'JK-BMS',
    ant: 'ANT-BMS',
    daly: 'DALY-BMS',
    jbd: 'JBD-BMS',
  } as const;
  const bmsBadgeLabel = bmsBadgeMap[jkData.protocol ?? settings.bmsProtocol];

  const badges = [
    { label: ctrlBadgeLabel, state: motorConnState, Icon: Gauge },
    { label: bmsBadgeLabel, state: jkConnState, Icon: BatteryCharging },
    { label: 'ESP1', state: esp1ConnState, Icon: Cpu },
    { label: 'ESP2', state: esp2ConnState, Icon: Zap },
  ];

  return (
    <div className="space-y-4 pb-24 md:pb-8">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight">{settings.bikeName}</h1>
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-md border"
              style={{
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.borderSubtle,
                color: colors.textMuted,
              }}
            >
              {settings.plateNumber}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
            {settings.riderName} • ODO {effective.odoKm?.toFixed(1) ?? '--'} km
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleDevSim(!devSimActive)}
            className="px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer"
            style={{
              backgroundColor: devSimActive ? `${colors.warning}22` : colors.surfaceCard,
              borderColor: devSimActive ? colors.warning : colors.borderSubtle,
              color: devSimActive ? colors.warning : colors.textMuted,
            }}
          >
            {devSimActive ? 'DEV-SIM AKTIF' : 'Uji Simulasi'}
          </button>
          <button
            onClick={onOpenDevices}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer"
            style={{
              backgroundColor: colors.surfaceCard,
              borderColor: colors.borderSubtle,
              color: colors.accent,
            }}
          >
            <Bluetooth size={14} /> Perangkat
          </button>
          <button
            onClick={onOpenRidingCockpit}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer"
            style={{ backgroundColor: colors.accent, color: '#041418' }}
          >
            <Maximize2 size={14} /> Cockpit HUD
          </button>
        </div>
      </div>

      {/* Connection Status Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {badges.map((b) => {
          const ok = b.state === 'CONNECTED';
          return (
            <button
              key={b.label}
              onClick={onOpenDevices}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold border cursor-pointer"
              style={{
                backgroundColor: ok ? `${colors.accent}18` : colors.surfaceCard,
                borderColor: ok ? `${colors.accent}66` : colors.borderSubtle,
                color: ok ? colors.accent : colors.textMuted,
              }}
            >
              <b.Icon size={12} />
              <span>{b.label}</span>
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: ok ? colors.accent : colors.textMuted }}
              />
            </button>
          );
        })}
        {devSimActive && (
          <span
            className="px-2.5 py-1 rounded-full text-[11px] font-bold border"
            style={{
              backgroundColor: `${colors.warning}22`,
              borderColor: colors.warning,
              color: colors.warning,
            }}
          >
            SIMULASI DEV
          </span>
        )}
      </div>

      {/* Active Alarms & Idle Drain */}
      {(activeAlerts.length > 0 || idleDrainPct !== undefined) && (
        <div className="space-y-2">
          {activeAlerts.map((a) => {
            const col =
              a.severity === 'CRITICAL'
                ? colors.danger
                : a.severity === 'WARNING'
                  ? colors.warning
                  : colors.regen;
            return (
              <div
                key={a.id}
                className="rounded-2xl p-3 border flex items-start gap-2.5"
                style={{ backgroundColor: `${col}18`, borderColor: `${col}88` }}
              >
                <AlertTriangle size={18} style={{ color: col }} className="shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold" style={{ color: col }}>
                    {a.title}
                  </div>
                  <div className="text-xs" style={{ color: colors.textPrimary }}>
                    {a.message}
                  </div>
                </div>
              </div>
            );
          })}
          {idleDrainPct !== undefined && (
            <div
              className="rounded-2xl p-3 border flex items-center gap-2.5"
              style={{ backgroundColor: `${colors.warning}15`, borderColor: `${colors.warning}66` }}
            >
              <ShieldAlert size={18} style={{ color: colors.warning }} />
              <div className="text-xs">
                <span className="font-bold" style={{ color: colors.warning }}>
                  Vampire Drain Terdeteksi:
                </span>{' '}
                SOC turun {idleDrainPct.toFixed(1)}% sejak parkir terakhir.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Signature Hero Card: Speedometer + Dual Battery + Range */}
      <div
        className="rounded-3xl p-5 border"
        style={{
          background: `linear-gradient(135deg, ${colors.surfaceCard} 0%, ${colors.accent}14 100%)`,
          borderColor: colors.borderSubtle,
        }}
      >
        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* Speedo */}
          <div className="shrink-0 flex flex-col items-center">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold"
                style={{ backgroundColor: `${colors.accent}22`, color: colors.accent }}
              >
                {effective.modeLabel === '—' ? 'MODE STANDBY' : `MODE ${effective.modeLabel}`}
              </span>
              <span
                className="text-[11px] font-semibold"
                style={{
                  color: effective.isRegen
                    ? colors.regen
                    : effective.isCharging
                      ? colors.accent
                      : colors.textMuted,
                }}
              >
                {chargeState}
              </span>
            </div>
            <SpeedoGauge
              speedKmh={effective.speedKmh ?? 0}
              powerW={effective.combinedPowerW}
              socPct={effective.combinedSocPct}
              isRegen={effective.isRegen}
              colors={colors}
              size={220}
            />
          </div>

          {/* Right Side Readouts — Baterai ORI/MID & Smart BMS terpisah tegas */}
          <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-3 gap-3">
            <MetricTile
              label="SOC Gabungan"
              value={
                effective.combinedSocPct !== undefined
                  ? `${Math.round(effective.combinedSocPct)}%`
                  : '--%'
              }
              sub={`${Math.round(effective.totalAvailableWh)} Wh tersisa`}
              color={colors.accent}
              colors={colors}
            />
            <MetricTile
              label="Estimasi Jarak"
              value={
                effective.rangeKm !== undefined ? `${effective.rangeKm.toFixed(1)} km` : '-- km'
              }
              sub={`Konsumsi ${effective.blendedWhPerKm.toFixed(1)} Wh/km`}
              color={colors.accentSecondary}
              colors={colors}
            />
            <MetricTile
              label={settings.controllerProtocol === 'fardriver' ? 'Arus Fasa / Line' : 'Tegangan / Arus'}
              value={
                settings.controllerProtocol === 'fardriver' && motorData.phaseCurrentA !== undefined
                  ? `${motorData.phaseCurrentA.toFixed(0)} A ph`
                  : effective.avgVoltageV !== undefined
                    ? `${effective.avgVoltageV.toFixed(1)} V`
                    : '-- V'
              }
              sub={
                effective.combinedCurrentA !== undefined
                  ? `${effective.avgVoltageV?.toFixed(1) ?? '--'}V • ${effective.combinedCurrentA.toFixed(1)} A`
                  : '-- A'
              }
              color={colors.textPrimary}
              colors={colors}
            />
            <MetricTile
              label={`Baterai ORI (${effective.oriSourceLabel})`}
              value={
                effective.oriActive && effective.oriSocPct !== undefined
                  ? `${Math.round(effective.oriSocPct)}%`
                  : 'Offline'
              }
              sub={
                effective.oriActive
                  ? `${effective.oriVbat?.toFixed(1) ?? '--'}V • ${effective.oriIbat?.toFixed(1) ?? '--'}A`
                  : 'Kontroler terputus'
              }
              color={colors.accent}
              colors={colors}
            />
            <MetricTile
              label={`Smart BMS (${effective.smartBmsLabel})`}
              value={
                effective.smartBmsActive && effective.smartBmsSocPct !== undefined
                  ? `${Math.round(effective.smartBmsSocPct)}%`
                  : 'Offline'
              }
              sub={
                effective.smartBmsActive
                  ? `${effective.smartBmsVbat?.toFixed(1) ?? '--'}V • ${effective.smartBmsIbat?.toFixed(1) ?? '--'}A`
                  : 'BMS Eksternal off'
              }
              color={colors.warning}
              colors={colors}
            />
            <MetricTile
              label="Baterai 2 (ESP2)"
              value={
                effective.b2Active && effective.b2SocPct !== undefined
                  ? `${Math.round(effective.b2SocPct)}%`
                  : 'Standby'
              }
              sub={
                effective.b2Active
                  ? `${effective.b2Vbat?.toFixed(1) ?? '--'}V • SOH ${effective.combinedSohPct?.toFixed(0) ?? '--'}%`
                  : `${effective.rpm ?? 0} RPM • ESP2 off`
              }
              color={colors.accentSecondary}
              colors={colors}
            />
          </div>
        </div>
      </div>

      {/* Live Trip Integrator + Weather & Geo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Live Trip Card */}
        <div
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Navigation size={16} style={{ color: colors.accent }} />
              <h2 className="text-sm font-bold">Trip Berjalan (Integrator 1 Hz)</h2>
            </div>
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full"
              style={{
                backgroundColor: `${colors.accent}18`,
                color: colors.accent,
              }}
            >
              Skor: {score !== undefined ? `${score} (${scoreLabel})` : scoreLabel}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-3">
            <div>
              <div className="text-[11px]" style={{ color: colors.textMuted }}>Jarak</div>
              <div className="text-sm font-bold tnum">{liveTrip.distanceKm.toFixed(2)} km</div>
            </div>
            <div>
              <div className="text-[11px]" style={{ color: colors.textMuted }}>Energi</div>
              <div className="text-sm font-bold tnum">{Math.round(liveTrip.energyWh)} Wh</div>
            </div>
            <div>
              <div className="text-[11px]" style={{ color: colors.textMuted }}>Regen</div>
              <div className="text-sm font-bold tnum" style={{ color: colors.regen }}>
                +{Math.round(liveTrip.regenWh)} Wh
              </div>
            </div>
            <div>
              <div className="text-[11px]" style={{ color: colors.textMuted }}>Puncak</div>
              <div className="text-sm font-bold tnum">{Math.round(liveTrip.maxSpeedKmh)} km/h</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={saveLiveTrip}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold cursor-pointer"
              style={{ backgroundColor: colors.accent, color: '#041418' }}
            >
              <Save size={14} /> Simpan Trip
            </button>
            <button
              onClick={resetLiveTrip}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer"
              style={{ borderColor: colors.borderSubtle, color: colors.textMuted }}
            >
              <RotateCcw size={14} /> Reset
            </button>
            <button
              onClick={parkedLocation ? clearParkPin : parkHere}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer"
              style={{
                borderColor: parkedLocation ? colors.warning : colors.borderSubtle,
                color: parkedLocation ? colors.warning : colors.textMuted,
              }}
            >
              <Pin size={14} /> {parkedLocation ? 'Hapus Parkir' : 'Pin Parkir'}
            </button>
          </div>
        </div>

        {/* Weather + Location Card */}
        <div
          className="rounded-2xl p-4 border flex flex-col justify-between"
          style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${colors.accentSecondary}20`, color: colors.accentSecondary }}
              >
                <Sun size={24} />
              </div>
              <div>
                <div className="text-sm font-bold flex items-center gap-2">
                  <span>{weather ? `${weather.tempC.toFixed(1)}°C • ${weather.description}` : 'Memuat Cuaca…'}</span>
                </div>
                <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: colors.textMuted }}>
                  <MapPin size={12} />
                  <span>{gpsState.roadName || 'Jl. Medan Merdeka'} — {gpsState.areaName || 'Jakarta'}</span>
                </div>
                {weather && (
                  <div className="text-[11px] mt-1" style={{ color: colors.accentSecondary }}>
                    {weather.moodTag} • Hujan {weather.rainProbPct}% • Angin {weather.windKmh.toFixed(0)} km/h
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={refreshWeatherAndGeo}
              className="p-2 rounded-xl border cursor-pointer"
              style={{ borderColor: colors.borderSubtle, color: colors.textMuted }}
              title="Segarkan lokasi & cuaca"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t" style={{ borderColor: colors.borderSubtle }}>
            <button
              onClick={() => onNavigateTab(2)}
              className="flex items-center gap-2 text-xs font-semibold p-2 rounded-xl cursor-pointer"
              style={{ backgroundColor: colors.surfaceElevated }}
            >
              <Compass size={15} style={{ color: colors.accent }} />
              <span>Buka Peta & SPKLU</span>
            </button>
            <button
              onClick={() => onNavigateTab(1)}
              className="flex items-center gap-2 text-xs font-semibold p-2 rounded-xl cursor-pointer"
              style={{ backgroundColor: colors.surfaceElevated }}
            >
              <Flame size={15} style={{ color: colors.warning }} />
              <span>Cek Diagnostik Sel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Daily Challenge & Maintenance Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Trophy size={16} style={{ color: colors.warning }} />
              <span className="text-sm font-bold">{dailyChallenge.title}</span>
            </div>
            <span className="text-xs font-bold tnum" style={{ color: colors.accent }}>
              {Math.round(dailyChallenge.progress * 100)}%
            </span>
          </div>
          <p className="text-xs mb-2.5" style={{ color: colors.textMuted }}>
            {dailyChallenge.description}
          </p>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.surfaceElevated }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${dailyChallenge.progress * 100}%`, backgroundColor: colors.warning }}
            />
          </div>
        </div>

        <div
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Wrench size={16} style={{ color: colors.accentSecondary }} />
              <span className="text-sm font-bold">Jadwal Servis Berkala</span>
            </div>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-md"
              style={{
                backgroundColor:
                  maintStatus.level === 'OVERDUE'
                    ? `${colors.danger}22`
                    : maintStatus.level === 'SOON'
                      ? `${colors.warning}22`
                      : `${colors.accent}22`,
                color:
                  maintStatus.level === 'OVERDUE'
                    ? colors.danger
                    : maintStatus.level === 'SOON'
                      ? colors.warning
                      : colors.accent,
              }}
            >
              {maintStatus.level === 'OVERDUE'
                ? 'Terlewat'
                : `Sisa ${Math.max(0, maintStatus.remainingKm).toFixed(0)} km`}
            </span>
          </div>
          <p className="text-xs mb-2.5" style={{ color: colors.textMuted }}>
            ODO {maintStatus.currentOdoKm.toFixed(0)} km • Target servis {maintStatus.nextServiceKm.toFixed(0)} km
          </p>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.surfaceElevated }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${maintStatus.progressPct * 100}%`,
                backgroundColor:
                  maintStatus.level === 'OVERDUE' ? colors.danger : colors.accentSecondary,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricTile: React.FC<{
  label: string;
  value: string;
  sub: string;
  color: string;
  colors: ReturnType<typeof useDashboard>['colors'];
}> = ({ label, value, sub, color, colors }) => (
  <div
    className="rounded-2xl p-3 border"
    style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}
  >
    <div className="text-[11px] font-medium" style={{ color: colors.textMuted }}>
      {label}
    </div>
    <div className="text-lg font-extrabold tnum mt-0.5" style={{ color }}>
      {value}
    </div>
    <div className="text-[11px] truncate" style={{ color: colors.textMuted }}>
      {sub}
    </div>
  </div>
);
