import React, { useEffect } from 'react';
import { Bluetooth, CheckCircle2, Cpu, RefreshCw, Unplug, X, Zap } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { BMS_PROTOCOL_SPECS, CONTROLLER_PROTOCOL_SPECS } from '../engine/protocolParsers';
import { BmsProtocolId, ControllerProtocolId } from '../types/dashboard';

interface DeviceConnectSheetProps {
  open: boolean;
  onClose: () => void;
}

export const DeviceConnectSheet: React.FC<DeviceConnectSheetProps> = ({ open, onClose }) => {
  const {
    colors,
    settings,
    updateSettings,
    motorConnState,
    motorConnName,
    jkConnState,
    jkConnName,
    esp1ConnState,
    esp1ConnName,
    esp2ConnState,
    esp2ConnName,
    devSimActive,
    toggleDevSim,
    discoveredDevices,
    isScanningBle,
    scanDevices,
    connectDevice,
    disconnectDevice,
  } = useDashboard();

  useEffect(() => {
    if (open && discoveredDevices.length === 0) {
      scanDevices();
    }
  }, [open, discoveredDevices.length, scanDevices]);

  if (!open) return null;

  const ctrlSpec = CONTROLLER_PROTOCOL_SPECS[settings.controllerProtocol];
  const bmsSpec = BMS_PROTOCOL_SPECS[settings.bmsProtocol];

  const activeSlots = [
    {
      label:
        settings.controllerProtocol === 'fardriver'
          ? 'Kontroler Fardriver (ORI)'
          : 'Motor MID (ORI AT+)',
      type: 'motor' as const,
      state: motorConnState,
      name: motorConnName,
    },
    {
      label: `Smart BMS (${bmsSpec.name})`,
      type: 'jikong' as const,
      state: jkConnState,
      name: jkConnName,
    },
    {
      label: 'ESP32 #1 (Kontak/LED)',
      type: 'esp1' as const,
      state: esp1ConnState,
      name: esp1ConnName,
    },
    {
      label: 'ESP32 #2 (Pack 2 CAN)',
      type: 'esp2' as const,
      state: esp2ConnState,
      name: esp2ConnName,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border p-5 max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: colors.surfaceCard,
          borderColor: colors.borderSubtle,
          color: colors.textPrimary,
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Bluetooth size={20} style={{ color: colors.accent }} />
            <h2 className="text-lg font-bold">Koneksi Perangkat EV, Fardriver & BMS</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:opacity-80 cursor-pointer"
            style={{ backgroundColor: colors.surfaceElevated }}
          >
            <X size={18} />
          </button>
        </div>

        {/* DEV-SIM Quick Toggle */}
        <div
          className="rounded-2xl p-3.5 mb-4 border flex items-center justify-between gap-3"
          style={{
            backgroundColor: devSimActive ? `${colors.warning}1A` : colors.surfaceElevated,
            borderColor: devSimActive ? colors.warning : colors.borderSubtle,
          }}
        >
          <div>
            <div className="text-sm font-bold flex items-center gap-1.5">
              <Zap size={15} style={{ color: colors.warning }} />
              Simulasi Telemetri Dev (DEV-SIM)
            </div>
            <p className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
              Simulasikan {ctrlSpec.name} + {bmsSpec.name} + ESP32 #1/#2 secara terpisah.
            </p>
          </div>
          <button
            onClick={() => toggleDevSim(!devSimActive)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer"
            style={{
              backgroundColor: devSimActive ? colors.warning : colors.accent,
              color: '#041418',
            }}
          >
            {devSimActive ? 'Matikan' : 'Aktifkan'}
          </button>
        </div>

        {/* Controller Protocol Selector */}
        <div
          className="rounded-2xl p-3.5 mb-3 border"
          style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}
        >
          <div className="text-xs font-bold mb-2">Protokol Kontroler / Baterai ORI</div>
          <div className="grid grid-cols-2 gap-2">
            {(['motor_mid', 'fardriver'] as ControllerProtocolId[]).map((id) => {
              const active = settings.controllerProtocol === id;
              return (
                <button
                  key={id}
                  onClick={() => updateSettings({ ...settings, controllerProtocol: id })}
                  className="py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer"
                  style={{
                    backgroundColor: active ? `${colors.accent}22` : colors.surfaceCard,
                    borderColor: active ? colors.accent : colors.borderSubtle,
                    color: active ? colors.accent : colors.textMuted,
                  }}
                >
                  {id === 'motor_mid' ? 'Motor MID (AT+)' : 'Fardriver (BLE/UART)'}
                </button>
              );
            })}
          </div>
          <div className="text-[10px] font-mono mt-2 truncate" style={{ color: colors.textMuted }}>
            {ctrlSpec.baudOrRate} • {ctrlSpec.headerHint}
          </div>
        </div>

        {/* Smart BMS Protocol Selector */}
        <div
          className="rounded-2xl p-3.5 mb-3 border"
          style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}
        >
          <div className="text-xs font-bold mb-2">Protokol Smart BMS Eksternal (Terpisah dari ORI)</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['jk', 'ant', 'daly', 'jbd'] as BmsProtocolId[]).map((id) => {
              const active = settings.bmsProtocol === id;
              return (
                <button
                  key={id}
                  onClick={() => updateSettings({ ...settings, bmsProtocol: id })}
                  className="py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer"
                  style={{
                    backgroundColor: active ? `${colors.accentSecondary}22` : colors.surfaceCard,
                    borderColor: active ? colors.accentSecondary : colors.borderSubtle,
                    color: active ? colors.accentSecondary : colors.textMuted,
                  }}
                >
                  {id === 'jk'
                    ? 'JK-BMS'
                    : id === 'ant'
                      ? 'ANT BMS'
                      : id === 'daly'
                        ? 'DALY'
                        : 'JBD'}
                </button>
              );
            })}
          </div>
          <div className="text-[10px] font-mono mt-2 truncate" style={{ color: colors.textMuted }}>
            {bmsSpec.baudOrRate} • {bmsSpec.headerHint}
          </div>
        </div>

        {/* Battery Priority Selector */}
        <div
          className="rounded-2xl p-3.5 mb-4 border"
          style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}
        >
          <div className="text-xs font-semibold mb-1.5" style={{ color: colors.textMuted }}>
            Prioritas Sumber Utama Pack 1 (Strict Isolation — Tidak Dicampur)
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['motor', 'jikong'] as const).map((prio) => {
              const active = settings.batteryPriorityId === prio;
              return (
                <button
                  key={prio}
                  onClick={() => updateSettings({ ...settings, batteryPriorityId: prio })}
                  className="py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer"
                  style={{
                    backgroundColor: active ? `${colors.accent}22` : colors.surfaceCard,
                    borderColor: active ? colors.accent : colors.borderSubtle,
                    color: active ? colors.accent : colors.textMuted,
                  }}
                >
                  {prio === 'motor'
                    ? 'Baterai ORI / MID'
                    : `Smart BMS (${settings.bmsProtocol.toUpperCase()})`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Connected Slots */}
        <div className="space-y-2 mb-4">
          {activeSlots.map((slot) => {
            const connected = slot.state === 'CONNECTED';
            return (
              <div
                key={slot.type}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border"
                style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}
              >
                <div>
                  <div className="text-xs font-bold">{slot.label}</div>
                  <div className="text-[11px]" style={{ color: connected ? colors.accent : colors.textMuted }}>
                    {connected ? `Terhubung: ${slot.name}` : 'Belum terhubung'}
                  </div>
                </div>
                {connected ? (
                  <button
                    onClick={() => disconnectDevice(slot.type)}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer"
                    style={{ backgroundColor: `${colors.danger}22`, color: colors.danger }}
                  >
                    <Unplug size={13} /> Putus
                  </button>
                ) : (
                  <span className="text-[11px] font-medium" style={{ color: colors.textMuted }}>
                    Standby
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Scan Results */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.textMuted }}>
            Perangkat Terdeteksi (WebBLE / Paired)
          </span>
          <button
            onClick={scanDevices}
            disabled={isScanningBle}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer"
            style={{ backgroundColor: `${colors.accentSecondary}22`, color: colors.accentSecondary }}
          >
            <RefreshCw size={13} className={isScanningBle ? 'animate-spin' : ''} />
            {isScanningBle ? 'Memindai…' : 'Pindai Ulang'}
          </button>
        </div>

        <div className="space-y-2">
          {discoveredDevices.map((dev) => (
            <div
              key={dev.address}
              className="flex items-center justify-between p-3 rounded-xl border"
              style={{ backgroundColor: colors.background, borderColor: colors.borderSubtle }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Cpu size={16} style={{ color: colors.accentSecondary }} />
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{dev.name}</div>
                  <div className="text-[11px] tnum" style={{ color: colors.textMuted }}>
                    {dev.address} • {dev.isBle ? 'BLE' : 'Classic SPP'} • {dev.rssi} dBm
                  </div>
                </div>
              </div>
              <button
                onClick={() => connectDevice(dev)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                style={{ backgroundColor: colors.accent, color: '#041418' }}
              >
                <CheckCircle2 size={13} /> Hubungkan
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
