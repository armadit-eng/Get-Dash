import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';

export interface VersionManifest {
  version: string;
  buildTime?: string;
  commit?: string;
  notes?: string;
}

export const CURRENT_APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
export const CURRENT_BUILD_TIME =
  typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : '';

export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, '').split('.').map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

export async function fetchLatestVersionManifest(): Promise<VersionManifest | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as VersionManifest;
    if (!data?.version) return null;
    return data;
  } catch {
    return null;
  }
}

export function isRemoteUpdateAvailable(remote: VersionManifest): boolean {
  const cmp = compareSemver(remote.version, CURRENT_APP_VERSION);
  if (cmp > 0) return true;
  if (
    cmp === 0 &&
    remote.buildTime &&
    CURRENT_BUILD_TIME &&
    remote.buildTime !== CURRENT_BUILD_TIME
  ) {
    const remoteMs = Date.parse(remote.buildTime);
    const localMs = Date.parse(CURRENT_BUILD_TIME);
    if (!Number.isNaN(remoteMs) && !Number.isNaN(localMs) && remoteMs - localMs > 60_000) {
      return true;
    }
  }
  return false;
}

export async function reloadToLatestVersion(): Promise<void> {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // Ignore cache clear failures
  }
  window.location.reload();
}

export const UpdateNotifier: React.FC = () => {
  const { colors } = useDashboard();
  const [available, setAvailable] = useState<VersionManifest | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string>(() => {
    try {
      return sessionStorage.getItem('dismissed_update_version') || '';
    } catch {
      return '';
    }
  });
  const [updating, setUpdating] = useState(false);

  const checkForUpdate = useCallback(async () => {
    const remote = await fetchLatestVersionManifest();
    if (!remote) return;
    if (isRemoteUpdateAvailable(remote)) {
      setAvailable(remote);
    }
  }, []);

  useEffect(() => {
    const initTimer = window.setTimeout(() => {
      void checkForUpdate();
    }, 2500);

    const interval = window.setInterval(() => {
      void checkForUpdate();
    }, 5 * 60 * 1000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdate();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [checkForUpdate]);

  if (!available || available.version === dismissedVersion) {
    return null;
  }

  const handleDismiss = () => {
    setDismissedVersion(available.version);
    try {
      sessionStorage.setItem('dismissed_update_version', available.version);
    } catch {
      // Ignore storage errors
    }
  };

  const handleReload = async () => {
    setUpdating(true);
    await reloadToLatestVersion();
  };

  return (
    <div className="fixed top-3 right-3 left-3 md:left-auto md:w-96 z-50">
      <div
        className="rounded-2xl p-4 border shadow-2xl backdrop-blur-md space-y-2.5"
        style={{
          backgroundColor: `${colors.surfaceCard}F5`,
          borderColor: colors.accent,
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${colors.accent}22`, color: colors.accent }}
            >
              <Sparkles size={16} />
            </div>
            <div>
              <div className="text-xs font-extrabold" style={{ color: colors.accent }}>
                Update Aplikasi Tersedia (v{available.version})
              </div>
              <div className="text-[11px]" style={{ color: colors.textMuted }}>
                Versi aktif saat ini: v{CURRENT_APP_VERSION}
              </div>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg cursor-pointer"
            style={{ color: colors.textMuted }}
            aria-label="Tutup notifikasi update"
          >
            <X size={15} />
          </button>
        </div>

        {available.notes && (
          <p className="text-xs leading-snug" style={{ color: colors.textPrimary }}>
            {available.notes}
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleReload}
            disabled={updating}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold cursor-pointer"
            style={{ backgroundColor: colors.accent, color: '#041418' }}
          >
            <RefreshCw size={13} className={updating ? 'animate-spin' : ''} />
            {updating ? 'Memuat Ulang…' : 'Update & Muat Ulang'}
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer"
            style={{ borderColor: colors.borderSubtle, color: colors.textMuted }}
          >
            Nanti
          </button>
        </div>
      </div>
    </div>
  );
};
