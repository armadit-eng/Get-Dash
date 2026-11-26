import React, { useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Edit3,
  Moon,
  Music,
  Palette,
  Power,
  Plus,
  Sun,
  Terminal,
  Trash2,
  Video,
  Volume2,
  Warehouse,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { getLiveryById, kAccentPalettes, kGarageLiveries } from '../theme/cockpitTheme';

interface GarageAccountScreenProps {
  onOpenMotovlogCam: () => void;
}

export const GarageAccountScreen: React.FC<GarageAccountScreenProps> = ({
  onOpenMotovlogCam,
}) => {
  const {
    colors,
    settings,
    updateSettings,
    esp1Data,
    setEsp1Control,
    matrixQueue,
    matrixAutoRotate,
    addMatrixItem,
    toggleMatrixItem,
    deleteMatrixItem,
    setMatrixAutoRotate,
    devSimActive,
    toggleDevSim,
    serialLogs,
    clearSerialLogs,
  } = useDashboard();

  const [editingProfile, setEditingProfile] = useState(false);
  const [matrixText, setMatrixText] = useState('');
  const [relaySlide, setRelaySlide] = useState(0);
  const [devOpen, setDevOpen] = useState(false);

  const livery = getLiveryById(settings.garageStyleId);
  const activeMatrix = matrixQueue.find((m) => m.enabled)?.text || 'GESITS EV';

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateSettings({ ...settings, avatarDataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Warehouse size={22} style={{ color: colors.accent }} />
          <h1 className="text-xl font-extrabold">Garasi, Kontrol & Akun</h1>
        </div>
        <button
          onClick={onOpenMotovlogCam}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer"
          style={{ backgroundColor: `${colors.accent}22`, color: colors.accent }}
        >
          <Video size={15} /> Motovlog HUD
        </button>
      </div>

      {/* 1. Virtual Garage Hero Card */}
      <div
        className="rounded-3xl p-5 border space-y-4"
        style={{
          background: `linear-gradient(135deg, ${livery.bodyColor}D9 0%, ${colors.surfaceCard} 100%)`,
          borderColor: `${livery.trimColor}99`,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <label className="relative cursor-pointer group">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden border-2"
                style={{
                  borderColor: livery.trimColor,
                  backgroundColor: `${livery.trimColor}26`,
                }}
              >
                {settings.avatarDataUrl ? (
                  <img src={settings.avatarDataUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <img src="/assets/ev_cockpit_icon.jpg" alt="EV" className="w-full h-full object-cover" />
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-black/70 text-white">
                <Camera size={10} />
              </span>
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </label>
            <div>
              <div className="text-base font-extrabold text-white">{settings.riderName}</div>
              <div className="text-xs text-white/75">
                {settings.bikeName} • {settings.plateNumber}
              </div>
              <div className="text-[11px] font-semibold" style={{ color: livery.trimColor }}>
                Livery: {livery.name}
              </div>
            </div>
          </div>

          <button
            onClick={() => setEditingProfile(!editingProfile)}
            className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 cursor-pointer"
          >
            <Edit3 size={16} />
          </button>
        </div>

        {editingProfile && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-white/15">
            <input
              value={settings.riderName}
              onChange={(e) => updateSettings({ ...settings, riderName: e.target.value })}
              placeholder="Nama Rider"
              className="px-3 py-2 rounded-xl text-xs bg-black/40 text-white border border-white/20 outline-none"
            />
            <input
              value={settings.bikeName}
              onChange={(e) => updateSettings({ ...settings, bikeName: e.target.value })}
              placeholder="Nama Motor"
              className="px-3 py-2 rounded-xl text-xs bg-black/40 text-white border border-white/20 outline-none"
            />
            <input
              value={settings.plateNumber}
              onChange={(e) => updateSettings({ ...settings, plateNumber: e.target.value })}
              placeholder="Plat Nomor"
              className="px-3 py-2 rounded-xl text-xs bg-black/40 text-white border border-white/20 outline-none"
            />
          </div>
        )}

        {/* Livery Selector */}
        <div className="flex flex-wrap gap-2">
          {kGarageLiveries.map((g) => {
            const sel = g.id === settings.garageStyleId;
            return (
              <button
                key={g.id}
                onClick={() => updateSettings({ ...settings, garageStyleId: g.id })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border cursor-pointer"
                style={{
                  backgroundColor: sel ? g.trimColor : 'rgba(0,0,0,0.35)',
                  borderColor: sel ? g.trimColor : 'rgba(255,255,255,0.2)',
                  color: sel ? '#041418' : '#FFFFFF',
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full border border-white/40" style={{ backgroundColor: g.bodyColor }} />
                {g.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Theme & 8 Accent Palettes */}
      <div
        className="rounded-2xl p-4 border space-y-3"
        style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold flex items-center gap-2">
            <Palette size={16} style={{ color: colors.accent }} /> Tema & Palet Aksen (8 Warna)
          </span>
          <button
            onClick={() => updateSettings({ ...settings, isDarkTheme: !settings.isDarkTheme })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer"
            style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}
          >
            {settings.isDarkTheme ? <Moon size={13} /> : <Sun size={13} />}
            {settings.isDarkTheme ? 'Gelap' : 'Terang'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {kAccentPalettes.map((pal) => {
            const sel = settings.accentId === pal.id;
            return (
              <button
                key={pal.id}
                onClick={() => updateSettings({ ...settings, accentId: pal.id })}
                className="flex items-center gap-2 p-2.5 rounded-xl border text-left cursor-pointer"
                style={{
                  backgroundColor: sel ? `${pal.primary}20` : colors.surfaceElevated,
                  borderColor: sel ? pal.primary : colors.borderSubtle,
                }}
              >
                <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: pal.primary }} />
                <span className="text-[11px] font-bold truncate">{pal.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. ESP32 #1 Hardware Controls + LED Matrix Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Relay & Mode Controls */}
        <div
          className="rounded-2xl p-4 border space-y-3"
          style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold flex items-center gap-2">
              <Power size={16} style={{ color: esp1Data.contactOn ? colors.accent : colors.warning }} />
              Kontrol ESP32 #1 (Relay & Mode)
            </span>
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-md"
              style={{
                backgroundColor: esp1Data.contactOn ? `${colors.accent}22` : `${colors.danger}22`,
                color: esp1Data.contactOn ? colors.accent : colors.danger,
              }}
            >
              Kontak: {esp1Data.contactOn ? 'ON' : 'OFF'}
            </span>
          </div>

          <div>
            <div className="text-[11px] mb-1" style={{ color: colors.textMuted }}>
              Geser ke kanan (≥90%) untuk Toggle Relay Kontak Motor
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={relaySlide}
              onChange={(e) => {
                const v = Number(e.target.value);
                setRelaySlide(v);
                if (v >= 92) {
                  setEsp1Control({ contactOn: !esp1Data.contactOn });
                  setRelaySlide(0);
                }
              }}
              onMouseUp={() => setRelaySlide(0)}
              onTouchEnd={() => setRelaySlide(0)}
              className="w-full accent-emerald-400"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { idx: 0, label: 'ECO' },
              { idx: 1, label: 'URBAN' },
              { idx: 2, label: 'SPORT' },
            ].map((m) => (
              <button
                key={m.idx}
                onClick={() => setEsp1Control({ modeIndex: m.idx })}
                className="py-2 rounded-xl text-xs font-bold border cursor-pointer"
                style={{
                  backgroundColor: esp1Data.modeIndex === m.idx ? `${colors.accent}22` : colors.surfaceElevated,
                  borderColor: esp1Data.modeIndex === m.idx ? colors.accent : colors.borderSubtle,
                  color: esp1Data.modeIndex === m.idx ? colors.accent : colors.textMuted,
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setEsp1Control({ cruiseActive: !esp1Data.cruiseActive })}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer"
              style={{
                backgroundColor: esp1Data.cruiseActive ? `${colors.regen}22` : colors.surfaceElevated,
                borderColor: esp1Data.cruiseActive ? colors.regen : colors.borderSubtle,
              }}
            >
              Cruise: {esp1Data.cruiseActive ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setEsp1Control({ reverseActive: !esp1Data.reverseActive })}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer"
              style={{
                backgroundColor: esp1Data.reverseActive ? `${colors.warning}22` : colors.surfaceElevated,
                borderColor: esp1Data.reverseActive ? colors.warning : colors.borderSubtle,
              }}
            >
              Mundur: {esp1Data.reverseActive ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* DFPlayer Audio */}
          <div className="pt-2 border-t flex items-center justify-between gap-3" style={{ borderColor: colors.borderSubtle }}>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Music size={14} style={{ color: colors.accentSecondary }} />
              <span>DFPlayer Track #{esp1Data.musicTrack}</span>
            </div>
            <div className="flex items-center gap-2">
              <Volume2 size={14} style={{ color: colors.textMuted }} />
              <input
                type="range"
                min={0}
                max={30}
                value={esp1Data.musicVol}
                onChange={(e) => setEsp1Control({ musicVol: Number(e.target.value) })}
                className="w-24"
              />
              <button
                onClick={() =>
                  setEsp1Control({
                    musicState: esp1Data.musicState === 'PLAY' ? 'STOP' : 'PLAY',
                    musicTrack: (esp1Data.musicTrack % 5) + 1,
                  })
                }
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer"
                style={{ backgroundColor: colors.accentSecondary, color: '#041418' }}
              >
                {esp1Data.musicState === 'PLAY' ? 'Stop' : 'Play'}
              </button>
            </div>
          </div>
        </div>

        {/* LED Matrix Queue */}
        <div
          className="rounded-2xl p-4 border space-y-3"
          style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">Antrean LED Matrix Belakang</span>
            <label className="flex items-center gap-1.5 text-xs font-semibold">
              <input
                type="checkbox"
                checked={matrixAutoRotate}
                onChange={(e) => setMatrixAutoRotate(e.target.checked)}
              />
              Auto-Rotate
            </label>
          </div>

          {/* LED Dot-Matrix Preview */}
          <div className="rounded-xl p-3 bg-black border border-zinc-800 text-center font-mono tracking-widest text-sm font-bold text-amber-400">
            {activeMatrix}
          </div>

          <div className="flex gap-2">
            <input
              value={matrixText}
              onChange={(e) => setMatrixText(e.target.value)}
              placeholder="Teks LED baru (maks 40 karakter)…"
              className="flex-1 px-3 py-2 rounded-xl text-xs border outline-none"
              style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}
            />
            <button
              onClick={() => {
                if (!matrixText.trim()) return;
                addMatrixItem(matrixText.trim());
                setMatrixText('');
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold cursor-pointer"
              style={{ backgroundColor: colors.accent, color: '#041418' }}
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {matrixQueue.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between px-3 py-2 rounded-xl text-xs"
                style={{ backgroundColor: colors.surfaceElevated }}
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={m.enabled}
                    onChange={() => toggleMatrixItem(m.id)}
                  />
                  <span className="font-mono font-bold">{m.text}</span>
                </label>
                <button onClick={() => deleteMatrixItem(m.id)} className="text-red-400 cursor-pointer">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Battery & Physics Parameters */}
      <div
        className="rounded-2xl p-4 border space-y-3"
        style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
      >
        <div className="text-sm font-bold">Konfigurasi Dual-Pack & Fisika Kendaraan</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <NumField
            label="B1 Volt Nominal (V)"
            value={settings.b1NominalV}
            onChange={(v) => updateSettings({ ...settings, b1NominalV: v })}
            colors={colors}
          />
          <NumField
            label="B1 Kapasitas (Ah)"
            value={settings.b1CapacityAh}
            onChange={(v) => updateSettings({ ...settings, b1CapacityAh: v })}
            colors={colors}
          />
          <NumField
            label="B2 Volt Nominal (V)"
            value={settings.b2NominalV}
            onChange={(v) => updateSettings({ ...settings, b2NominalV: v })}
            colors={colors}
          />
          <NumField
            label="B2 Kapasitas (Ah)"
            value={settings.b2CapacityAh}
            onChange={(v) => updateSettings({ ...settings, b2CapacityAh: v })}
            colors={colors}
          />
          <NumField
            label="Massa Motor (kg)"
            value={settings.bikeKg}
            onChange={(v) => updateSettings({ ...settings, bikeKg: v })}
            colors={colors}
          />
          <NumField
            label="Massa Rider (kg)"
            value={settings.riderKg}
            onChange={(v) => updateSettings({ ...settings, riderKg: v })}
            colors={colors}
          />
          <NumField
            label="Ref Konsumsi (Wh/km)"
            value={settings.refWhPerKm}
            onChange={(v) => updateSettings({ ...settings, refWhPerKm: v })}
            colors={colors}
          />
          <NumField
            label="Target Mingguan (km)"
            value={settings.weeklyGoalKm}
            onChange={(v) => updateSettings({ ...settings, weeklyGoalKm: v })}
            colors={colors}
          />
          <NumField
            label="Pole Pairs Motor (Fardriver)"
            value={settings.fardriverPolePairs}
            onChange={(v) => updateSettings({ ...settings, fardriverPolePairs: Math.max(1, v) })}
            colors={colors}
          />
          <NumField
            label="Keliling Ban (mm)"
            value={settings.wheelCircumferenceMm}
            onChange={(v) => updateSettings({ ...settings, wheelCircumferenceMm: Math.max(800, v) })}
            colors={colors}
          />
        </div>
      </div>

      {/* 5. Developer Accordion */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
      >
        <button
          onClick={() => setDevOpen(!devOpen)}
          className="w-full p-4 flex items-center justify-between text-sm font-bold cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Terminal size={16} style={{ color: colors.warning }} /> Developer & Log Serial AT+
          </span>
          {devOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {devOpen && (
          <div className="p-4 pt-0 space-y-3 border-t" style={{ borderColor: colors.borderSubtle }}>
            <div className="flex items-center justify-between pt-3">
              <div>
                <div className="text-xs font-bold">Simulasi Telemetri Dev (DEV-SIM MOTOR)</div>
                <div className="text-[11px]" style={{ color: colors.textMuted }}>
                  Suntikkan sinyal 500ms ke Motor MID, JK-BMS 20S, ESP32 #1 & #2
                </div>
              </div>
              <button
                onClick={() => toggleDevSim(!devSimActive)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                style={{
                  backgroundColor: devSimActive ? colors.warning : colors.surfaceElevated,
                  color: devSimActive ? '#041418' : colors.textPrimary,
                }}
              >
                {devSimActive ? 'AKTIF' : 'OFF'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Serial Log ({serialLogs.length})</span>
              <button
                onClick={clearSerialLogs}
                className="text-[11px] font-semibold cursor-pointer"
                style={{ color: colors.danger }}
              >
                Bersihkan Log
              </button>
            </div>
            <div
              className="rounded-xl p-3 font-mono text-[11px] max-h-48 overflow-y-auto space-y-1"
              style={{ backgroundColor: colors.background }}
            >
              {serialLogs.length === 0 ? (
                <div style={{ color: colors.textMuted }}>Belum ada log AT+ / BLE.</div>
              ) : (
                serialLogs.map((l, idx) => (
                  <div key={idx} style={{ color: l.isError ? colors.danger : colors.textMuted }}>
                    <span style={{ color: colors.accent }}>[{l.source}]</span> {l.message}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const NumField: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  colors: ReturnType<typeof useDashboard>['colors'];
}> = ({ label, value, onChange, colors }) => (
  <div>
    <label className="block text-[11px] mb-1" style={{ color: colors.textMuted }}>
      {label}
    </label>
    <input
      type="number"
      step="0.5"
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="w-full px-2.5 py-1.5 rounded-xl border text-xs font-bold tnum outline-none"
      style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}
    />
  </div>
);
