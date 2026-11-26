import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { colors } = useDashboard();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={() => void install()}
        className={`flex items-center justify-center gap-1.5 rounded-xl font-bold cursor-pointer transition ${
          compact ? 'px-2.5 py-1.5 text-[11px]' : 'w-full px-3 py-2 text-xs'
        }`}
        style={{ backgroundColor: colors.accent, color: '#041418' }}
      >
        <Download size={14} />
        <span>Install PWA</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center justify-center gap-1.5 rounded-xl font-bold border cursor-pointer ${
            compact ? 'px-2.5 py-1.5 text-[11px]' : 'w-full px-3 py-2 text-xs'
          }`}
          style={{
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.borderSubtle,
            color: colors.accent,
          }}
        >
          <Smartphone size={14} />
          <span>Install iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div
              className="w-full max-w-sm rounded-2xl p-5 border space-y-3"
              style={{
                backgroundColor: colors.surfaceCard,
                borderColor: colors.borderSubtle,
                color: colors.textPrimary,
              }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold">Install di iPhone / iPad</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg cursor-pointer"
                  style={{ color: colors.textMuted }}
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: colors.textMuted }}>
                1. Ketuk tombol <strong style={{ color: colors.textPrimary }}>Share</strong> di toolbar Safari.
                <br />
                2. Gulir ke bawah lalu pilih{' '}
                <strong style={{ color: colors.textPrimary }}>Add to Home Screen</strong>.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 rounded-xl text-xs font-bold cursor-pointer"
                style={{ backgroundColor: colors.accent, color: '#041418' }}
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { colors } = useDashboard();

  if (isOnline) return null;

  return (
    <div
      className="fixed bottom-20 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold border shadow-lg"
      style={{
        backgroundColor: colors.surfaceCard,
        borderColor: colors.warning,
        color: colors.warning,
      }}
    >
      <WifiOff size={14} />
      <span>Mode Offline — Data cache & BLE tetap aktif</span>
    </div>
  );
};
