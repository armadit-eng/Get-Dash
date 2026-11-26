import React, { useState } from 'react';
import {
  Award,
  BarChart3,
  Download,
  FileDown,
  Flame,
  Plus,
  Sliders,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { downloadTextFile, exportTripGpx, exportTripsCsv } from '../engine/routePhysics';

export const StatsScreen: React.FC = () => {
  const {
    colors,
    settings,
    tripHistory,
    liveTrip,
    fuelSavings,
    badges,
    personalRecords,
    efficiencyTrend,
    maintLogs,
    calibLogs,
    effective,
    deleteTrip,
    addMaintLog,
    addCalibrationLog,
  } = useDashboard();

  const [maintCategory, setMaintCategory] = useState('Kampas Rem & Ban');
  const [maintCost, setMaintCost] = useState('75000');
  const [maintNote, setMaintNote] = useState('');
  const [calibVal, setCalibVal] = useState(settings.calFactor.toFixed(2));

  const totalKm = tripHistory.reduce((a, b) => a + b.distanceKm, 0) + liveTrip.distanceKm;
  const totalRegen = tripHistory.reduce((a, b) => a + b.regenWh, 0) + liveTrip.regenWh;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const weeklyKm =
    tripHistory
      .filter((t) => t.endTimeMs >= weekAgo)
      .reduce((a, b) => a + b.distanceKm, 0) + liveTrip.distanceKm;
  const goalPct = Math.min(1, weeklyKm / Math.max(1, settings.weeklyGoalKm));

  return (
    <div className="space-y-4 pb-24 md:pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={22} style={{ color: colors.accent }} />
          <h1 className="text-xl font-extrabold">Statistik, Trip & Servis</h1>
        </div>
        <button
          disabled={tripHistory.length === 0}
          onClick={() =>
            downloadTextFile('Riwayat_Trip_EV.csv', exportTripsCsv(tripHistory), 'text/csv;charset=utf-8')
          }
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border disabled:opacity-40 cursor-pointer"
          style={{ borderColor: colors.borderSubtle, color: colors.accent }}
        >
          <Download size={14} /> Ekspor CSV
        </button>
      </div>

      {/* 1. Lifetime KPI + Weekly Goal */}
      <div
        className="rounded-2xl p-4 border space-y-4"
        style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiBox label="Total Jarak" value={`${totalKm.toFixed(1)} km`} color={colors.accent} colors={colors} />
          <KpiBox
            label="Hemat BBM"
            value={`Rp ${Math.round(fuelSavings.netSavingsRp).toLocaleString('id-ID')}`}
            color={colors.accentSecondary}
            colors={colors}
          />
          <KpiBox
            label="CO₂ Dihemat"
            value={`${fuelSavings.co2SavedKg.toFixed(1)} kg`}
            color={colors.regen}
            colors={colors}
          />
          <KpiBox
            label="Puncak / Regen"
            value={`${Math.round(personalRecords.maxSpeedKmh)} km/h • +${Math.round(totalRegen)} Wh`}
            color={colors.warning}
            colors={colors}
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-semibold">
              Target Mingguan ({weeklyKm.toFixed(1)} / {Math.round(settings.weeklyGoalKm)} km)
            </span>
            <span className="font-extrabold tnum" style={{ color: colors.accent }}>
              {Math.round(goalPct * 100)}%
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: colors.surfaceElevated }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${goalPct * 100}%`, backgroundColor: colors.accent }}
            />
          </div>
        </div>
      </div>

      {/* 2. Badges & Personal Records */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          className="rounded-2xl p-4 border space-y-3"
          style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
        >
          <div className="flex items-center gap-2 text-sm font-bold">
            <Award size={16} style={{ color: colors.warning }} /> Pencapaian Pengendara
          </div>
          <div className="grid grid-cols-2 gap-2">
            {badges.map((b) => (
              <div
                key={b.id}
                className="rounded-xl p-2.5 border"
                style={{
                  backgroundColor: b.unlocked ? `${colors.accent}14` : colors.surfaceElevated,
                  borderColor: b.unlocked ? colors.accent : colors.borderSubtle,
                }}
              >
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>{b.title}</span>
                  <span style={{ color: b.unlocked ? colors.accent : colors.textMuted }}>
                    {Math.round(b.progress * 100)}%
                  </span>
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: colors.textMuted }}>
                  {b.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-2xl p-4 border space-y-3"
          style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold flex items-center gap-2">
              <Flame size={16} style={{ color: colors.accentSecondary }} /> Rekor Pribadi & Tren
            </span>
            {efficiencyTrend && (
              <span
                className="flex items-center gap-1 text-xs font-bold"
                style={{
                  color: efficiencyTrend.deltaPct <= 0 ? colors.accent : colors.warning,
                }}
              >
                {efficiencyTrend.deltaPct <= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                {efficiencyTrend.deltaPct.toFixed(1)}% Wh/km
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: colors.surfaceElevated }}>
              <div style={{ color: colors.textMuted }}>Trip Terjauh</div>
              <div className="font-bold tnum">{personalRecords.longestTripKm.toFixed(2)} km</div>
            </div>
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: colors.surfaceElevated }}>
              <div style={{ color: colors.textMuted }}>Efisiensi Terbaik</div>
              <div className="font-bold tnum">
                {personalRecords.bestEfficiencyWhKm?.toFixed(1) ?? '--'} Wh/km
              </div>
            </div>
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: colors.surfaceElevated }}>
              <div style={{ color: colors.textMuted }}>Skor Riding Terbaik</div>
              <div className="font-bold tnum">{personalRecords.bestScore ?? '--'}</div>
            </div>
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: colors.surfaceElevated }}>
              <div style={{ color: colors.textMuted }}>Regen Terbesar</div>
              <div className="font-bold tnum">+{Math.round(personalRecords.mostRegenWh)} Wh</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Trip History */}
      <div
        className="rounded-2xl p-4 border space-y-3"
        style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
      >
        <div className="text-sm font-bold">Riwayat Perjalanan ({tripHistory.length})</div>
        {tripHistory.length === 0 ? (
          <p className="text-xs" style={{ color: colors.textMuted }}>
            Belum ada trip tersimpan. Aktifkan DEV-SIM atau berkendara lalu tekan Simpan Trip di Kokpit.
          </p>
        ) : (
          <div className="space-y-2">
            {tripHistory.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border"
                style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">
                    {t.startArea} → {t.endArea}
                  </div>
                  <div className="text-[11px] tnum" style={{ color: colors.textMuted }}>
                    {new Date(t.endTimeMs).toLocaleString('id-ID')} • {t.distanceKm.toFixed(2)} km •{' '}
                    {t.whPerKm.toFixed(1)} Wh/km • Skor {t.ridingScore ?? '--'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() =>
                      downloadTextFile(`${t.id}.gpx`, exportTripGpx(t), 'application/gpx+xml')
                    }
                    className="p-2 rounded-lg border cursor-pointer"
                    style={{ borderColor: colors.borderSubtle, color: colors.accentSecondary }}
                    title="Ekspor GPX"
                  >
                    <FileDown size={14} />
                  </button>
                  <button
                    onClick={() => deleteTrip(t.id)}
                    className="p-2 rounded-lg border cursor-pointer"
                    style={{ borderColor: colors.borderSubtle, color: colors.danger }}
                    title="Hapus Trip"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Maintenance Logbook & Energy Calibration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          className="rounded-2xl p-4 border space-y-3"
          style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
        >
          <div className="flex items-center gap-2 text-sm font-bold">
            <Wrench size={16} style={{ color: colors.accentSecondary }} /> Buku Servis & Perawatan
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={maintCategory}
              onChange={(e) => setMaintCategory(e.target.value)}
              placeholder="Jenis servis"
              className="px-3 py-2 rounded-xl text-xs border outline-none"
              style={{
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.borderSubtle,
              }}
            />
            <input
              value={maintCost}
              onChange={(e) => setMaintCost(e.target.value)}
              type="number"
              placeholder="Biaya (Rp)"
              className="px-3 py-2 rounded-xl text-xs border outline-none"
              style={{
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.borderSubtle,
              }}
            />
          </div>
          <div className="flex gap-2">
            <input
              value={maintNote}
              onChange={(e) => setMaintNote(e.target.value)}
              placeholder="Catatan servis (opsional)"
              className="flex-1 px-3 py-2 rounded-xl text-xs border outline-none"
              style={{
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.borderSubtle,
              }}
            />
            <button
              onClick={() => {
                addMaintLog({
                  odoKm: effective.odoKm ?? settings.odoBackupKm,
                  category: maintCategory || 'Servis Rutin',
                  notes: maintNote || 'Pemeriksaan berkala',
                  costRp: Number(maintCost) || 0,
                });
                setMaintNote('');
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
              style={{ backgroundColor: colors.accent, color: '#041418' }}
            >
              <Plus size={14} /> Catat
            </button>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {maintLogs.map((m) => (
              <div
                key={m.id}
                className="flex justify-between text-xs p-2.5 rounded-xl"
                style={{ backgroundColor: colors.surfaceElevated }}
              >
                <div>
                  <div className="font-bold">{m.category}</div>
                  <div className="text-[11px]" style={{ color: colors.textMuted }}>
                    ODO {m.odoKm.toFixed(0)} km • {m.notes}
                  </div>
                </div>
                <div className="font-bold tnum">Rp {m.costRp.toLocaleString('id-ID')}</div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-2xl p-4 border space-y-3"
          style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
        >
          <div className="flex items-center gap-2 text-sm font-bold">
            <Sliders size={16} style={{ color: colors.warning }} /> Kalibrasi Faktor Energi Rute
          </div>
          <p className="text-xs" style={{ color: colors.textMuted }}>
            Faktor pengali fisika rute saat ini: <strong className="tnum">{settings.calFactor.toFixed(2)}x</strong>
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.05"
              min="0.6"
              max="1.6"
              value={calibVal}
              onChange={(e) => setCalibVal(e.target.value)}
              className="w-28 px-3 py-2 rounded-xl text-xs font-bold border outline-none tnum"
              style={{
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.borderSubtle,
              }}
            />
            <button
              onClick={() =>
                addCalibrationLog(
                  Math.min(1.6, Math.max(0.6, Number(calibVal) || 1.0)),
                  'Penyesuaian manual Wh/km'
                )
              }
              className="px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer"
              style={{ backgroundColor: colors.accentSecondary, color: '#041418' }}
            >
              Simpan Kalibrasi
            </button>
          </div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {calibLogs.map((c) => (
              <div
                key={c.id}
                className="flex justify-between text-xs p-2 rounded-xl"
                style={{ backgroundColor: colors.surfaceElevated }}
              >
                <span>{c.note}</span>
                <span className="font-bold tnum">{c.factor.toFixed(2)}x</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const KpiBox: React.FC<{
  label: string;
  value: string;
  color: string;
  colors: ReturnType<typeof useDashboard>['colors'];
}> = ({ label, value, color, colors }) => (
  <div className="p-3 rounded-xl" style={{ backgroundColor: colors.surfaceElevated }}>
    <div className="text-[11px]" style={{ color: colors.textMuted }}>
      {label}
    </div>
    <div className="text-sm font-extrabold tnum mt-0.5" style={{ color }}>
      {value}
    </div>
  </div>
);
