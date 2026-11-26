import React, { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  AlertCircle,
  Bluetooth,
  CheckCircle2,
  Cpu,
  RefreshCw,
  Unplug,
  Usb,
  X,
  Zap,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { BMS_PROTOCOL_SPECS, CONTROLLER_PROTOCOL_SPECS } from '../engine/protocolParsers';
import { BmsProtocolId, ControllerProtocolId, DiscoveredDevice } from '../types/dashboard';

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
    scanError,
    scanDevices,
    connectWebSerialMotor,
    assignDiscoveredDeviceRole,
    connectDevice,
    disconnectDevice,
  } = useDashboard();

  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    // Only auto-scan on Native Android (WebBLE requires a direct button click gesture)
    if (open && isNative && discoveredDevices.length === 0 && !isScanningBle) {
      void scanDevices();
    }
  }, [open, isNative, discoveredDevices.length, isScanningBle, scanDevices]);

  if (!open) return null;

  const ctrlSpec = CONTROLLER_PROTOCOL_SPECS[settings.controllerProtocol];
  const bmsSpec = BMS_PROTOCOL_SPECS[settings.bmsProtocol];

  const activeSlots = [
    {
      label:
        settings.controllerProtocol === 'fardriver'
          ? 'Kontroler Fardriver (ORI)'
          : 'Motor MID (Prioritas SPP / AT+)',
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

  const getRoleKey = (dev: DiscoveredDevice) => {
    if (dev.deviceType === 'motor') {
      return dev.controllerProtocol === 'fardriver' ? 'fardriver' : 'motor_mid';
    }
    if (dev.deviceType === 'jikong') {
      return `bms_${dev.bmsProtocol ?? settings.bmsProtocol}`;
    }
    return dev.deviceType;
  };

  const handleRoleChange = (address: string, val: string) => {
    if (val === 'motor_mid') {
      assignDiscoveredDeviceRole(address, {
        deviceType: 'motor',
        controllerProtocol: 'motor_mid',
        bmsProtocol: undefined,
      });
    } else if (val === 'fardriver') {
      assignDiscoveredDeviceRole(address, {
        deviceType: 'motor',
        controllerProtocol: 'fardriver',
        bmsProtocol: undefined,
      });
    } else if (val.startsWith('bms_')) {
      const bms = val.replace('bms_', '') as BmsProtocolId;
      assignDiscoveredDeviceRole(address, {
        deviceType: 'jikong',
        controllerProtocol: undefined,
        bmsProtocol: bms,
      });
    } else if (val === 'esp1' || val === 'esp2') {
      assignDiscoveredDeviceRole(address, {
        deviceType: val,
        controllerProtocol: undefined,
        bmsProtocol: undefined,
      });
    }
  };

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
              Hanya untuk uji UI tanpa hardware fisik ({ctrlSpec.name} + {bmsSpec.name}).
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
                  {id === 'motor_mid' ? 'Motor MID (SPP AT+)' : 'Fardriver (BLE/UART)'}
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
            const connecting = slot.state === 'CONNECTING';
            return (
              <div
                key={slot.type}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border"
                style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}
              >
                <div>
                  <div className="text-xs font-bold">{slot.label}</div>
                  <div
                    className="text-[11px]"
                    style={{
                      color: connected
                        ? colors.accent
                        : connecting
                          ? colors.warning
                          : colors.textMuted,
                    }}
                  >
                    {connected
                      ? `Terhubung: ${slot.name}`
                      : connecting
                        ? 'Menghubungkan…'
                        : 'Belum terhubung'}
                  </div>
                </div>
                {connected ? (
                  <button
                    onClick={() => void disconnectDevice(slot.type)}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer"
                    style={{ backgroundColor: `${colors.danger}22`, color: colors.danger }}
                  >
                    <Unplug size={13} /> Putus
                  </button>
                ) : (
                  <span className="text-[11px] font-medium" style={{ color: colors.textMuted }}>
                    {connecting ? 'Proses' : 'Standby'}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Real Hardware Scan Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.textMuted }}>
            {isNative ? 'Perangkat Nyata (SPP Paired & BLE)' : 'Perangkat Nyata (WebBLE & Serial)'}
          </span>
          <div className="flex items-center gap-1.5">
            {!isNative && (
              <button
                onClick={() => void connectWebSerialMotor()}
                className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl border cursor-pointer"
                style={{
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.borderSubtle,
                  color: colors.accent,
                }}
              >
                <Usb size={13} /> Port SPP
              </button>
            )}
            <button
              onClick={() => void scanDevices()}
              disabled={isScanningBle}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer"
              style={{ backgroundColor: `${colors.accentSecondary}22`, color: colors.accentSecondary }}
            >
              <RefreshCw size={13} className={isScanningBle ? 'animate-spin' : ''} />
              {isScanningBle ? 'Memindai…' : isNative ? 'Pindai SPP + BLE' : 'Pilih WebBLE'}
            </button>
          </div>
        </div>

        {scanError && (
          <div
            className="rounded-xl p-3 mb-3 border flex items-start gap-2 text-xs"
            style={{
              backgroundColor: `${colors.warning}15`,
              borderColor: `${colors.warning}66`,
              color: colors.warning,
            }}
          >
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{scanError}</span>
          </div>
        )}

        <div className="space-y-2">
          {discoveredDevices.length === 0 ? (
            <div
              className="rounded-xl p-4 border text-center text-xs space-y-1"
              style={{
                backgroundColor: colors.background,
                borderColor: colors.borderSubtle,
                color: colors.textMuted,
              }}
            >
              <div className="font-bold" style={{ color: colors.textPrimary }}>
                {isScanningBle ? 'Memindai Bluetooth SPP & BLE di sekitar…' : 'Belum ada perangkat Bluetooth aktif.'}
              </div>
              <p>
                {isNative
                  ? 'Pair modul MID (HC-05/SPP) di Pengaturan Bluetooth HP atau nyalakan BMS/Fardriver BLE lalu tekan "Pindai SPP + BLE".'
                  : 'Klik "Pilih WebBLE" untuk BMS/Fardriver BLE di Chrome, atau gunakan APK Android untuk Classic Bluetooth SPP MID.'}
              </p>
            </div>
          ) : (
            discoveredDevices.map((dev) => (
              <div
                key={dev.address}
                className="p-3 rounded-xl border space-y-2"
                style={{ backgroundColor: colors.background, borderColor: colors.borderSubtle }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Cpu size={16} style={{ color: dev.isBle ? colors.accentSecondary : colors.accent }} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate flex items-center gap-1.5">
                        <span className="truncate">{dev.name}</span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0"
                          style={{
                            backgroundColor: dev.isBle ? `${colors.accentSecondary}22` : `${colors.accent}22`,
                            color: dev.isBle ? colors.accentSecondary : colors.accent,
                          }}
                        >
                          {dev.isBle ? 'BLE' : 'SPP'}
                        </span>
                      </div>
                      <div className="text-[11px] tnum" style={{ color: colors.textMuted }}>
                        {dev.address} {dev.isPaired ? '• Paired' : ''} • {dev.rssi} dBm
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => void connectDevice(dev)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                    style={{ backgroundColor: colors.accent, color: '#041418' }}
                  >
                    <CheckCircle2 size={13} /> Hubungkan
                  </button>
                </div>

                {/* Role selector so generic modules like HC-05 / JDY can be mapped explicitly */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t" style={{ borderColor: colors.borderSubtle }}>
                  <span className="text-[10px]" style={{ color: colors.textMuted }}>
                    Peran Modul:
                  </span>
                  <select
                    value={getRoleKey(dev)}
                    onChange={(e) => handleRoleChange(dev.address, e.target.value)}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold border outline-none"
                    style={{
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.borderSubtle,
                      color: colors.textPrimary,
                    }}
                  >
                    <option value="motor_mid">Motor MID (SPP AT+)</option>
                    <option value="fardriver">Fardriver Controller</option>
                    <option value="bms_jk">Smart BMS: JK-BMS</option>
                    <option value="bms_ant">Smart BMS: ANT BMS</option>
                    <option value="bms_daly">Smart BMS: DALY</option>
                    <option value="bms_jbd">Smart BMS: JBD / Xiaoxiang</option>
                    <option value="esp1">ESP32 #1 (Kontak/LED)</option>
                    <option value="esp2">ESP32 #2 (Pack 2 CAN)</option>
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
