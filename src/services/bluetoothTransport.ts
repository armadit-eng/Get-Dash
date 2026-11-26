import { Capacitor, PluginListenerHandle, registerPlugin } from '@capacitor/core';
import { BleClient, BleService, numberToUUID } from '@capacitor-community/bluetooth-le';
import {
  buildAntQueryCommand,
  buildDalyCommand,
  buildJkCommandFrame,
  JBD_CMD_BASIC,
  JBD_CMD_CELLS,
} from '../engine/protocolParsers';
import { BmsProtocolId, ControllerProtocolId, DiscoveredDevice } from '../types/dashboard';

export interface SppPairedDevice {
  name: string;
  address: string;
  type: number; // 1=Classic, 2=BLE, 3=Dual
  rssi?: number;
  isPaired: boolean;
}

interface BluetoothSppPlugin {
  isAvailable(): Promise<{ supported: boolean; enabled: boolean }>;
  getPairedDevices(): Promise<{ devices: SppPairedDevice[] }>;
  scanClassic(): Promise<{ devices: SppPairedDevice[] }>;
  connect(opts: { address: string }): Promise<{ connected: boolean; address: string; name: string }>;
  write(opts: { text?: string; hex?: string }): Promise<void>;
  disconnect(): Promise<void>;
  addListener(
    event: 'sppLine',
    cb: (data: { address: string; line: string }) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    event: 'sppBytes',
    cb: (data: { address: string; hex: string }) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    event: 'sppDeviceFound',
    cb: (data: SppPairedDevice) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    event: 'sppDisconnected',
    cb: (data: { address: string }) => void
  ): Promise<PluginListenerHandle>;
}

const BluetoothSpp = registerPlugin<BluetoothSppPlugin>('BluetoothSpp');

const OPTIONAL_BLE_SERVICES = [
  numberToUUID(0xffe0), // JK-BMS, ANT, HM-10, Fardriver, AT+ BLE
  numberToUUID(0xfff0), // DALY Smart BMS
  numberToUUID(0xff00), // JBD / Xiaoxiang BMS
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (ESP32 / Custom)
  '4fafc201-1fb5-459e-8fcc-c5c9c331914b', // Custom ESP32 Bridge UUID
];

export interface ActiveSlotConnection {
  deviceType: DiscoveredDevice['deviceType'];
  transport: 'spp' | 'ble' | 'webserial';
  address: string;
  name: string;
  serviceUuid?: string;
  notifyCharUuid?: string;
  writeCharUuid?: string;
  canWriteWithoutResponse?: boolean;
  pollTimer?: number;
  sppListeners?: PluginListenerHandle[];
  serialPort?: unknown;
  serialWriter?: WritableStreamDefaultWriter<Uint8Array>;
  serialReaderAbort?: AbortController;
}

export interface TransportCallbacks {
  onTextLine: (deviceType: DiscoveredDevice['deviceType'], line: string) => void;
  onBinaryFrame: (deviceType: DiscoveredDevice['deviceType'], bytes: Uint8Array) => void;
  onDisconnected: (deviceType: DiscoveredDevice['deviceType'], reason: string) => void;
  onLog: (source: string, message: string, isError?: boolean) => void;
}

class FrameStreamAssembler {
  private buf: number[] = [];
  private textBuf = '';

  pushChunk(
    chunk: Uint8Array,
    mode: 'text' | 'fardriver' | 'jk' | 'ant' | 'daly' | 'jbd',
    onLine: (line: string) => void,
    onFrame: (frame: Uint8Array) => void
  ) {
    if (mode === 'text') {
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(chunk);
      this.textBuf += decoded;
      const lines = this.textBuf.split(/\r?\n|\r/);
      this.textBuf = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.trim();
        if (line) onLine(line);
      }
      if (this.textBuf.length > 512) {
        onLine(this.textBuf.trim());
        this.textBuf = '';
      }
      return;
    }

    for (let i = 0; i < chunk.length; i++) {
      this.buf.push(chunk[i]);
    }
    if (this.buf.length > 2048) {
      this.buf = this.buf.slice(-1024);
    }

    if (mode === 'fardriver') {
      while (this.buf.length >= 16) {
        const idx = this.buf.indexOf(0xaa);
        if (idx < 0) {
          this.buf = [];
          break;
        }
        if (idx > 0) this.buf = this.buf.slice(idx);
        if (this.buf.length < 16) break;
        const frame = new Uint8Array(this.buf.slice(0, 16));
        this.buf = this.buf.slice(16);
        onFrame(frame);
      }
      return;
    }

    if (mode === 'jk') {
      while (this.buf.length >= 300) {
        const idx = findSubseq(this.buf, [0x55, 0xaa, 0xeb, 0x90]);
        if (idx < 0) {
          if (this.buf.length > 32) this.buf = this.buf.slice(-3);
          break;
        }
        if (idx > 0) this.buf = this.buf.slice(idx);
        if (this.buf.length < 300) break;
        const frame = new Uint8Array(this.buf.slice(0, 300));
        this.buf = this.buf.slice(300);
        onFrame(frame);
      }
      return;
    }

    if (mode === 'ant') {
      while (this.buf.length >= 140) {
        const idx = findSubseq(this.buf, [0xaa, 0x55, 0xaa, 0xff]);
        if (idx < 0) {
          if (this.buf.length > 32) this.buf = this.buf.slice(-3);
          break;
        }
        if (idx > 0) this.buf = this.buf.slice(idx);
        if (this.buf.length < 140) break;
        const frame = new Uint8Array(this.buf.slice(0, 140));
        this.buf = this.buf.slice(140);
        onFrame(frame);
      }
      return;
    }

    if (mode === 'daly') {
      while (this.buf.length >= 13) {
        const idx = this.buf.indexOf(0xa5);
        if (idx < 0) {
          this.buf = [];
          break;
        }
        if (idx > 0) this.buf = this.buf.slice(idx);
        if (this.buf.length < 13) break;
        const frame = new Uint8Array(this.buf.slice(0, 13));
        this.buf = this.buf.slice(13);
        onFrame(frame);
      }
      return;
    }

    if (mode === 'jbd') {
      while (this.buf.length >= 7) {
        const idx = this.buf.indexOf(0xdd);
        if (idx < 0) {
          this.buf = [];
          break;
        }
        if (idx > 0) this.buf = this.buf.slice(idx);
        if (this.buf.length < 7) break;
        const payloadLen = this.buf[3];
        const totalLen = 4 + payloadLen + 3;
        if (totalLen > 256) {
          this.buf.shift();
          continue;
        }
        if (this.buf.length < totalLen) break;
        if (this.buf[totalLen - 1] === 0x77) {
          const frame = new Uint8Array(this.buf.slice(0, totalLen));
          this.buf = this.buf.slice(totalLen);
          onFrame(frame);
        } else {
          this.buf.shift();
        }
      }
    }
  }
}

function findSubseq(haystack: number[], needle: number[]): number {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

export function classifyDiscoveredDevice(
  name: string,
  isBle: boolean,
  preferredController: ControllerProtocolId,
  preferredBms: BmsProtocolId,
  uuids?: string[]
): {
  deviceType: DiscoveredDevice['deviceType'];
  controllerProtocol?: ControllerProtocolId;
  bmsProtocol?: BmsProtocolId;
} {
  const upper = (name || '').toUpperCase();
  const uuidStr = (uuids || []).join(',').toLowerCase();

  if (upper.includes('ESP32') && (upper.includes('BAT2') || upper.includes('2') || upper.includes('CAN'))) {
    return { deviceType: 'esp2' };
  }
  if (upper.includes('ESP') || upper.includes('BRIDGE') || upper.includes('MATRIX')) {
    return { deviceType: 'esp1' };
  }
  if (upper.includes('FARDRIVER') || upper.includes('NANJING') || upper.includes('ND72') || upper.includes('ND84')) {
    return { deviceType: 'motor', controllerProtocol: 'fardriver' };
  }
  if (upper.includes('ANT')) {
    return { deviceType: 'jikong', bmsProtocol: 'ant' };
  }
  if (upper.includes('DALY') || upper.includes('DL-') || uuidStr.includes('fff0')) {
    return { deviceType: 'jikong', bmsProtocol: 'daly' };
  }
  if (upper.includes('JBD') || upper.includes('XIAOXIANG') || uuidStr.includes('ff00')) {
    return { deviceType: 'jikong', bmsProtocol: 'jbd' };
  }
  if (upper.includes('JK') || upper.includes('JIKONG') || upper.includes('BD6') || upper.includes('BD4')) {
    return { deviceType: 'jikong', bmsProtocol: 'jk' };
  }
  if (
    !isBle ||
    upper.includes('MID') ||
    upper.includes('GESITS') ||
    upper.includes('HC-05') ||
    upper.includes('HC-06') ||
    upper.includes('SPP')
  ) {
    return { deviceType: 'motor', controllerProtocol: 'motor_mid' };
  }

  return {
    deviceType: preferredController === 'fardriver' ? 'motor' : 'jikong',
    controllerProtocol: preferredController === 'fardriver' ? 'fardriver' : undefined,
    bmsProtocol: preferredController === 'fardriver' ? undefined : preferredBms,
  };
}

class BluetoothTransportManager {
  private activeSlots = new Map<DiscoveredDevice['deviceType'], ActiveSlotConnection>();
  private bleInitialized = false;

  private async ensureBleInit(): Promise<void> {
    if (this.bleInitialized) return;
    await BleClient.initialize({ androidNeverForLocation: false });
    this.bleInitialized = true;
  }

  async scanRealDevices(
    preferredController: ControllerProtocolId,
    preferredBms: BmsProtocolId,
    onPartialUpdate: (devices: DiscoveredDevice[]) => void,
    onLog: (source: string, message: string, isError?: boolean) => void
  ): Promise<{ devices: DiscoveredDevice[]; error?: string }> {
    const foundMap = new Map<string, DiscoveredDevice>();
    const emitUpdate = () => {
      const arr = Array.from(foundMap.values()).sort((a, b) => {
        // Prioritize paired Classic SPP for MID at the top
        if (a.isBle !== b.isBle) return a.isBle ? 1 : -1;
        if (a.isPaired !== b.isPaired) return a.isPaired ? -1 : 1;
        return b.rssi - a.rssi;
      });
      onPartialUpdate(arr);
    };

    if (Capacitor.isNativePlatform()) {
      // 1. Prioritize Classic Bluetooth SPP (Paired + Discovery) for Motor MID
      try {
        const pairedRes = await BluetoothSpp.getPairedDevices();
        for (const d of pairedRes.devices || []) {
          // type 1 = Classic, type 3 = Dual-mode (both support Classic SPP), type 2 = BLE-only
          const supportsClassicSpp = d.type !== 2;
          const isBleOnly = d.type === 2;
          const cls = classifyDiscoveredDevice(
            d.name,
            isBleOnly,
            preferredController,
            preferredBms
          );
          foundMap.set(d.address, {
            name: d.name || d.address,
            address: d.address,
            isBle: isBleOnly,
            rssi: d.rssi ?? -55,
            isPaired: true,
            deviceType: supportsClassicSpp && cls.deviceType === 'motor' ? 'motor' : cls.deviceType,
            controllerProtocol: supportsClassicSpp && cls.deviceType === 'motor' ? 'motor_mid' : cls.controllerProtocol,
            bmsProtocol: cls.bmsProtocol,
          });
        }
        emitUpdate();
        onLog('SPP', `Ditemukan ${(pairedRes.devices || []).length} perangkat Bluetooth paired.`);
      } catch (err) {
        onLog('SPP', `Gagal membaca perangkat paired SPP: ${String(err)}`, true);
      }

      // 2. Classic Discovery (unpaired SPP modules nearby) + BLE Scan
      let classicListener: PluginListenerHandle | undefined;
      try {
        classicListener = await BluetoothSpp.addListener('sppDeviceFound', (d) => {
          const isBleOnly = d.type === 2;
          const cls = classifyDiscoveredDevice(d.name, isBleOnly, preferredController, preferredBms);
          if (!foundMap.has(d.address)) {
            foundMap.set(d.address, {
              name: d.name || d.address,
              address: d.address,
              isBle: isBleOnly,
              rssi: d.rssi ?? -70,
              isPaired: d.isPaired,
              ...cls,
            });
            emitUpdate();
          }
        });
      } catch {
        // Ignore listener errors
      }

      // Run BLE scan in parallel with Classic discovery
      const sppScanPromise = BluetoothSpp.scanClassic().catch((err) => {
        onLog('SPP', `Discovery Classic selesai/skip: ${String(err)}`, false);
        return { devices: [] };
      });

      const bleScanPromise = (async () => {
        try {
          await this.ensureBleInit();
          await BleClient.requestLEScan(
            { allowDuplicates: false },
            (res) => {
              const id = res.device.deviceId;
              const name = res.device.name || res.localName || '';
              if (!name && foundMap.has(id)) return;
              const existing = foundMap.get(id);
              // Keep Classic SPP priority if already listed as Classic paired device
              if (existing && !existing.isBle) return;
              const cls = classifyDiscoveredDevice(
                name || id,
                true,
                preferredController,
                preferredBms,
                res.uuids
              );
              foundMap.set(id, {
                name: name || `BLE ${id}`,
                address: id,
                isBle: true,
                rssi: res.rssi ?? -72,
                isPaired: existing?.isPaired ?? false,
                ...cls,
              });
              emitUpdate();
            }
          );
          await new Promise((r) => setTimeout(r, 5500));
          await BleClient.stopLEScan();
        } catch (err) {
          onLog('BLE', `Scan BLE gagal: ${String(err)}`, true);
        }
      })();

      await Promise.all([sppScanPromise, bleScanPromise]);
      await classicListener?.remove();
      emitUpdate();

      const finalArr = Array.from(foundMap.values()).sort((a, b) => {
        if (a.isBle !== b.isBle) return a.isBle ? 1 : -1;
        if (a.isPaired !== b.isPaired) return a.isPaired ? -1 : 1;
        return b.rssi - a.rssi;
      });
      return { devices: finalArr };
    }

    // Web / Chrome PWA: Real Web Bluetooth picker via BleClient.requestDevice
    try {
      await this.ensureBleInit();
      const bleDev = await BleClient.requestDevice({
        optionalServices: OPTIONAL_BLE_SERVICES,
      });
      const cls = classifyDiscoveredDevice(
        bleDev.name || bleDev.deviceId,
        true,
        preferredController,
        preferredBms,
        bleDev.uuids
      );
      const item: DiscoveredDevice = {
        name: bleDev.name || 'Perangkat BLE',
        address: bleDev.deviceId,
        isBle: true,
        rssi: -50,
        isPaired: true,
        ...cls,
      };
      foundMap.set(item.address, item);
      emitUpdate();
      onLog('BLE', `Perangkat WebBLE dipilih: ${item.name} (${item.address})`);
      return { devices: [item] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onLog('BLE', `Web Bluetooth scan dibatalkan / tidak tersedia: ${msg}`, true);
      return {
        devices: [],
        error:
          'Web Bluetooth dibatalkan atau browser tidak mendukung BLE/SPP. Di Chrome Android/Desktop pilih perangkat dari dialog; untuk Classic SPP gunakan APK Android atau Web Serial.',
      };
    }
  }

  async connectWebSerialSpp(
    callbacks: TransportCallbacks
  ): Promise<DiscoveredDevice | null> {
    const serialNav = (
      navigator as unknown as {
        serial?: {
          requestPort: () => Promise<{
            open: (opts: { baudRate: number }) => Promise<void>;
            readable?: ReadableStream<Uint8Array>;
            writable?: WritableStream<Uint8Array>;
            close: () => Promise<void>;
            getInfo: () => { usbVendorId?: number; usbProductId?: number };
          }>;
        };
      }
    ).serial;

    if (!serialNav) {
      callbacks.onLog('SPP', 'Browser ini tidak mendukung Web Serial API.', true);
      return null;
    }

    try {
      const port = await serialNav.requestPort();
      await port.open({ baudRate: 115200 });
      await this.disconnectSlot('motor');

      const info = port.getInfo();
      const addr = `SERIAL-${info.usbVendorId ?? 'SPP'}`;
      const abort = new AbortController();
      const writer = port.writable?.getWriter();

      const slot: ActiveSlotConnection = {
        deviceType: 'motor',
        transport: 'webserial',
        address: addr,
        name: 'MID SPP Serial Port',
        serialPort: port,
        serialWriter: writer,
        serialReaderAbort: abort,
      };
      this.activeSlots.set('motor', slot);

      const assembler = new FrameStreamAssembler();
      if (port.readable) {
        void (async () => {
          const reader = port.readable!.getReader();
          try {
            while (!abort.signal.aborted) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value) {
                assembler.pushChunk(
                  value,
                  'text',
                  (line) => callbacks.onTextLine('motor', line),
                  () => {}
                );
              }
            }
          } catch (err) {
            callbacks.onLog('SPP', `Serial read berhenti: ${String(err)}`, true);
          } finally {
            reader.releaseLock();
            callbacks.onDisconnected('motor', 'Serial terputus');
          }
        })();
      }

      callbacks.onLog('SPP', 'Terhubung ke port Serial SPP MID (115200 bps).');
      return {
        name: 'MID SPP Serial Port',
        address: addr,
        isBle: false,
        rssi: -40,
        isPaired: true,
        deviceType: 'motor',
        controllerProtocol: 'motor_mid',
      };
    } catch (err) {
      callbacks.onLog('SPP', `Batal memilih port Serial: ${String(err)}`, true);
      return null;
    }
  }

  async connectDevice(
    device: DiscoveredDevice,
    opts: { controllerProtocol: ControllerProtocolId; bmsProtocol: BmsProtocolId },
    callbacks: TransportCallbacks
  ): Promise<boolean> {
    await this.disconnectSlot(device.deviceType);

    // Classic SPP Path (Native Android RFCOMM — Prioritized for Motor MID)
    if (!device.isBle) {
      if (!Capacitor.isNativePlatform()) {
        callbacks.onLog(
          'SPP',
          'Classic Bluetooth SPP memerlukan APK Android (native) atau tombol Serial SPP di Chrome Desktop.',
          true
        );
        return false;
      }

      try {
        const res = await BluetoothSpp.connect({ address: device.address });
        const assembler = new FrameStreamAssembler();

        const l1 = await BluetoothSpp.addListener('sppLine', (ev) => {
          if (ev.address === device.address && ev.line) {
            callbacks.onTextLine(device.deviceType, ev.line);
          }
        });
        const l2 = await BluetoothSpp.addListener('sppBytes', (ev) => {
          if (ev.address === device.address && ev.hex && opts.controllerProtocol === 'fardriver') {
            const bytes = hexToBytes(ev.hex);
            assembler.pushChunk(
              bytes,
              'fardriver',
              () => {},
              (frame) => callbacks.onBinaryFrame(device.deviceType, frame)
            );
          }
        });
        const l3 = await BluetoothSpp.addListener('sppDisconnected', (ev) => {
          if (ev.address === device.address) {
            void this.cleanupSlot(device.deviceType);
            callbacks.onDisconnected(device.deviceType, 'Koneksi SPP terputus');
          }
        });

        this.activeSlots.set(device.deviceType, {
          deviceType: device.deviceType,
          transport: 'spp',
          address: device.address,
          name: res.name || device.name,
          sppListeners: [l1, l2, l3],
        });

        callbacks.onLog('SPP', `RFCOMM SPP tersambung ke ${device.name} (${device.address})`);
        return true;
      } catch (err) {
        callbacks.onLog('SPP', `Gagal koneksi SPP: ${String(err)}`, true);
        return false;
      }
    }

    // BLE Path (Android Native BLE + Web Bluetooth via BleClient)
    try {
      await this.ensureBleInit();
      await BleClient.connect(
        device.address,
        () => {
          void this.cleanupSlot(device.deviceType);
          callbacks.onDisconnected(device.deviceType, 'Koneksi BLE terputus');
        },
        { timeout: 12000 }
      );

      const services = await BleClient.getServices(device.address);
      const picked = pickBleCharacteristics(services);
      if (!picked) {
        callbacks.onLog(
          'BLE',
          `Tidak ditemukan characteristic Notify UART/BMS pada ${device.name}.`,
          true
        );
        await BleClient.disconnect(device.address);
        return false;
      }

      const mode = resolveAssemblerMode(device, opts.controllerProtocol, opts.bmsProtocol);
      const assembler = new FrameStreamAssembler();

      await BleClient.startNotifications(
        device.address,
        picked.serviceUuid,
        picked.notifyCharUuid,
        (dataView) => {
          const chunk = new Uint8Array(
            dataView.buffer,
            dataView.byteOffset,
            dataView.byteLength
          );
          assembler.pushChunk(
            chunk,
            mode,
            (line) => callbacks.onTextLine(device.deviceType, line),
            (frame) => callbacks.onBinaryFrame(device.deviceType, frame)
          );
        }
      );

      const slot: ActiveSlotConnection = {
        deviceType: device.deviceType,
        transport: 'ble',
        address: device.address,
        name: device.name,
        serviceUuid: picked.serviceUuid,
        notifyCharUuid: picked.notifyCharUuid,
        writeCharUuid: picked.writeCharUuid,
        canWriteWithoutResponse: picked.canWriteWithoutResponse,
      };

      // Active polling for Smart BMS protocols that require query commands
      if (device.deviceType === 'jikong' && picked.writeCharUuid) {
        let dalyIdx = 0;
        const dalyCmds = [0x90, 0x91, 0x92, 0x93, 0x94, 0x95];
        let jbdToggle = false;
        const bmsProto = device.bmsProtocol ?? opts.bmsProtocol;

        const sendPoll = async () => {
          let payload: Uint8Array | null = null;
          if (bmsProto === 'jk') payload = buildJkCommandFrame(0x02);
          else if (bmsProto === 'ant') payload = buildAntQueryCommand();
          else if (bmsProto === 'daly') {
            payload = buildDalyCommand(dalyCmds[dalyIdx % dalyCmds.length]);
            dalyIdx++;
          } else if (bmsProto === 'jbd') {
            payload = jbdToggle ? JBD_CMD_CELLS : JBD_CMD_BASIC;
            jbdToggle = !jbdToggle;
          }
          if (payload) {
            await this.writeBleBytes(slot, payload);
          }
        };

        void sendPoll();
        slot.pollTimer = window.setInterval(() => {
          void sendPoll();
        }, bmsProto === 'daly' ? 450 : 1200);
      }

      this.activeSlots.set(device.deviceType, slot);
      callbacks.onLog(
        'BLE',
        `GATT tersambung ke ${device.name} (SVC ${picked.serviceUuid.slice(4, 8).toUpperCase()})`
      );
      return true;
    } catch (err) {
      callbacks.onLog('BLE', `Gagal koneksi BLE ke ${device.name}: ${String(err)}`, true);
      return false;
    }
  }

  private async writeBleBytes(slot: ActiveSlotConnection, bytes: Uint8Array): Promise<void> {
    if (!slot.serviceUuid || !slot.writeCharUuid) return;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    try {
      if (slot.canWriteWithoutResponse) {
        await BleClient.writeWithoutResponse(slot.address, slot.serviceUuid, slot.writeCharUuid, dv);
      } else {
        await BleClient.write(slot.address, slot.serviceUuid, slot.writeCharUuid, dv);
      }
    } catch {
      // Fallback to alternative write mode
      try {
        if (slot.canWriteWithoutResponse) {
          await BleClient.write(slot.address, slot.serviceUuid, slot.writeCharUuid, dv);
        } else {
          await BleClient.writeWithoutResponse(slot.address, slot.serviceUuid, slot.writeCharUuid, dv);
        }
      } catch {
        // Ignore transient write failures
      }
    }
  }

  async sendTextCommand(
    deviceType: DiscoveredDevice['deviceType'],
    text: string
  ): Promise<boolean> {
    const slot = this.activeSlots.get(deviceType);
    if (!slot) return false;
    const payloadStr = text.endsWith('\n') ? text : `${text}\r\n`;
    if (slot.transport === 'spp') {
      try {
        await BluetoothSpp.write({ text: payloadStr });
        return true;
      } catch {
        return false;
      }
    }
    if (slot.transport === 'webserial' && slot.serialWriter) {
      try {
        await slot.serialWriter.write(new TextEncoder().encode(payloadStr));
        return true;
      } catch {
        return false;
      }
    }
    if (slot.transport === 'ble') {
      await this.writeBleBytes(slot, new TextEncoder().encode(payloadStr));
      return true;
    }
    return false;
  }

  async disconnectSlot(deviceType: DiscoveredDevice['deviceType']): Promise<void> {
    const slot = this.activeSlots.get(deviceType);
    await this.cleanupSlot(deviceType);
    if (!slot) return;
    if (slot.transport === 'spp') {
      try {
        await BluetoothSpp.disconnect();
      } catch {
        // Ignore
      }
    } else if (slot.transport === 'ble') {
      try {
        await BleClient.disconnect(slot.address);
      } catch {
        // Ignore
      }
    } else if (slot.transport === 'webserial') {
      try {
        slot.serialReaderAbort?.abort();
        await slot.serialWriter?.close();
        await (slot.serialPort as { close: () => Promise<void> } | undefined)?.close();
      } catch {
        // Ignore
      }
    }
  }

  private async cleanupSlot(deviceType: DiscoveredDevice['deviceType']): Promise<void> {
    const slot = this.activeSlots.get(deviceType);
    if (!slot) return;
    if (slot.pollTimer !== undefined) {
      window.clearInterval(slot.pollTimer);
    }
    if (slot.sppListeners) {
      for (const l of slot.sppListeners) {
        try {
          await l.remove();
        } catch {
          // Ignore
        }
      }
    }
    this.activeSlots.delete(deviceType);
  }
}

function resolveAssemblerMode(
  device: DiscoveredDevice,
  controllerProtocol: ControllerProtocolId,
  bmsProtocol: BmsProtocolId
): 'text' | 'fardriver' | 'jk' | 'ant' | 'daly' | 'jbd' {
  if (device.deviceType === 'motor') {
    const proto = device.controllerProtocol ?? controllerProtocol;
    return proto === 'fardriver' ? 'fardriver' : 'text';
  }
  if (device.deviceType === 'jikong') {
    return device.bmsProtocol ?? bmsProtocol;
  }
  return 'text';
}

function pickBleCharacteristics(services: BleService[]): {
  serviceUuid: string;
  notifyCharUuid: string;
  writeCharUuid?: string;
  canWriteWithoutResponse: boolean;
} | null {
  const preferredOrder = ['ffe0', 'fff0', 'ff00', '6e400001', '4fafc201'];
  const sorted = [...services].sort((a, b) => {
    const ai = preferredOrder.findIndex((p) => a.uuid.toLowerCase().includes(p));
    const bi = preferredOrder.findIndex((p) => b.uuid.toLowerCase().includes(p));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  for (const svc of sorted) {
    const notifyChar = svc.characteristics.find(
      (c) => c.properties.notify || c.properties.indicate
    );
    if (!notifyChar) continue;
    const writeChar =
      svc.characteristics.find(
        (c) => c.properties.writeWithoutResponse || c.properties.write
      ) || notifyChar;
    return {
      serviceUuid: svc.uuid,
      notifyCharUuid: notifyChar.uuid,
      writeCharUuid: writeChar?.uuid,
      canWriteWithoutResponse: !!writeChar?.properties.writeWithoutResponse,
    };
  }
  return null;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export const bluetoothTransport = new BluetoothTransportManager();
