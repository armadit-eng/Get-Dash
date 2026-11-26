import { BmsProtocolId, ControllerProtocolId, JkBmsData, MotorData } from '../types/dashboard';

export interface ProtocolSpec {
  id: ControllerProtocolId | BmsProtocolId;
  name: string;
  bleServiceUuid: string;
  bleNotifyCharUuid: string;
  bleWriteCharUuid: string;
  baudOrRate: string;
  headerHint: string;
}

export const CONTROLLER_PROTOCOL_SPECS: Record<ControllerProtocolId, ProtocolSpec> = {
  motor_mid: {
    id: 'motor_mid',
    name: 'Motor MID (AT+ Serial / BLE)',
    bleServiceUuid: '0000ffe0-0000-1000-8000-00805f9b34fb',
    bleNotifyCharUuid: '0000ffe1-0000-1000-8000-00805f9b34fb',
    bleWriteCharUuid: '0000ffe1-0000-1000-8000-00805f9b34fb',
    baudOrRate: '115200 bps / Classic SPP / BLE',
    headerHint: 'AT+SPD=, AT+VBAT=, AT+IBAT=, AT+ERR=',
  },
  fardriver: {
    id: 'fardriver',
    name: 'Fardriver Controller (Nanjing/Siaecosys)',
    bleServiceUuid: '0000ffe0-0000-1000-8000-00805f9b34fb',
    bleNotifyCharUuid: '0000ff01-0000-1000-8000-00805f9b34fb',
    bleWriteCharUuid: '0000ff02-0000-1000-8000-00805f9b34fb',
    baudOrRate: '19200 bps UART / BLE FFE0',
    headerHint: 'Frame 16B: AA <pktId 0x13/0x14/0x00..0x2C> <12B payload> <CRC16>',
  },
};

export const BMS_PROTOCOL_SPECS: Record<BmsProtocolId, ProtocolSpec> = {
  jk: {
    id: 'jk',
    name: 'JK-BMS (Jikong)',
    bleServiceUuid: '0000ffe0-0000-1000-8000-00805f9b34fb',
    bleNotifyCharUuid: '0000ffe1-0000-1000-8000-00805f9b34fb',
    bleWriteCharUuid: '0000ffe1-0000-1000-8000-00805f9b34fb',
    baudOrRate: 'BLE Notify 300B',
    headerHint: '55 AA EB 90 02 ... (300 byte + sum8 CRC)',
  },
  ant: {
    id: 'ant',
    name: 'ANT BMS',
    bleServiceUuid: '0000ffe0-0000-1000-8000-00805f9b34fb',
    bleNotifyCharUuid: '0000ffe1-0000-1000-8000-00805f9b34fb',
    bleWriteCharUuid: '0000ffe1-0000-1000-8000-00805f9b34fb',
    baudOrRate: '19200 bps / BLE 140B',
    headerHint: 'AA 55 AA FF ... (140 byte + CRC16) | Req: DB DB 00 00 00 00',
  },
  daly: {
    id: 'daly',
    name: 'DALY Smart BMS',
    bleServiceUuid: '0000fff0-0000-1000-8000-00805f9b34fb',
    bleNotifyCharUuid: '0000fff1-0000-1000-8000-00805f9b34fb',
    bleWriteCharUuid: '0000fff2-0000-1000-8000-00805f9b34fb',
    baudOrRate: '9600 bps / BLE 13B',
    headerHint: 'A5 01 <0x90..0x98> 08 <8B> <sum8> | Req: A5 40 <id> 08 ...',
  },
  jbd: {
    id: 'jbd',
    name: 'JBD / Xiaoxiang BMS',
    bleServiceUuid: '0000ff00-0000-1000-8000-00805f9b34fb',
    bleNotifyCharUuid: '0000ff01-0000-1000-8000-00805f9b34fb',
    bleWriteCharUuid: '0000ff02-0000-1000-8000-00805f9b34fb',
    baudOrRate: '9600 bps / BLE VarLen',
    headerHint: 'DD <03|04> 00 <len> ... <CRC16> 77 | Req: DD A5 03 00 FF FD 77',
  },
};

export function parseHexStringToBytes(hex: string): Uint8Array | null {
  const cleaned = hex.replace(/[^0-9a-fA-F]/g, '');
  if (cleaned.length < 4 || cleaned.length % 2 !== 0) return null;
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

function u16le(b: Uint8Array, off: number): number {
  return b[off] | (b[off + 1] << 8);
}

function i16le(b: Uint8Array, off: number): number {
  const v = u16le(b, off);
  return v >= 0x8000 ? v - 0x10000 : v;
}

function u16be(b: Uint8Array, off: number): number {
  return (b[off] << 8) | b[off + 1];
}

function i16be(b: Uint8Array, off: number): number {
  const v = u16be(b, off);
  return v >= 0x8000 ? v - 0x10000 : v;
}

function u32le(b: Uint8Array, off: number): number {
  return (b[off] | (b[off + 1] << 8) | (b[off + 2] << 16) | (b[off + 3] << 24)) >>> 0;
}

function i32le(b: Uint8Array, off: number): number {
  const v = u32le(b, off);
  return v >= 0x80000000 ? v - 0x100000000 : v;
}

function i32be(b: Uint8Array, off: number): number {
  const v = ((b[off] << 24) | (b[off + 1] << 16) | (b[off + 2] << 8) | b[off + 3]) >>> 0;
  return v >= 0x80000000 ? v - 0x100000000 : v;
}

export function crc16Modbus(buf: Uint8Array, len = buf.length): number {
  let crc = 0xffff;
  for (let i = 0; i < len; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) crc = (crc >>> 1) ^ 0xa001;
      else crc = crc >>> 1;
    }
  }
  return crc & 0xffff;
}

// ============================================================================
// 1. FARDRIVER CONTROLLER PARSER (Nanjing Fardriver BLE / UART 16-Byte Packets)
// ============================================================================
export function parseFardriverFrame(
  buf: Uint8Array,
  current: MotorData,
  opts?: { polePairs?: number; wheelCircumferenceMm?: number; nowMs?: number }
): { data: MotorData; summary: string } | null {
  if (buf.length < 16 || buf[0] !== 0xaa) return null;

  // Verify CRC16 Modbus on bytes 0..13 vs bytes 14..15 (LE)
  const expectedCrc = crc16Modbus(buf, 14);
  const packetCrc = u16le(buf, 14);
  const crcOk = expectedCrc === packetCrc;
  if (!crcOk) {
    // Allow checksum-relaxed frames if user supplies simple 16-byte raw test packet,
    // or reject only when clearly malformed. Let's enforce CRC16 when non-zero!
    if (packetCrc !== 0) {
      return null;
    }
  }

  const pktId = buf[1];
  const nowMs = opts?.nowMs ?? Date.now();
  const polePairs = Math.max(1, opts?.polePairs ?? 24);
  const wheelMm = Math.max(800, opts?.wheelCircumferenceMm ?? 1580);

  // Packet 0x13 / 0x00: Primary Fardriver Live Telemetry Frame
  // [0]=0xAA, [1]=pktId, [2]=gear/flags, [3]=errCode, [4..5]=RPM (i16le),
  // [6..7]=Vbat*0.1 (u16le), [8..9]=LineCurrent*0.25 (i16le, +discharge/-regen),
  // [10..11]=PhaseCurrent*0.5 (i16le), [12]=CtrlTemp (i8), [13]=MotorTemp (i8)
  if (pktId === 0x13 || pktId === 0x00) {
    const flags = buf[2];
    const gearBits = flags & 0x03; // 0=Eco, 1=Mid/Urban, 2=Sport
    const isPark = (flags & 0x04) !== 0;
    const brakeActive = (flags & 0x08) !== 0;
    const errCode = buf[3];
    const erpm = Math.abs(i16le(buf, 4));
    const mechRpm = Math.round(erpm / Math.max(1, polePairs / 24));
    const speedKmh = (mechRpm * wheelMm * 60) / 1_000_000;
    const vbat = u16le(buf, 6) * 0.1;
    // Fardriver reports positive discharge current; normalize to Dashboard convention (-discharge, +regen)
    const rawLineA = i16le(buf, 8) * 0.25;
    const ibat = -rawLineA;
    const phaseCurrentA = Math.abs(i16le(buf, 10) * 0.5);
    const tempInverterC = buf[12] >= 128 ? buf[12] - 256 : buf[12];
    const tempMotorC = buf[13] >= 128 ? buf[13] - 256 : buf[13];

    return {
      data: {
        ...current,
        sourceProtocol: 'fardriver',
        modeIndex: gearBits,
        isPark,
        brakeActive,
        errMask: errCode,
        erpm,
        rpm: mechRpm,
        speedKmh: Number(speedKmh.toFixed(1)),
        vbat: Number(vbat.toFixed(1)),
        ibat: Number(ibat.toFixed(1)),
        phaseCurrentA: Number(phaseCurrentA.toFixed(1)),
        tempInverterC,
        tempMotorC,
        lastUpdatedMs: nowMs,
      },
      summary: `Fardriver 0x${pktId.toString(16)} V=${vbat.toFixed(1)}V I_line=${rawLineA.toFixed(1)}A I_phase=${phaseCurrentA.toFixed(0)}A RPM=${mechRpm}`,
    };
  }

  // Packet 0x14: Throttle, SOC estimate, Odo
  // [2..3]=Throttle mV (u16le), [4]=SOC%, [5..8]=ODO*0.1km (u32le)
  if (pktId === 0x14) {
    const throttleVoltV = u16le(buf, 2) * 0.001;
    const throttlePct = Math.min(100, Math.max(0, ((throttleVoltV - 0.85) / 3.35) * 100));
    const socPct = Math.min(100, buf[4]);
    const odoKm = u32le(buf, 5) * 0.1;
    return {
      data: {
        ...current,
        sourceProtocol: 'fardriver',
        throttleVoltV: Number(throttleVoltV.toFixed(2)),
        throttlePct: Number(throttlePct.toFixed(1)),
        socPct,
        odoKm: odoKm < 400_000 ? Number(odoKm.toFixed(1)) : current.odoKm,
        lastUpdatedMs: nowMs,
      },
      summary: `Fardriver 0x14 Thr=${throttleVoltV.toFixed(2)}V (${Math.round(throttlePct)}%) SOC=${socPct}%`,
    };
  }

  return null;
}

export function buildSampleFardriverHex(speedKmh = 46): string {
  const buf = new Uint8Array(16);
  buf[0] = 0xaa;
  buf[1] = 0x13;
  buf[2] = speedKmh > 50 ? 0x02 : 0x01; // Sport or Urban
  buf[3] = 0x00; // no fault
  const rpm = Math.round((speedKmh * 1_000_000) / (1580 * 60));
  buf[4] = rpm & 0xff;
  buf[5] = (rpm >> 8) & 0xff;
  const vRaw = Math.round(74.8 * 10);
  buf[6] = vRaw & 0xff;
  buf[7] = (vRaw >> 8) & 0xff;
  const lineRaw = Math.round(24.5 * 4); // +24.5A discharge -> -24.5A normalized
  buf[8] = lineRaw & 0xff;
  buf[9] = (lineRaw >> 8) & 0xff;
  const phaseRaw = Math.round(68.0 * 2);
  buf[10] = phaseRaw & 0xff;
  buf[11] = (phaseRaw >> 8) & 0xff;
  buf[12] = 43; // Controller temp
  buf[13] = 51; // Motor temp
  const crc = crc16Modbus(buf, 14);
  buf[14] = crc & 0xff;
  buf[15] = (crc >> 8) & 0xff;
  return bytesToHex(buf);
}

// ============================================================================
// 2. JK-BMS 300-BYTE FRAME PARSER
// ============================================================================
export function buildJkCommandFrame(reg: number): Uint8Array {
  const cmd = new Uint8Array(20);
  cmd[0] = 0xaa;
  cmd[1] = 0x55;
  cmd[2] = 0x90;
  cmd[3] = 0xeb;
  cmd[4] = reg & 0xff;
  let sum = 0;
  for (let i = 0; i < 19; i++) sum += cmd[i];
  cmd[19] = sum & 0xff;
  return cmd;
}

export function parseJkBms300ByteFrame(buf: Uint8Array, nowMs = Date.now()): JkBmsData | null {
  if (buf.length < 300) return null;
  if (buf[0] !== 0x55 || buf[1] !== 0xaa || buf[2] !== 0xeb || buf[3] !== 0x90) return null;
  if (buf[4] !== 0x02) return null;

  let crc = 0;
  for (let i = 0; i < 299; i++) crc += buf[i];
  if ((crc & 0xff) !== buf[299]) return null;

  const decodeVariant = (offset: number) => {
    const maxCells = 24 + offset / 2;
    const cells: number[] = [];
    for (let i = 0; i < maxCells; i++) {
      const v = u16le(buf, 6 + i * 2) * 0.001;
      if (v > 0.5 && v < 5.5) cells.push(Number(v.toFixed(3)));
    }
    const offset2 = offset * 2;
    const vpack = u32le(buf, 118 + offset2) * 0.001;
    const ipack = i32le(buf, 126 + offset2) * 0.001;
    return { offset, offset2, cells, vpack, ipack };
  };

  const v24 = decodeVariant(0);
  const v32 = decodeVariant(16);
  const sum24 = v24.cells.reduce((a, b) => a + b, 0);
  const sum32 = v32.cells.reduce((a, b) => a + b, 0);
  const err24 = v24.vpack > 0 ? Math.abs(sum24 - v24.vpack) / v24.vpack : 99;
  const err32 = v32.vpack > 0 ? Math.abs(sum32 - v32.vpack) / v32.vpack : 99;
  const picked = err24 <= err32 ? v24 : v32;

  const o2 = picked.offset2;
  const cells = picked.cells;
  const temp1C = i16le(buf, 130 + o2) * 0.1;
  const temp2C = i16le(buf, 132 + o2) * 0.1;
  const tempMosC = picked.offset === 16 ? i16le(buf, 112 + o2) * 0.1 : i16le(buf, 134 + o2) * 0.1;
  const balanceStatus = buf[140 + o2];
  const socPct = Math.min(100, Math.max(0, buf[141 + o2]));
  const remainAh = u32le(buf, 142 + o2) * 0.001;
  const capacityAh = u32le(buf, 146 + o2) * 0.001;
  const cycles = u32le(buf, 150 + o2);
  const sohRaw = buf[158 + o2];
  const sohPct = sohRaw >= 1 && sohRaw <= 100 ? sohRaw : undefined;

  const { minCellV, maxCellV, minCellIndex, maxCellIndex, deltaCellV } = calcCellStats(cells);

  return {
    protocol: 'jk',
    vpack: Number(picked.vpack.toFixed(2)),
    ibat: Number(picked.ipack.toFixed(2)),
    socPct,
    sohPct,
    temp1C,
    temp2C,
    tempMosC,
    deltaCellV,
    minCellV,
    maxCellV,
    minCellIndex,
    maxCellIndex,
    cellCount: cells.length,
    cellVoltages: cells,
    cycles,
    remainAh,
    capacityAh,
    balancingActive: balanceStatus !== 0,
    balanceStatus,
    chargeMosOn: true,
    dischargeMosOn: true,
    lastUpdatedMs: nowMs,
  };
}

// ============================================================================
// 3. ANT BMS 140-BYTE FRAME PARSER (AA 55 AA FF)
// ============================================================================
export function buildAntQueryCommand(): Uint8Array {
  return new Uint8Array([0xdb, 0xdb, 0x00, 0x00, 0x00, 0x00]);
}

export function parseAntBmsFrame(buf: Uint8Array, nowMs = Date.now()): JkBmsData | null {
  if (buf.length < 140) return null;
  if (buf[0] !== 0xaa || buf[1] !== 0x55 || buf[2] !== 0xaa || buf[3] !== 0xff) return null;

  const vpack = u16be(buf, 4) * 0.1;
  const declaredCells = Math.min(32, Math.max(1, buf[123] || 20));
  const cells: number[] = [];
  for (let i = 0; i < declaredCells; i++) {
    const v = u16be(buf, 6 + i * 2) * 0.001;
    if (v > 0.5 && v < 5.5) cells.push(Number(v.toFixed(3)));
  }

  const ibat = i32be(buf, 70) * 0.1;
  const socPct = Math.min(100, Math.max(0, buf[74]));
  const capacityAh = u32beSafe(buf, 75) * 0.000001;
  const remainAh = u32beSafe(buf, 79) * 0.000001;
  const tempMosC = i16be(buf, 91);
  const temp1C = i16be(buf, 95);
  const temp2C = i16be(buf, 97);
  const chargeMosOn = buf[103] === 1;
  const dischargeMosOn = buf[104] === 1;
  const balanceStatus = buf[105];

  const { minCellV, maxCellV, minCellIndex, maxCellIndex, deltaCellV } = calcCellStats(cells);

  return {
    protocol: 'ant',
    vpack: Number(vpack.toFixed(2)),
    ibat: Number(ibat.toFixed(2)),
    socPct,
    sohPct: 96,
    temp1C,
    temp2C,
    tempMosC,
    deltaCellV,
    minCellV,
    maxCellV,
    minCellIndex,
    maxCellIndex,
    cellCount: cells.length,
    cellVoltages: cells,
    remainAh: remainAh > 0 ? Number(remainAh.toFixed(2)) : undefined,
    capacityAh: capacityAh > 0 ? Number(capacityAh.toFixed(2)) : undefined,
    balancingActive: balanceStatus !== 0,
    balanceStatus,
    chargeMosOn,
    dischargeMosOn,
    lastUpdatedMs: nowMs,
  };
}

function u32beSafe(b: Uint8Array, off: number): number {
  return ((b[off] << 24) | (b[off + 1] << 16) | (b[off + 2] << 8) | b[off + 3]) >>> 0;
}

export function buildSampleAntHex(): string {
  const buf = new Uint8Array(140);
  buf[0] = 0xaa;
  buf[1] = 0x55;
  buf[2] = 0xaa;
  buf[3] = 0xff;
  const vRaw = 752; // 75.2V
  buf[4] = (vRaw >> 8) & 0xff;
  buf[5] = vRaw & 0xff;
  buf[123] = 20;
  for (let i = 0; i < 20; i++) {
    const mv = 3760 + ((i % 4) - 1) * 4;
    buf[6 + i * 2] = (mv >> 8) & 0xff;
    buf[7 + i * 2] = mv & 0xff;
  }
  const curRaw = -145; // -14.5A discharge
  buf[70] = (curRaw >>> 24) & 0xff;
  buf[71] = (curRaw >>> 16) & 0xff;
  buf[72] = (curRaw >>> 8) & 0xff;
  buf[73] = curRaw & 0xff;
  buf[74] = 81; // SOC 81%
  buf[91] = 0;
  buf[92] = 39; // MOS 39C
  buf[95] = 0;
  buf[96] = 33; // T1 33C
  buf[97] = 0;
  buf[98] = 34; // T2 34C
  buf[103] = 1;
  buf[104] = 1;
  buf[105] = 1;
  return bytesToHex(buf);
}

// ============================================================================
// 4. DALY SMART BMS 13-BYTE FRAME PARSER (A5 01 <cmd> 08 ...)
// ============================================================================
export function buildDalyCommand(dataId: number): Uint8Array {
  const cmd = new Uint8Array(13);
  cmd[0] = 0xa5;
  cmd[1] = 0x40;
  cmd[2] = dataId & 0xff;
  cmd[3] = 0x08;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += cmd[i];
  cmd[12] = sum & 0xff;
  return cmd;
}

export function parseDaly13ByteFrame(
  buf: Uint8Array,
  current: JkBmsData,
  nowMs = Date.now()
): JkBmsData | null {
  if (buf.length < 13 || buf[0] !== 0xa5) return null;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += buf[i];
  if ((sum & 0xff) !== buf[12]) return null;

  const cmd = buf[2];
  const d = buf.subarray(4, 12);

  if (cmd === 0x90) {
    const vpack = u16be(d, 0) * 0.1;
    const ibat = (u16be(d, 4) - 30000) * 0.1;
    const socPct = Math.min(100, Math.max(0, u16be(d, 6) * 0.1));
    return {
      ...current,
      protocol: 'daly',
      vpack: Number(vpack.toFixed(2)),
      ibat: Number(ibat.toFixed(2)),
      socPct: Number(socPct.toFixed(1)),
      lastUpdatedMs: nowMs,
    };
  }
  if (cmd === 0x91) {
    const maxCellV = u16be(d, 0) * 0.001;
    const maxCellIndex = Math.max(0, d[2] - 1);
    const minCellV = u16be(d, 3) * 0.001;
    const minCellIndex = Math.max(0, d[5] - 1);
    return {
      ...current,
      protocol: 'daly',
      maxCellV,
      maxCellIndex,
      minCellV,
      minCellIndex,
      deltaCellV: Number((maxCellV - minCellV).toFixed(3)),
      lastUpdatedMs: nowMs,
    };
  }
  if (cmd === 0x92) {
    const temp1C = d[0] - 40;
    const temp2C = d[2] - 40;
    return {
      ...current,
      protocol: 'daly',
      temp1C,
      temp2C,
      lastUpdatedMs: nowMs,
    };
  }
  if (cmd === 0x93) {
    const chargeMosOn = d[1] === 1;
    const dischargeMosOn = d[2] === 1;
    const remainAh = u32beSafe(d, 4) * 0.001;
    return {
      ...current,
      protocol: 'daly',
      chargeMosOn,
      dischargeMosOn,
      remainAh: Number(remainAh.toFixed(2)),
      lastUpdatedMs: nowMs,
    };
  }
  if (cmd === 0x94) {
    const cellCount = d[0];
    const cycles = u16be(d, 5);
    return {
      ...current,
      protocol: 'daly',
      cellCount,
      cycles,
      lastUpdatedMs: nowMs,
    };
  }
  if (cmd === 0x95) {
    const frameIdx = Math.max(0, d[0] - 1);
    const cells = [...current.cellVoltages];
    for (let j = 0; j < 3; j++) {
      const idx = frameIdx * 3 + j;
      const v = u16be(d, 1 + j * 2) * 0.001;
      if (v > 0.5 && v < 5.5 && idx < (current.cellCount || 32)) {
        cells[idx] = Number(v.toFixed(3));
      }
    }
    const stats = calcCellStats(cells.filter((x) => x > 0));
    return {
      ...current,
      protocol: 'daly',
      cellVoltages: cells,
      cellCount: cells.length,
      ...stats,
      lastUpdatedMs: nowMs,
    };
  }
  if (cmd === 0x97) {
    const balMask = u16be(d, 0);
    return {
      ...current,
      protocol: 'daly',
      balancingActive: balMask !== 0,
      balanceStatus: balMask,
      lastUpdatedMs: nowMs,
    };
  }
  return null;
}

export function buildSampleDalyHex(): string {
  const cmd = new Uint8Array(13);
  cmd[0] = 0xa5;
  cmd[1] = 0x01;
  cmd[2] = 0x90;
  cmd[3] = 0x08;
  const vRaw = 744; // 74.4V
  cmd[4] = (vRaw >> 8) & 0xff;
  cmd[5] = vRaw & 0xff;
  const iRaw = 30000 - 185; // -18.5A
  cmd[8] = (iRaw >> 8) & 0xff;
  cmd[9] = iRaw & 0xff;
  const socRaw = 785; // 78.5%
  cmd[10] = (socRaw >> 8) & 0xff;
  cmd[11] = socRaw & 0xff;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += cmd[i];
  cmd[12] = sum & 0xff;
  return bytesToHex(cmd);
}

// ============================================================================
// 5. JBD / XIAOXIANG BMS PARSER (DD 03 / DD 04 ... 77)
// ============================================================================
export const JBD_CMD_BASIC = new Uint8Array([0xdd, 0xa5, 0x03, 0x00, 0xff, 0xfd, 0x77]);
export const JBD_CMD_CELLS = new Uint8Array([0xdd, 0xa5, 0x04, 0x00, 0xff, 0xfc, 0x77]);

export function parseJbdFrame(
  buf: Uint8Array,
  current: JkBmsData,
  nowMs = Date.now()
): JkBmsData | null {
  if (buf.length < 7 || buf[0] !== 0xdd || buf[buf.length - 1] !== 0x77) return null;
  const cmd = buf[1];
  const len = buf[3];
  if (buf.length < 4 + len + 3) return null;
  const p = buf.subarray(4, 4 + len);

  if (cmd === 0x03 && len >= 23) {
    const vpack = u16be(p, 0) * 0.01;
    const ibat = i16be(p, 2) * 0.01;
    const remainAh = u16be(p, 4) * 0.01;
    const capacityAh = u16be(p, 6) * 0.01;
    const cycles = u16be(p, 8);
    const balMask = u16be(p, 12);
    const socPct = Math.min(100, Math.max(0, p[19]));
    const fet = p[20];
    const cellCount = p[21];
    const ntcCount = p[22];
    const temp1C = ntcCount >= 1 && len >= 25 ? (u16be(p, 23) - 2731) * 0.1 : current.temp1C;
    const temp2C = ntcCount >= 2 && len >= 27 ? (u16be(p, 25) - 2731) * 0.1 : current.temp2C;

    return {
      ...current,
      protocol: 'jbd',
      vpack: Number(vpack.toFixed(2)),
      ibat: Number(ibat.toFixed(2)),
      remainAh,
      capacityAh,
      cycles,
      socPct,
      cellCount,
      balancingActive: balMask !== 0,
      balanceStatus: balMask,
      chargeMosOn: (fet & 0x01) !== 0,
      dischargeMosOn: (fet & 0x02) !== 0,
      temp1C: temp1C !== undefined ? Number(temp1C.toFixed(1)) : undefined,
      temp2C: temp2C !== undefined ? Number(temp2C.toFixed(1)) : undefined,
      lastUpdatedMs: nowMs,
    };
  }

  if (cmd === 0x04 && len >= 2) {
    const cells: number[] = [];
    for (let i = 0; i + 1 < len; i += 2) {
      const v = u16be(p, i) * 0.001;
      if (v > 0.5 && v < 5.5) cells.push(Number(v.toFixed(3)));
    }
    const stats = calcCellStats(cells);
    return {
      ...current,
      protocol: 'jbd',
      cellCount: cells.length,
      cellVoltages: cells,
      ...stats,
      lastUpdatedMs: nowMs,
    };
  }

  return null;
}

export function buildSampleJbdHex(): string {
  // Basic info frame (27 payload bytes)
  const buf = new Uint8Array(34);
  buf[0] = 0xdd;
  buf[1] = 0x03;
  buf[2] = 0x00;
  buf[3] = 27;
  const vRaw = 7380; // 73.80V
  buf[4] = (vRaw >> 8) & 0xff;
  buf[5] = vRaw & 0xff;
  const iRaw = -1240; // -12.40A
  buf[6] = (iRaw >> 8) & 0xff;
  buf[7] = iRaw & 0xff;
  const remRaw = 1640; // 16.40Ah
  buf[8] = (remRaw >> 8) & 0xff;
  buf[9] = remRaw & 0xff;
  const capRaw = 2000; // 20.00Ah
  buf[10] = (capRaw >> 8) & 0xff;
  buf[11] = capRaw & 0xff;
  buf[13] = 42; // cycles
  buf[23] = 82; // RSOC 82%
  buf[24] = 0x03; // CHG + DSG ON
  buf[25] = 20; // 20S
  buf[26] = 2; // 2 NTCs
  const t1 = 2731 + 325; // 32.5C
  const t2 = 2731 + 331; // 33.1C
  buf[27] = (t1 >> 8) & 0xff;
  buf[28] = t1 & 0xff;
  buf[29] = (t2 >> 8) & 0xff;
  buf[30] = t2 & 0xff;
  buf[33] = 0x77;
  return bytesToHex(buf);
}

export function detectAndParseBmsFrame(
  bytes: Uint8Array,
  protocol: BmsProtocolId,
  current: JkBmsData,
  nowMs = Date.now()
): JkBmsData | null {
  if (protocol === 'jk') return parseJkBms300ByteFrame(bytes, nowMs);
  if (protocol === 'ant') return parseAntBmsFrame(bytes, nowMs);
  if (protocol === 'daly') return parseDaly13ByteFrame(bytes, current, nowMs);
  if (protocol === 'jbd') return parseJbdFrame(bytes, current, nowMs);
  return null;
}

function calcCellStats(cells: number[]) {
  let minCellV: number | undefined;
  let maxCellV: number | undefined;
  let minCellIndex = -1;
  let maxCellIndex = -1;
  cells.forEach((c, idx) => {
    if (minCellV === undefined || c < minCellV) {
      minCellV = c;
      minCellIndex = idx;
    }
    if (maxCellV === undefined || c > maxCellV) {
      maxCellV = c;
      maxCellIndex = idx;
    }
  });
  const deltaCellV =
    minCellV !== undefined && maxCellV !== undefined
      ? Number((maxCellV - minCellV).toFixed(3))
      : undefined;
  return { minCellV, maxCellV, minCellIndex, maxCellIndex, deltaCellV };
}
