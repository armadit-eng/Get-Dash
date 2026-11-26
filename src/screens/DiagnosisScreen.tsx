import React, { useState } from 'react';
import {
  Activity,
  BatteryCharging,
  CheckCircle2,
  Cpu,
  HeartPulse,
  Send,
  ShieldAlert,
  Terminal,
  Thermometer,
  Zap,
} from 'lucide-react';
import { TelemetryLiveCharts } from '../components/TelemetryCharts';
import { useDashboard } from '../context/DashboardContext';
import {
  BMS_PROTOCOL_SPECS,
  CONTROLLER_PROTOCOL_SPECS,
  buildSampleAntHex,
  buildSampleDalyHex,
  buildSampleFardriverHex,
  buildSampleJbdHex,
} from '../engine/protocolParsers';
import { BmsProtocolId } from '../types/dashboard';

export const DiagnosisScreen: React.FC = () => {
  const {
    colors,
    effective,
    motorData,
    jkData,
    battery2Data,
    settings,
    updateSettings,
    telemetryHistory,
    restoreMotorOdo,
    injectMotorAtCommand,
    injectProtocolHexFrame,
  } = useDashboard();

  const [subTab, setSubTab] = useState<'motor' | 'battery' | 'charts'>('motor');
  const [batteryTab, setBatteryTab] = useState<'ori' | 'bms' | 'pack2'>('ori');
  const [sortLowToHigh, setSortLowToHigh] = useState(false);
  const [atInput, setAtInput] = useState('AT+SPD=48');
  const [hexTarget, setHexTarget] = useState<'controller' | 'bms'>('controller');
  const [hexInput, setHexInput] = useState(() => buildSampleFardriverHex(46));
  const [hexStatus, setHexStatus] = useState('');

  const ctrlSpec = CONTROLLER_PROTOCOL_SPECS[settings.controllerProtocol];
  const bmsSpec = BMS_PROTOCOL_SPECS[settings.bmsProtocol];

  const handleHexInject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hexInput.trim()) return;
    const ok = injectProtocolHexFrame(hexInput.trim(), hexTarget);
    setHexStatus(
      ok
        ? `Frame ${hexTarget === 'controller' ? 'Fardriver' : settings.bmsProtocol.toUpperCase()} berhasil di-parse & update telemetri.`
        : 'Gagal parse frame HEX: periksa panjang byte, header, atau CRC16/sum.'
    );
  };

  const renderCells = (voltages: number[], minIdx: number, maxIdx: number) => {
    if (voltages.length === 0) {
      return (
        <p className="text-xs" style={{ color: colors.textMuted }}>
          Hubungkan Smart BMS ({bmsSpec.name}) atau ESP32 #2 (atau aktifkan DEV-SIM) untuk melihat voltase per-sel.
        </p>
      );
    }

    const indexed = voltages.map((v, i) => ({ index: i, voltage: v }));
    const sorted = sortLowToHigh ? [...indexed].sort((a, b) => a.voltage - b.voltage) : indexed;

    return (
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {sorted.map((cell) => {
          const isMin = cell.index === minIdx;
          const isMax = cell.index === maxIdx;
          const borderCol = isMin
            ? colors.warning
            : isMax
              ? colors.accent
              : colors.borderSubtle;
          return (
            <div
              key={cell.index}
              className="rounded-xl p-2 border text-center"
              style={{
                backgroundColor: isMin
                  ? `${colors.warning}15`
                  : isMax
                    ? `${colors.accent}15`
                    : colors.surfaceElevated,
                borderColor: borderCol,
              }}
            >
              <div className="text-[10px] font-bold" style={{ color: colors.textMuted }}>
                S{cell.index + 1} {isMin ? 'MIN' : isMax ? 'MAX' : ''}
              </div>
              <div className="text-xs font-extrabold tnum mt-0.5">{cell.voltage.toFixed(3)}V</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-24 md:pb-8">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HeartPulse size={22} style={{ color: colors.accent }} />
          <h1 className="text-xl font-extrabold">Diagnostik EV & BMS</h1>
        </div>
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-full border"
          style={{
            backgroundColor: colors.surfaceCard,
            borderColor: colors.borderSubtle,
            color: colors.accent,
          }}
        >
          {settings.controllerProtocol === 'fardriver' ? 'Fardriver' : 'Motor MID'} + {settings.bmsProtocol.toUpperCase()}
        </span>
      </div>

      {/* Sub-tabs */}
      <div
        className="grid grid-cols-3 p-1 rounded-2xl border"
        style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
      >
        {[
          { id: 'motor' as const, label: 'Motor & Protokol' },
          { id: 'battery' as const, label: 'ORI vs Smart BMS' },
          { id: 'charts' as const, label: 'Grafik Live' },
        ].map((t) => {
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className="py-2 rounded-xl text-xs font-bold transition cursor-pointer"
              style={{
                backgroundColor: active ? `${colors.accent}22` : 'transparent',
                color: active ? colors.accent : colors.textMuted,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {subTab === 'motor' && (
        <div className="space-y-4">
          {/* Drive Status & Temps */}
          <div
            className="rounded-2xl p-4 border space-y-3"
            style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold flex items-center gap-2">
                <Cpu size={16} style={{ color: colors.accent }} /> {ctrlSpec.name}
              </span>
              <span className="text-xs font-bold tnum" style={{ color: colors.accent }}>
                {effective.rpm ?? 0} RPM • Mode {effective.modeLabel}
              </span>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1" style={{ color: colors.textMuted }}>
                <span>Throttle Sensor</span>
                <span className="font-bold tnum">
                  {Math.round(effective.throttlePct ?? 0)}%
                  {motorData.throttleVoltV !== undefined ? ` (${motorData.throttleVoltV.toFixed(2)}V)` : ''}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: colors.surfaceElevated }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(0, effective.throttlePct ?? 0))}%`,
                    backgroundColor: colors.accent,
                  }}
                />
              </div>
            </div>

            {/* Fardriver-specific telemetry row */}
            {settings.controllerProtocol === 'fardriver' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-xl p-2.5 border" style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}>
                  <div className="text-[10px] font-bold" style={{ color: colors.textMuted }}>PHASE CURRENT</div>
                  <div className="text-sm font-extrabold tnum mt-0.5" style={{ color: colors.accent }}>
                    {motorData.phaseCurrentA?.toFixed(1) ?? '--'} A
                  </div>
                </div>
                <div className="rounded-xl p-2.5 border" style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}>
                  <div className="text-[10px] font-bold" style={{ color: colors.textMuted }}>LINE CURRENT</div>
                  <div className="text-sm font-extrabold tnum mt-0.5">
                    {motorData.ibat?.toFixed(1) ?? '--'} A
                  </div>
                </div>
                <div className="rounded-xl p-2.5 border" style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}>
                  <div className="text-[10px] font-bold" style={{ color: colors.textMuted }}>ERPM / POLE</div>
                  <div className="text-sm font-extrabold tnum mt-0.5">
                    {motorData.erpm ?? motorData.rpm ?? 0} ({settings.fardriverPolePairs}p)
                  </div>
                </div>
                <div className="rounded-xl p-2.5 border" style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}>
                  <div className="text-[10px] font-bold" style={{ color: colors.textMuted }}>BRAKE CUTOFF</div>
                  <div
                    className="text-sm font-extrabold mt-0.5"
                    style={{ color: motorData.brakeActive ? colors.regen : colors.textMuted }}
                  >
                    {motorData.brakeActive ? 'REGEN / CUT' : 'RELEASED'}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Parkir', on: effective.isPark === true, color: colors.warning },
                { label: 'Standar Samping', on: effective.sideStandDown, color: colors.danger },
                { label: 'Cruise', on: effective.cruiseActive, color: colors.regen },
                { label: 'Mundur', on: effective.reverseActive, color: colors.warning },
              ].map((s) => (
                <span
                  key={s.label}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold border"
                  style={{
                    backgroundColor: s.on ? `${s.color}20` : colors.surfaceElevated,
                    borderColor: s.on ? s.color : colors.borderSubtle,
                    color: s.on ? s.color : colors.textMuted,
                  }}
                >
                  {s.label}: {s.on ? 'AKTIF' : 'OFF'}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'T_MOTOR', val: motorData.tempMotorC },
                { label: 'T_CTRL/INV', val: motorData.tempInverterC },
                { label: 'T_BATERAI ORI', val: effective.oriTempC },
              ].map((t) => (
                <div
                  key={t.label}
                  className="rounded-xl p-2.5 border"
                  style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}
                >
                  <div className="text-[10px] font-bold flex items-center gap-1" style={{ color: colors.textMuted }}>
                    <Thermometer size={11} /> {t.label}
                  </div>
                  <div className="text-base font-extrabold tnum mt-0.5">
                    {t.val !== undefined ? `${t.val.toFixed(1)}°C` : '--°C'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ODO Sync Card */}
          <div
            className="rounded-2xl p-4 border flex items-center justify-between gap-3"
            style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
          >
            <div>
              <div className="text-sm font-bold">Odometer Kontroler & Backup</div>
              <div className="text-xs tnum" style={{ color: colors.textMuted }}>
                Kontroler: {motorData.odoKm?.toFixed(1) ?? '--'} km • Backup App: {settings.odoBackupKm.toFixed(1)} km
              </div>
            </div>
            <button
              onClick={() => restoreMotorOdo(settings.odoBackupKm)}
              className="px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer"
              style={{ borderColor: colors.accent, color: colors.accent }}
            >
              Sinkron AT+ODO
            </button>
          </div>

          {/* DTC Error Bitmask Analyzer */}
          <div
            className="rounded-2xl p-4 border space-y-3"
            style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {effective.activeErrors.length === 0 ? (
                  <CheckCircle2 size={18} style={{ color: colors.accent }} />
                ) : (
                  <ShieldAlert size={18} style={{ color: colors.danger }} />
                )}
                <span className="text-sm font-bold">
                  {effective.activeErrors.length === 0
                    ? `Tidak Ada Kode Fault (ERR=0x${motorData.errMask.toString(16).toUpperCase().padStart(2, '0')})`
                    : `${effective.activeErrors.length} Kode Fault Terdeteksi`}
                </span>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => injectMotorAtCommand('AT+ERR=12')}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer"
                  style={{ borderColor: colors.warning, color: colors.warning }}
                >
                  Simulasi Fault
                </button>
                <button
                  onClick={() => injectMotorAtCommand('AT+ERR=0')}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer"
                  style={{ borderColor: colors.borderSubtle, color: colors.textMuted }}
                >
                  Clear DTC
                </button>
              </div>
            </div>

            {effective.activeErrors.length === 0 ? (
              <p className="text-xs" style={{ color: colors.textMuted }}>
                Sistem controller, hall sensor, throttle, dan proteksi suhu dalam kondisi sehat.
              </p>
            ) : (
              <div className="space-y-2">
                {effective.activeErrors.map((err) => (
                  <div
                    key={err.bit}
                    className="rounded-xl p-3 border"
                    style={{
                      backgroundColor: `${colors.danger}16`,
                      borderColor: `${colors.danger}55`,
                    }}
                  >
                    <div className="text-xs font-bold" style={{ color: colors.danger }}>
                      Bit {err.bit}: {err.label}
                    </div>
                    <div className="text-xs mt-1">Solusi: {err.fix}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick AT+ Serial Injector */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (atInput.trim()) injectMotorAtCommand(atInput.trim());
              }}
              className="flex gap-2 pt-2 border-t"
              style={{ borderColor: colors.borderSubtle }}
            >
              <input
                value={atInput}
                onChange={(e) => setAtInput(e.target.value)}
                placeholder="Kirim perintah AT+ (cth: AT+SPD=55, AT+ERR=8)"
                className="flex-1 px-3 py-2 rounded-xl text-xs font-mono border outline-none"
                style={{
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.borderSubtle,
                  color: colors.textPrimary,
                }}
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                style={{ backgroundColor: colors.accent, color: '#041418' }}
              >
                <Send size={13} /> Kirim AT+
              </button>
            </form>
          </div>

          {/* Protocol HEX Frame Tester: Fardriver / ANT / DALY / JBD */}
          <div
            className="rounded-2xl p-4 border space-y-3"
            style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold flex items-center gap-2">
                <Terminal size={16} style={{ color: colors.warning }} /> Uji Parser Frame HEX (Fardriver & Smart BMS)
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setHexTarget('controller');
                    setHexInput(buildSampleFardriverHex(46));
                    setHexStatus('');
                  }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer"
                  style={{
                    backgroundColor: hexTarget === 'controller' ? `${colors.accent}20` : colors.surfaceElevated,
                    borderColor: hexTarget === 'controller' ? colors.accent : colors.borderSubtle,
                    color: hexTarget === 'controller' ? colors.accent : colors.textMuted,
                  }}
                >
                  Sample Fardriver 0x13
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateSettings({ ...settings, bmsProtocol: 'ant' });
                    setHexTarget('bms');
                    setHexInput(buildSampleAntHex());
                    setHexStatus('');
                  }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer"
                  style={{ borderColor: colors.borderSubtle, color: colors.textMuted }}
                >
                  Sample ANT
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateSettings({ ...settings, bmsProtocol: 'daly' });
                    setHexTarget('bms');
                    setHexInput(buildSampleDalyHex());
                    setHexStatus('');
                  }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer"
                  style={{ borderColor: colors.borderSubtle, color: colors.textMuted }}
                >
                  Sample DALY
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateSettings({ ...settings, bmsProtocol: 'jbd' });
                    setHexTarget('bms');
                    setHexInput(buildSampleJbdHex());
                    setHexStatus('');
                  }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer"
                  style={{ borderColor: colors.borderSubtle, color: colors.textMuted }}
                >
                  Sample JBD
                </button>
              </div>
            </div>

            <form onSubmit={handleHexInject} className="space-y-2">
              <div className="flex gap-2">
                <select
                  value={hexTarget}
                  onChange={(e) => setHexTarget(e.target.value as 'controller' | 'bms')}
                  className="px-2.5 py-2 rounded-xl text-xs font-bold border outline-none"
                  style={{
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.borderSubtle,
                    color: colors.textPrimary,
                  }}
                >
                  <option value="controller">Kontroler (Fardriver AA 13/14)</option>
                  <option value="bms">Smart BMS ({settings.bmsProtocol.toUpperCase()})</option>
                </select>
                <input
                  value={hexInput}
                  onChange={(e) => setHexInput(e.target.value)}
                  placeholder="Tempel frame HEX (spasi opsional)…"
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-mono border outline-none"
                  style={{
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.borderSubtle,
                    color: colors.textPrimary,
                  }}
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                  style={{ backgroundColor: colors.warning, color: '#041418' }}
                >
                  <Zap size={13} /> Decode
                </button>
              </div>
              {hexStatus && (
                <div className="text-[11px] font-medium" style={{ color: colors.accent }}>
                  {hexStatus}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {subTab === 'battery' && (
        <div className="space-y-4">
          {/* 3 Isolated Sources: Baterai ORI/MID vs Smart BMS Eksternal vs Baterai 2 */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'ori' as const, label: `Baterai ORI (${effective.oriSourceLabel})` },
              { id: 'bms' as const, label: `Smart BMS (${effective.smartBmsLabel})` },
              { id: 'pack2' as const, label: 'Baterai 2 (ESP2 CAN)' },
            ].map((b) => (
              <button
                key={b.id}
                onClick={() => setBatteryTab(b.id)}
                className="py-2.5 px-2.5 rounded-xl text-xs font-bold border cursor-pointer truncate"
                style={{
                  backgroundColor: batteryTab === b.id ? `${colors.accent}22` : colors.surfaceCard,
                  borderColor: batteryTab === b.id ? colors.accent : colors.borderSubtle,
                  color: batteryTab === b.id ? colors.accent : colors.textMuted,
                }}
              >
                {b.label}
              </button>
            ))}
          </div>

          {batteryTab === 'ori' && (
            <div
              className="rounded-2xl p-4 border space-y-3"
              style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold flex items-center gap-2">
                    <Cpu size={17} style={{ color: colors.accent }} /> Baterai ORI / MID (Terisolasi)
                  </div>
                  <div className="text-[11px]" style={{ color: colors.textMuted }}>
                    Data murni dari Kontroler {effective.oriSourceLabel} — tidak tercampur dengan Smart BMS eksternal
                  </div>
                </div>
                <span className="text-2xl font-extrabold tnum" style={{ color: colors.accent }}>
                  {effective.oriActive && effective.oriSocPct !== undefined
                    ? `${Math.round(effective.oriSocPct)}%`
                    : 'Offline'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div style={{ color: colors.textMuted }}>Volt Pack ORI</div>
                  <div className="font-bold tnum">{motorData.vbat?.toFixed(2) ?? '--'} V</div>
                </div>
                <div>
                  <div style={{ color: colors.textMuted }}>Arus Line ORI</div>
                  <div className="font-bold tnum">{motorData.ibat?.toFixed(2) ?? '--'} A</div>
                </div>
                <div>
                  <div style={{ color: colors.textMuted }}>SOH / Siklus ORI</div>
                  <div className="font-bold tnum">
                    {motorData.sohPct?.toFixed(0) ?? '--'}% / {motorData.cbatCycles ?? '--'}
                  </div>
                </div>
                <div>
                  <div style={{ color: colors.textMuted }}>Suhu Baterai ORI</div>
                  <div className="font-bold tnum">{motorData.tempBatteryC?.toFixed(1) ?? '--'}°C</div>
                </div>
                <div>
                  <div style={{ color: colors.textMuted }}>Suhu Motor</div>
                  <div className="font-bold tnum">{motorData.tempMotorC?.toFixed(1) ?? '--'}°C</div>
                </div>
                <div>
                  <div style={{ color: colors.textMuted }}>Protokol Aktif</div>
                  <div className="font-bold">{effective.oriSourceLabel}</div>
                </div>
              </div>
            </div>
          )}

          {batteryTab === 'bms' && (
            <>
              <div
                className="rounded-2xl p-4 border space-y-3"
                style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold flex items-center gap-2">
                      <BatteryCharging size={17} style={{ color: colors.warning }} /> Smart BMS Eksternal: {bmsSpec.name}
                    </div>
                    <div className="text-[11px]" style={{ color: colors.textMuted }}>
                      Terpisah dari Baterai ORI/MID • UUID: {bmsSpec.bleServiceUuid.slice(4, 8).toUpperCase()}
                    </div>
                  </div>
                  <span className="text-2xl font-extrabold tnum" style={{ color: colors.warning }}>
                    {effective.smartBmsActive && jkData.socPct !== undefined
                      ? `${Math.round(jkData.socPct)}%`
                      : 'Offline'}
                  </span>
                </div>

                {/* Quick BMS protocol switcher */}
                <div className="grid grid-cols-4 gap-1.5">
                  {(['jk', 'ant', 'daly', 'jbd'] as BmsProtocolId[]).map((proto) => {
                    const active = settings.bmsProtocol === proto;
                    return (
                      <button
                        key={proto}
                        onClick={() => updateSettings({ ...settings, bmsProtocol: proto })}
                        className="py-1.5 rounded-lg text-[11px] font-bold border uppercase cursor-pointer"
                        style={{
                          backgroundColor: active ? `${colors.warning}22` : colors.surfaceElevated,
                          borderColor: active ? colors.warning : colors.borderSubtle,
                          color: active ? colors.warning : colors.textMuted,
                        }}
                      >
                        {proto}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div style={{ color: colors.textMuted }}>Volt Pack BMS</div>
                    <div className="font-bold tnum">{jkData.vpack?.toFixed(2) ?? '--'} V</div>
                  </div>
                  <div>
                    <div style={{ color: colors.textMuted }}>Arus BMS</div>
                    <div className="font-bold tnum">{jkData.ibat?.toFixed(2) ?? '--'} A</div>
                  </div>
                  <div>
                    <div style={{ color: colors.textMuted }}>SOH / Siklus</div>
                    <div className="font-bold tnum">
                      {jkData.sohPct?.toFixed(0) ?? '--'}% / {jkData.cycles ?? '--'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: colors.textMuted }}>Delta Sel</div>
                    <div className="font-bold tnum">
                      {jkData.deltaCellV !== undefined ? `${Math.round(jkData.deltaCellV * 1000)} mV` : '--'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: colors.textMuted }}>T1 / T2</div>
                    <div className="font-bold tnum">
                      {jkData.temp1C?.toFixed(1) ?? '--'} / {jkData.temp2C?.toFixed(1) ?? '--'}°C
                    </div>
                  </div>
                  <div>
                    <div style={{ color: colors.textMuted }}>MOSFET / Status</div>
                    <div className="font-bold tnum">
                      {jkData.tempMosC?.toFixed(1) ?? '--'}°C • CHG:{jkData.chargeMosOn ? 'ON' : 'OFF'} DSG:{jkData.dischargeMosOn ? 'ON' : 'OFF'}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="rounded-2xl p-4 border space-y-3"
                style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">
                    Tegangan Per-Sel {effective.smartBmsLabel} ({jkData.cellCount}S)
                  </span>
                  <button
                    onClick={() => setSortLowToHigh(!sortLowToHigh)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer"
                    style={{
                      backgroundColor: sortLowToHigh ? `${colors.accent}22` : colors.surfaceElevated,
                      borderColor: sortLowToHigh ? colors.accent : colors.borderSubtle,
                      color: sortLowToHigh ? colors.accent : colors.textMuted,
                    }}
                  >
                    Urutkan Min
                  </button>
                </div>
                {renderCells(jkData.cellVoltages, jkData.minCellIndex, jkData.maxCellIndex)}
              </div>
            </>
          )}

          {batteryTab === 'pack2' && (
            <>
              <div
                className="rounded-2xl p-4 border space-y-3"
                style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">
                    Baterai 2 • CAN Mode: {battery2Data.canMode}
                  </span>
                  <span className="text-2xl font-extrabold tnum" style={{ color: colors.accentSecondary }}>
                    {effective.b2SocPct !== undefined ? `${Math.round(effective.b2SocPct)}%` : '--%'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div style={{ color: colors.textMuted }}>Volt Pack 2</div>
                    <div className="font-bold tnum">{battery2Data.vbat?.toFixed(2) ?? '--'} V</div>
                  </div>
                  <div>
                    <div style={{ color: colors.textMuted }}>Arus Pack 2</div>
                    <div className="font-bold tnum">{battery2Data.ibat?.toFixed(2) ?? '--'} A</div>
                  </div>
                  <div>
                    <div style={{ color: colors.textMuted }}>Delta Sel</div>
                    <div className="font-bold tnum">
                      {battery2Data.deltaCellV !== undefined
                        ? `${Math.round(battery2Data.deltaCellV * 1000)} mV`
                        : '--'}
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="rounded-2xl p-4 border space-y-3"
                style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
              >
                <div className="text-sm font-bold">
                  Sel Pack 2 ({battery2Data.cellCount}S)
                </div>
                {renderCells(
                  battery2Data.cellVoltages,
                  battery2Data.cellVoltages.length > 0
                    ? battery2Data.cellVoltages.indexOf(Math.min(...battery2Data.cellVoltages))
                    : -1,
                  battery2Data.cellVoltages.length > 0
                    ? battery2Data.cellVoltages.indexOf(Math.max(...battery2Data.cellVoltages))
                    : -1
                )}
              </div>
            </>
          )}
        </div>
      )}

      {subTab === 'charts' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs" style={{ color: colors.textMuted }}>
            <span className="flex items-center gap-1.5">
              <Activity size={14} style={{ color: colors.accent }} />
              Buffer Telemetri 240-titik (1 Hz)
            </span>
            <span className="tnum">{telemetryHistory.length} / 240 sampel</span>
          </div>
          <TelemetryLiveCharts history={telemetryHistory} colors={colors} />
        </div>
      )}
    </div>
  );
};
