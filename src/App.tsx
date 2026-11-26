import React, { useState } from 'react';
import { BarChart3, Compass, HeartPulse, LayoutDashboard, Wrench } from 'lucide-react';
import { DeviceConnectSheet } from './components/DeviceConnectSheet';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallBanner';
import { CURRENT_APP_VERSION, UpdateNotifier } from './components/UpdateNotifier';
import { DashboardProvider, useDashboard } from './context/DashboardContext';
import { DiagnosisScreen } from './screens/DiagnosisScreen';
import { GarageAccountScreen } from './screens/GarageAccountScreen';
import { HomeCockpitScreen } from './screens/HomeCockpitScreen';
import { MotovlogCamScreen } from './screens/MotovlogCamScreen';
import { NavigationScreen } from './screens/NavigationScreen';
import { RidingCockpitScreen } from './screens/RidingCockpitScreen';
import { StatsScreen } from './screens/StatsScreen';

const TABS = [
  { id: 0, label: 'Kokpit', Icon: LayoutDashboard },
  { id: 1, label: 'Diagnostik', Icon: HeartPulse },
  { id: 2, label: 'Navigasi', Icon: Compass },
  { id: 3, label: 'Statistik', Icon: BarChart3 },
  { id: 4, label: 'Garasi', Icon: Wrench },
];

const DashboardShell: React.FC = () => {
  const { colors } = useDashboard();
  const [tabIndex, setTabIndex] = useState(0);
  const [showDevices, setShowDevices] = useState(false);
  const [showRidingCockpit, setShowRidingCockpit] = useState(false);
  const [showMotovlogCam, setShowMotovlogCam] = useState(false);

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row transition-colors"
      style={{ backgroundColor: colors.background, color: colors.textPrimary }}
    >
      {/* Desktop Navigation Rail */}
      <aside
        className="hidden md:flex flex-col w-24 lg:w-56 shrink-0 border-r p-3 gap-2 sticky top-0 h-screen"
        style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
      >
        <div className="flex items-center gap-2.5 px-2 py-2.5 mb-2">
          <img
            src="/assets/ev_cockpit_icon.jpg"
            alt="Dashboard App"
            className="w-9 h-9 rounded-xl object-cover border"
            style={{ borderColor: colors.accent }}
          />
          <div className="hidden lg:block min-w-0">
            <div className="text-sm font-extrabold leading-tight truncate">Dashboard EV</div>
            <div className="text-[10px] font-semibold truncate" style={{ color: colors.accent }}>
              Dual-Pack • v{CURRENT_APP_VERSION}
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          {TABS.map((t) => {
            const active = tabIndex === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTabIndex(t.id)}
                className="w-full flex flex-col lg:flex-row items-center lg:gap-3 px-2 lg:px-3.5 py-2.5 rounded-2xl transition cursor-pointer"
                style={{
                  backgroundColor: active ? `${colors.accent}20` : 'transparent',
                  color: active ? colors.accent : colors.textMuted,
                }}
              >
                <t.Icon size={20} />
                <span className="text-[11px] lg:text-xs font-bold mt-1 lg:mt-0">{t.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="hidden lg:block pt-2">
          <PWAInstallButton />
        </div>
      </aside>

      {/* Main Content Stage */}
      <main className="flex-1 min-w-0 p-4 md:p-6 max-w-6xl w-full mx-auto">
        {tabIndex === 0 && (
          <HomeCockpitScreen
            onOpenDevices={() => setShowDevices(true)}
            onOpenRidingCockpit={() => setShowRidingCockpit(true)}
            onNavigateTab={setTabIndex}
          />
        )}
        {tabIndex === 1 && <DiagnosisScreen />}
        {tabIndex === 2 && <NavigationScreen />}
        {tabIndex === 3 && <StatsScreen />}
        {tabIndex === 4 && (
          <GarageAccountScreen onOpenMotovlogCam={() => setShowMotovlogCam(true)} />
        )}
      </main>

      {/* Mobile Floating Bottom Navigation Pill */}
      <nav className="md:hidden fixed bottom-3 left-3 right-3 z-40">
        <div
          className="h-16 rounded-3xl border px-2 flex items-center justify-around shadow-2xl backdrop-blur-md"
          style={{
            backgroundColor: `${colors.surfaceCard}F2`,
            borderColor: colors.borderSubtle,
          }}
        >
          {TABS.map((t) => {
            const active = tabIndex === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTabIndex(t.id)}
                className="flex flex-col items-center justify-center px-3 py-1.5 rounded-2xl transition cursor-pointer"
                style={{
                  backgroundColor: active ? `${colors.accent}22` : 'transparent',
                  color: active ? colors.accent : colors.textMuted,
                }}
              >
                <t.Icon size={19} />
                <span className="text-[10px] font-bold mt-0.5">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals & Fullscreen Routes */}
      <UpdateNotifier />
      <OfflineIndicator />
      <DeviceConnectSheet open={showDevices} onClose={() => setShowDevices(false)} />
      {showRidingCockpit && <RidingCockpitScreen onClose={() => setShowRidingCockpit(false)} />}
      {showMotovlogCam && <MotovlogCamScreen onClose={() => setShowMotovlogCam(false)} />}
    </div>
  );
};

export default function App() {
  return (
    <DashboardProvider>
      <DashboardShell />
    </DashboardProvider>
  );
}
