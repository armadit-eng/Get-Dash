import {
  AppAlert,
  AppSettings,
  Battery2Data,
  ChargingIndicatorState,
  ConnectionStateX,
  DailyChallenge,
  EffectiveTelemetry,
  EfficiencyTrend,
  Esp32Data,
  FuelSavingsSummary,
  JkBmsData,
  kMotorErrorDefs,
  LiveTripMetrics,
  MaintenanceStatus,
  MotorData,
  PersonalRecords,
  RiderBadge,
  RidingScoreState,
  TripRecord,
} from '../types/dashboard';

export const STALE_MS = 10_000;
export const INTEGRATE_MAX_GAP_MS = 4_500;

export function parseMotorAtLine(
  rawLine: string,
  current: MotorData,
  nowMs = Date.now(),
  onValidOdo?: (odo: number) => void,
  onCorruptOdo?: (msg: string) => void
): MotorData | null {
  const line = rawLine.trim();
  if (!line || line.toUpperCase() === 'OK') return null;

  let cleanLine = line;
  const upperIdx = line.toUpperCase().indexOf('+CBAT');
  if (line.toUpperCase().includes('AT+') && upperIdx > 3) {
    cleanLine = line.substring(upperIdx);
  }

  const eqIdx = cleanLine.indexOf('=');
  const colIdx = cleanLine.indexOf(':');
  let sep = -1;
  if (eqIdx > 0 && colIdx > 0) sep = Math.min(eqIdx, colIdx);
  else if (eqIdx > 0) sep = eqIdx;
  else if (colIdx > 0) sep = colIdx;

  if (sep <= 0) return null;

  const key = cleanLine
    .substring(0, sep)
    .trim()
    .toUpperCase()
    .replace(/^AT\+/, '')
    .replace(/^\+/, '');
  const valStr = cleanLine.substring(sep + 1).trim().replace(/"/g, '');
  const leadingMatch = valStr.match(/[-+]?\d+(?:\.\d+)?/);
  const numVal = Number.isFinite(Number(valStr)) && valStr !== ''
    ? Number(valStr)
    : leadingMatch
      ? Number(leadingMatch[0])
      : null;

  if (key.includes('SPD') && numVal !== null) {
    return { ...current, speedKmh: Math.max(0, numVal), lastUpdatedMs: nowMs };
  }
  if (key.includes('RPM') && numVal !== null) {
    return { ...current, rpm: Math.max(0, Math.round(numVal)), lastUpdatedMs: nowMs };
  }
  if (key.includes('TIME')) {
    return { ...current, timeStr: valStr, lastUpdatedMs: nowMs };
  }
  if (key.includes('VBAT') && numVal !== null) {
    return { ...current, vbat: numVal, lastUpdatedMs: nowMs };
  }
  if (key.includes('IBAT') && numVal !== null) {
    return { ...current, ibat: numVal, lastUpdatedMs: nowMs };
  }
  if (key.includes('TRT') && numVal !== null) {
    return { ...current, throttlePct: Math.min(100, Math.max(0, numVal)), lastUpdatedMs: nowMs };
  }
  if (key.includes('SOC') && numVal !== null) {
    return { ...current, socPct: Math.min(100, Math.max(0, numVal)), lastUpdatedMs: nowMs };
  }
  if (key.includes('SOH') && numVal !== null) {
    return { ...current, sohPct: Math.min(100, Math.max(0, numVal)), lastUpdatedMs: nowMs };
  }
  if (key.includes('CBAT') && numVal !== null) {
    return { ...current, cbatCycles: Math.max(0, Math.round(numVal)), lastUpdatedMs: nowMs };
  }
  if (key.includes('ODO') && numVal !== null) {
    if (numVal >= 0 && numVal < 400_000) {
      onValidOdo?.(numVal);
      return { ...current, odoKm: numVal, lastUpdatedMs: nowMs };
    } else {
      onCorruptOdo?.(`ODO korup diabaikan: ${numVal}`);
      return current;
    }
  }
  if (key.includes('ERR')) {
    const cleanedHex = valStr.replace(/^0x/i, '');
    const parsedInt = /^\d+$/.test(valStr)
      ? parseInt(valStr, 10)
      : /^[0-9a-fA-F]+$/.test(cleanedHex)
        ? parseInt(cleanedHex, 16)
        : numVal !== null
          ? Math.trunc(numVal)
          : 0;
    return { ...current, errMask: parsedInt, lastUpdatedMs: nowMs };
  }
  if (key.includes('MODE') && numVal !== null) {
    return { ...current, modeIndex: Math.round(numVal), lastUpdatedMs: nowMs };
  }
  if (key.includes('PARK') && numVal !== null) {
    return { ...current, isPark: Math.round(numVal) === 1, lastUpdatedMs: nowMs };
  }
  if (key.includes('TINV') && numVal !== null) {
    return { ...current, tempInverterC: numVal, lastUpdatedMs: nowMs };
  }
  if (key.includes('TMOT') && numVal !== null) {
    return { ...current, tempMotorC: numVal, lastUpdatedMs: nowMs };
  }
  if (key.includes('TBAT') && numVal !== null) {
    return { ...current, tempBatteryC: numVal, lastUpdatedMs: nowMs };
  }
  return null;
}

export function computeEffective(params: {
  motor: MotorData;
  motorState: ConnectionStateX;
  jk: JkBmsData;
  jkState: ConnectionStateX;
  esp1: Esp32Data;
  esp1State: ConnectionStateX;
  b2: Battery2Data;
  esp2State: ConnectionStateX;
  gpsSpeedKmh?: number;
  trip: LiveTripMetrics;
  settings: AppSettings;
  nowMs?: number;
}): EffectiveTelemetry {
  const {
    motor,
    motorState,
    jk,
    jkState,
    esp1,
    esp1State,
    b2,
    esp2State,
    gpsSpeedKmh,
    trip,
    settings,
    nowMs = Date.now(),
  } = params;

  const motorAlive = motorState === 'CONNECTED' && nowMs - motor.lastUpdatedMs < STALE_MS;
  const jkAlive = jkState === 'CONNECTED' && nowMs - jk.lastUpdatedMs < STALE_MS;
  const esp1Alive = esp1State === 'CONNECTED' && nowMs - esp1.lastUpdatedMs < STALE_MS;
  const esp2Alive = esp2State === 'CONNECTED' && nowMs - b2.lastUpdatedMs < STALE_MS;

  const speedKmh =
    motorAlive && motor.speedKmh !== undefined
      ? motor.speedKmh
      : esp1Alive && esp1.speedKmh !== undefined
        ? esp1.speedKmh
        : gpsSpeedKmh;

  const throttlePct =
    motorAlive && motor.throttlePct !== undefined
      ? motor.throttlePct
      : esp1Alive && esp1.throttlePct !== undefined
        ? esp1.throttlePct
        : undefined;

  const bmsLabels: Record<string, string> = {
    jk: 'JK-BMS',
    ant: 'ANT BMS',
    daly: 'DALY BMS',
    jbd: 'JBD BMS',
  };
  const oriSourceLabel =
    motor.sourceProtocol === 'fardriver' ? 'Fardriver (ORI)' : 'Motor MID (ORI)';
  const smartBmsLabel = bmsLabels[jk.protocol] ?? 'JK-BMS';

  const oriActive =
    motorAlive &&
    (motor.socPct !== undefined || motor.vbat !== undefined || motor.ibat !== undefined);
  const smartBmsActive =
    jkAlive && (jk.socPct !== undefined || jk.vpack !== undefined || jk.ibat !== undefined);

  const preferSmartBms = settings.batteryPriorityId === 'jikong';
  let b1SourceLabel = '—';
  let b1SocPct: number | undefined;
  let b1Vbat: number | undefined;
  let b1Ibat: number | undefined;
  let b1TempC: number | undefined;
  let b1SohPct: number | undefined;

  // Strict source isolation: never mix fields between Baterai ORI/MID and External Smart BMS.
  if ((preferSmartBms && smartBmsActive) || (!oriActive && smartBmsActive)) {
    b1SourceLabel = smartBmsLabel;
    b1SocPct = jk.socPct;
    b1Vbat = jk.vpack;
    b1Ibat = jk.ibat;
    b1TempC = jk.temp1C;
    b1SohPct = jk.sohPct;
  } else if (oriActive) {
    b1SourceLabel = oriSourceLabel;
    b1SocPct = motor.socPct;
    b1Vbat = motor.vbat;
    b1Ibat = motor.ibat;
    b1TempC = motor.tempBatteryC;
    b1SohPct = motor.sohPct;
  }

  const b2Active = esp2Alive && (b2.socPct !== undefined || b2.vbat !== undefined);
  const b2SocPct = b2Active ? b2.socPct : undefined;
  const b2Vbat = b2Active ? b2.vbat : undefined;
  const b2Ibat = b2Active ? b2.ibat : undefined;
  const b2TempC = b2Active ? b2.tempC : undefined;
  const b2SohPct = b2Active ? b2.sohPct : undefined;

  const w1 = settings.b1NominalV * settings.b1CapacityAh;
  const w2 = settings.b2NominalV * settings.b2CapacityAh;

  const combinedSocPct =
    b1SocPct !== undefined && b2SocPct !== undefined
      ? (b1SocPct * w1 + b2SocPct * w2) / (w1 + w2)
      : b1SocPct ?? b2SocPct;

  const combinedSohPct =
    b1SohPct !== undefined && b2SohPct !== undefined
      ? (b1SohPct * w1 + b2SohPct * w2) / (w1 + w2)
      : b1SohPct ?? b2SohPct;

  const p1 = b1Vbat !== undefined && b1Ibat !== undefined ? -(b1Vbat * b1Ibat) : undefined;
  const p2 = b2Active
    ? b2.powerW ?? (b2Vbat !== undefined && b2Ibat !== undefined ? -(b2Vbat * b2Ibat) : undefined)
    : undefined;

  const combinedPowerW =
    p1 !== undefined && p2 !== undefined ? p1 + p2 : p1 ?? p2;
  const combinedCurrentA =
    b1Ibat !== undefined && b2Ibat !== undefined ? b1Ibat + b2Ibat : b1Ibat ?? b2Ibat;
  const avgVoltageV =
    b1Vbat !== undefined && b2Vbat !== undefined ? (b1Vbat + b2Vbat) / 2 : b1Vbat ?? b2Vbat;

  const spd = speedKmh ?? 0;
  const curr = combinedCurrentA ?? 0;
  const isRegen = curr > 0.3 && spd > 1.0;
  const isCharging = curr > 0.3 && spd <= 1.0;

  const refWhKm = Math.min(90, Math.max(10, settings.refWhPerKm));
  const measuredWhKm = trip.distanceKm > 0.05 ? trip.energyWh / trip.distanceKm : 0;
  let blendedWhPerKm = refWhKm;
  if (trip.distanceKm >= 1.5 && measuredWhKm > 1.0) {
    blendedWhPerKm = measuredWhKm;
  } else if (trip.distanceKm > 0.1 && measuredWhKm > 1.0) {
    const k0 = 0.3 * (1.0 - trip.distanceKm / 1.5);
    blendedWhPerKm = k0 * refWhKm + (1.0 - k0) * measuredWhKm;
  }

  let totalAvailableWh = 0;
  let maxPackWh = w1;
  if (b1SocPct !== undefined && b2SocPct !== undefined) {
    totalAvailableWh = w1 * (b1SocPct / 100) + w2 * (b2SocPct / 100);
    maxPackWh = w1 + w2;
  } else if (b1SocPct !== undefined) {
    totalAvailableWh = w1 * (b1SocPct / 100);
    maxPackWh = w1;
  } else if (b2SocPct !== undefined) {
    totalAvailableWh = w2 * (b2SocPct / 100);
    maxPackWh = w2;
  }

  const hasSoc = b1SocPct !== undefined || b2SocPct !== undefined;
  const rangeKm = hasSoc && blendedWhPerKm > 1.0 ? Math.max(0, totalAvailableWh / blendedWhPerKm) : undefined;

  let chargeEtaHours: number | undefined;
  if (isCharging && combinedPowerW !== undefined && combinedPowerW < -20) {
    const remainingWhToFull = Math.max(0, maxPackWh - totalAvailableWh);
    chargeEtaHours = remainingWhToFull / Math.abs(combinedPowerW);
  }

  const activeErrors = kMotorErrorDefs.filter((e) => ((motor.errMask >>> e.bit) & 1) === 1);
  const odoKm = motor.odoKm ?? settings.odoBackupKm;
  const modeIdx = esp1Alive && esp1.modeIndex !== undefined ? esp1.modeIndex : motor.modeIndex;
  const modeLabel =
    modeIdx === 0 ? 'ECO' : modeIdx === 1 ? 'URBAN' : modeIdx === 2 ? 'SPORT' : '—';

  return {
    speedKmh,
    rpm: motorAlive && motor.rpm !== undefined ? motor.rpm : speedKmh !== undefined ? Math.round(speedKmh * 51.45) : undefined,
    throttlePct,
    oriActive,
    oriSourceLabel,
    oriSocPct: oriActive ? motor.socPct : undefined,
    oriVbat: oriActive ? motor.vbat : undefined,
    oriIbat: oriActive ? motor.ibat : undefined,
    oriTempC: oriActive ? motor.tempBatteryC : undefined,
    oriSohPct: oriActive ? motor.sohPct : undefined,
    smartBmsActive,
    smartBmsLabel,
    smartBmsSocPct: smartBmsActive ? jk.socPct : undefined,
    smartBmsVbat: smartBmsActive ? jk.vpack : undefined,
    smartBmsIbat: smartBmsActive ? jk.ibat : undefined,
    smartBmsTempC: smartBmsActive ? jk.temp1C : undefined,
    smartBmsSohPct: smartBmsActive ? jk.sohPct : undefined,
    b1SocPct,
    b1Vbat,
    b1Ibat,
    b1TempC,
    b1SohPct,
    b1SourceLabel,
    b2Active,
    b2SocPct,
    b2Vbat,
    b2Ibat,
    b2TempC,
    combinedSocPct,
    combinedSohPct,
    combinedPowerW,
    combinedCurrentA,
    avgVoltageV,
    isCharging,
    isRegen,
    rangeKm,
    blendedWhPerKm,
    totalAvailableWh,
    chargeEtaHours,
    odoKm,
    modeLabel,
    isPark: esp1Alive && esp1.isPark !== undefined ? esp1.isPark : motor.isPark,
    sideStandDown: esp1Alive && esp1.sideStandDown,
    cruiseActive: esp1Alive && esp1.cruiseActive,
    reverseActive: esp1Alive && esp1.reverseActive,
    activeErrors,
  };
}

export function getChargingIndicator(eff: EffectiveTelemetry): ChargingIndicatorState {
  if (eff.isRegen) return 'Regeneratif';
  if (eff.isCharging) return 'Mengisi Daya';
  if (eff.combinedSocPct !== undefined && eff.combinedSocPct >= 99.5) return 'Terisi Penuh';
  return 'Tidak Mengisi';
}

export function computeRidingScore(state: RidingScoreState): { score?: number; label: string } {
  if (state.samples < 3) return { score: undefined, label: 'Belum ada data' };
  const ecoRatio = 1.0 - state.ecoViolations / state.samples;
  const brakeRatio = 1.0 - Math.min(1.0, state.hardBrakes / (state.samples * 0.05));
  const regenRatio = Math.min(1.0, state.regenEvents / (state.samples * 0.1));
  const score = Math.min(100, Math.max(0, Math.round(ecoRatio * 50 + brakeRatio * 30 + regenRatio * 20)));
  const label = score >= 80 ? 'Efisien' : score >= 60 ? 'Normal' : 'Boros';
  return { score, label };
}

export function integrateSample(
  prevTrip: LiveTripMetrics,
  prevScore: RidingScoreState,
  eff: EffectiveTelemetry,
  nowMs: number,
  wasMoving: boolean
): { trip: LiveTripMetrics; score: RidingScoreState; wasMoving: boolean } {
  const trip: LiveTripMetrics =
    prevTrip.startTimeMs === 0
      ? {
          ...prevTrip,
          startTimeMs: nowMs,
          startSocPct: eff.combinedSocPct,
          lastSampleMs: nowMs,
        }
      : prevTrip;

  const dtMs = trip.lastSampleMs > 0 ? nowMs - trip.lastSampleMs : 0;
  if (dtMs <= 0 || dtMs > INTEGRATE_MAX_GAP_MS) {
    return {
      trip: { ...trip, lastSampleMs: nowMs },
      score: prevScore,
      wasMoving,
    };
  }

  const dtSec = dtMs / 1000;
  const dtHr = dtMs / 3_600_000;
  const spd = eff.speedKmh ?? 0;
  const nowMoving = spd > 1.5;
  const distDeltaKm = nowMoving ? spd * dtHr : 0;

  const p1 = eff.b1Vbat !== undefined && eff.b1Ibat !== undefined ? eff.b1Vbat * eff.b1Ibat : 0;
  const p2 = eff.b2Vbat !== undefined && eff.b2Ibat !== undefined ? eff.b2Vbat * eff.b2Ibat : 0;
  const totalI = eff.combinedCurrentA ?? 0;
  const totalP = -(p1 + p2);

  let energyAdd = 0;
  let ahAdd = 0;
  let regenAdd = 0;
  let chargeAdd = 0;
  if (totalI < 0) {
    energyAdd = Math.abs(totalP) * dtHr;
    ahAdd = Math.abs(totalI) * dtHr;
  } else if (totalI > 0 && spd > 1.0) {
    regenAdd = Math.abs(totalP) * dtHr;
  } else if (totalI > 0 && spd <= 1.0) {
    chargeAdd = Math.abs(totalP) * dtHr;
  }

  const stopInc = wasMoving && !nowMoving && trip.distanceKm > 0.05 ? 1 : 0;
  const moveIncSec = nowMoving ? Math.max(1, Math.round(dtSec)) : 0;
  const vNow = eff.avgVoltageV;
  const tNow = eff.b1TempC ?? eff.b2TempC;

  const nextTrip: LiveTripMetrics = {
    ...trip,
    distanceKm: trip.distanceKm + distDeltaKm,
    energyWh: trip.energyWh + energyAdd,
    consumedAh: trip.consumedAh + ahAdd,
    regenWh: trip.regenWh + regenAdd,
    chargeWh: trip.chargeWh + chargeAdd,
    maxSpeedKmh: Math.max(trip.maxSpeedKmh, spd),
    maxPowerW: Math.max(trip.maxPowerW, totalP > 0 ? totalP : 0),
    maxRegenW: Math.max(trip.maxRegenW, eff.isRegen ? Math.abs(totalP) : 0),
    maxCurrentA: Math.max(trip.maxCurrentA, Math.abs(totalI)),
    minVbat: vNow !== undefined ? (trip.minVbat !== undefined ? Math.min(trip.minVbat, vNow) : vNow) : trip.minVbat,
    maxVbat: vNow !== undefined ? (trip.maxVbat !== undefined ? Math.max(trip.maxVbat, vNow) : vNow) : trip.maxVbat,
    maxTbatC: tNow !== undefined ? (trip.maxTbatC !== undefined ? Math.max(trip.maxTbatC, tNow) : tNow) : trip.maxTbatC,
    movingSeconds: trip.movingSeconds + moveIncSec,
    stopCount: trip.stopCount + stopInc,
    lastSampleMs: nowMs,
    startSocPct: trip.startSocPct ?? eff.combinedSocPct,
  };

  const nextScore: RidingScoreState =
    eff.speedKmh !== undefined && (nowMoving || Math.abs(totalP) > 50)
      ? {
          samples: prevScore.samples + 1,
          ecoViolations: prevScore.ecoViolations + (totalP > 2500 ? 1 : 0),
          hardBrakes: prevScore.hardBrakes + (prevScore.lastSpeedKmh - spd > 15 ? 1 : 0),
          regenEvents: prevScore.regenEvents + (totalI > 0 && spd > 5 ? 1 : 0),
          lastSpeedKmh: spd,
        }
      : { ...prevScore, lastSpeedKmh: spd };

  return { trip: nextTrip, score: nextScore, wasMoving: nowMoving };
}

export function evaluateAlarms(
  eff: EffectiveTelemetry,
  jk: JkBmsData,
  b2: Battery2Data,
  settings: AppSettings
): AppAlert[] {
  if (!settings.alarmMasterOn) return [];
  const now = Date.now();
  const alerts: AppAlert[] = [];

  if (eff.combinedSocPct !== undefined && eff.combinedSocPct <= settings.alarmLowSocPct) {
    alerts.push({
      id: 'low_soc',
      title: 'Baterai Rendah',
      message: `SOC gabungan ${Math.round(eff.combinedSocPct)}% (batas ${Math.round(settings.alarmLowSocPct)}%). Segera cari SPKLU.`,
      severity: eff.combinedSocPct <= 10 ? 'CRITICAL' : 'WARNING',
      timestampMs: now,
    });
  }

  const maxTemp = Math.max(
    eff.b1TempC ?? -99,
    eff.b2TempC ?? -99,
    jk.tempMosC ?? -99
  );
  if (maxTemp >= settings.alarmHighTempC) {
    alerts.push({
      id: 'high_temp',
      title: 'Suhu Baterai / MOSFET Tinggi',
      message: `Suhu mencapai ${maxTemp.toFixed(1)}°C (batas ${settings.alarmHighTempC.toFixed(0)}°C).`,
      severity: maxTemp >= settings.alarmHighTempC + 8 ? 'CRITICAL' : 'WARNING',
      timestampMs: now,
    });
  }

  const maxDeltaMv = Math.max(
    jk.deltaCellV ? jk.deltaCellV * 1000 : 0,
    b2.deltaCellV ? b2.deltaCellV * 1000 : 0
  );
  if (maxDeltaMv >= settings.alarmCellDeltaMv) {
    alerts.push({
      id: 'cell_delta',
      title: 'Ketidakseimbangan Sel Baterai',
      message: `Delta antar sel ${Math.round(maxDeltaMv)} mV (batas ${Math.round(settings.alarmCellDeltaMv)} mV).`,
      severity: 'WARNING',
      timestampMs: now,
    });
  }

  if (eff.combinedCurrentA !== undefined && Math.abs(eff.combinedCurrentA) >= settings.alarmOvercurrentA) {
    alerts.push({
      id: 'overcurrent',
      title: 'Arus Puncak Tinggi',
      message: `Arus gabungan ${Math.abs(eff.combinedCurrentA).toFixed(1)} A mendekati batas.`,
      severity: 'WARNING',
      timestampMs: now,
    });
  }

  if (eff.activeErrors.length > 0) {
    alerts.push({
      id: 'dtc_fault',
      title: `${eff.activeErrors.length} Kode Fault Motor (DTC)`,
      message: eff.activeErrors.map((e) => e.label).join(', '),
      severity: 'CRITICAL',
      timestampMs: now,
    });
  }

  return alerts;
}

export function computeFuelSavings(
  trips: TripRecord[],
  liveTrip: LiveTripMetrics,
  settings: AppSettings
): FuelSavingsSummary {
  const totalKm = trips.reduce((acc, t) => acc + t.distanceKm, 0) + liveTrip.distanceKm;
  const totalWh = trips.reduce((acc, t) => acc + t.energyWh, 0) + liveTrip.energyWh;
  const totalKwhUsed = totalWh / 1000;
  const plnCostRp = totalKwhUsed * settings.plnPricePerKwh;
  const litersSaved = settings.iceKmPerLiter > 0 ? totalKm / settings.iceKmPerLiter : 0;
  const bbmCostRp = litersSaved * settings.bbmPricePerLiter;
  const netSavingsRp = Math.max(0, bbmCostRp - plnCostRp);
  const co2SavedKg = Math.max(0, litersSaved * 2.31 - totalKwhUsed * 0.65);
  return { totalKm, totalKwhUsed, plnCostRp, bbmCostRp, netSavingsRp, co2SavedKg };
}

export function computeMaintenanceStatus(odoKm: number, settings: AppSettings): MaintenanceStatus {
  const interval = Math.max(500, settings.maintIntervalKm);
  const nextServiceKm = settings.maintLastOdoKm + interval;
  const remainingKm = nextServiceKm - odoKm;
  const progressPct = Math.min(1, Math.max(0, (odoKm - settings.maintLastOdoKm) / interval));
  const level = remainingKm <= 0 ? 'OVERDUE' : remainingKm <= 300 ? 'SOON' : 'OK';
  return { currentOdoKm: odoKm, nextServiceKm, remainingKm, progressPct, level };
}

export function computeBadges(
  trips: TripRecord[],
  liveTrip: LiveTripMetrics,
  scoreState: RidingScoreState
): RiderBadge[] {
  const totalKm = trips.reduce((acc, t) => acc + t.distanceKm, 0) + liveTrip.distanceKm;
  const totalRegen = trips.reduce((acc, t) => acc + t.regenWh, 0) + liveTrip.regenWh;
  const { score: liveScore } = computeRidingScore(scoreState);
  const bestScore = Math.max(liveScore ?? 0, ...trips.map((t) => t.ridingScore ?? 0));

  return [
    {
      id: 'b_10km',
      title: 'First Spark',
      description: 'Tempuh jarak total 10 km pertama',
      unlocked: totalKm >= 10,
      progress: Math.min(1, totalKm / 10),
    },
    {
      id: 'b_100km',
      title: 'Century Rider',
      description: 'Tempuh akumulasi 100 km',
      unlocked: totalKm >= 100,
      progress: Math.min(1, totalKm / 100),
    },
    {
      id: 'b_regen',
      title: 'Regen Master',
      description: 'Pulihkan energi 50 Wh dari pengereman',
      unlocked: totalRegen >= 50,
      progress: Math.min(1, totalRegen / 50),
    },
    {
      id: 'b_eco',
      title: 'Eco Maestro',
      description: 'Raih Riding Score >= 90 pada perjalanan',
      unlocked: bestScore >= 90,
      progress: Math.min(1, bestScore / 90),
    },
  ];
}

export function computePersonalRecords(
  trips: TripRecord[],
  liveTrip: LiveTripMetrics,
  scoreState: RidingScoreState
): PersonalRecords {
  const maxSpeedKmh = Math.max(liveTrip.maxSpeedKmh, ...trips.map((t) => t.maxSpeedKmh), 0);
  const longestTripKm = Math.max(liveTrip.distanceKm, ...trips.map((t) => t.distanceKm), 0);
  const effList = trips.filter((t) => t.distanceKm >= 1 && t.whPerKm > 1).map((t) => t.whPerKm);
  const bestEfficiencyWhKm = effList.length > 0 ? Math.min(...effList) : undefined;
  const { score: liveScore } = computeRidingScore(scoreState);
  const scoreList = [...trips.map((t) => t.ridingScore).filter((x): x is number => x !== undefined)];
  if (liveScore !== undefined) scoreList.push(liveScore);
  const bestScore = scoreList.length > 0 ? Math.max(...scoreList) : undefined;
  const mostRegenWh = Math.max(liveTrip.regenWh, ...trips.map((t) => t.regenWh), 0);
  return { maxSpeedKmh, longestTripKm, bestEfficiencyWhKm, bestScore, mostRegenWh };
}

export function computeEfficiencyTrend(trips: TripRecord[]): EfficiencyTrend | undefined {
  const valid = trips.filter((t) => t.distanceKm >= 1 && t.whPerKm > 1);
  if (valid.length < 6) return undefined;
  const recentAvgWhKm = valid.slice(0, 3).reduce((a, b) => a + b.whPerKm, 0) / 3;
  const prevAvgWhKm = valid.slice(3, 6).reduce((a, b) => a + b.whPerKm, 0) / 3;
  if (prevAvgWhKm <= 1) return undefined;
  const deltaPct = ((recentAvgWhKm - prevAvgWhKm) / prevAvgWhKm) * 100;
  return { recentAvgWhKm, prevAvgWhKm, deltaPct };
}

export function computeDailyChallenge(trips: TripRecord[], nowMs = Date.now()): DailyChallenge {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  const dayStart = d.getTime();
  const todays = trips.filter((t) => t.endTimeMs >= dayStart);
  const dayOfYear = Math.floor((nowMs - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);
  const seed = dayOfYear % 3;

  if (seed === 0) {
    const km = todays.reduce((a, b) => a + b.distanceKm, 0);
    return {
      title: 'Target Jarak Harian (10 km)',
      description: `${km.toFixed(1)} / 10.0 km ditempuh hari ini`,
      progress: Math.min(1, km / 10),
      completed: km >= 10,
    };
  }
  if (seed === 1) {
    const regen = todays.reduce((a, b) => a + b.regenWh, 0);
    return {
      title: 'Pemburu Regen (+15 Wh)',
      description: `${Math.round(regen)} / 15 Wh energi dipulihkan hari ini`,
      progress: Math.min(1, regen / 15),
      completed: regen >= 15,
    };
  }
  const best = Math.max(0, ...todays.map((t) => t.ridingScore ?? 0));
  return {
    title: 'Pengendara Eco (Skor >= 85)',
    description: best > 0 ? `Skor terbaik hari ini: ${best} / 85` : 'Catat 1 trip dengan Skor >= 85',
    progress: Math.min(1, best / 85),
    completed: best >= 85,
  };
}

export function computeIdleDrainPct(
  lastParkSocPct: number | undefined,
  lastParkTsMs: number,
  currentSocPct: number | undefined,
  nowMs = Date.now()
): number | undefined {
  if (lastParkSocPct === undefined || currentSocPct === undefined || lastParkTsMs <= 0) return undefined;
  if (nowMs - lastParkTsMs < 10 * 60_000) return undefined;
  const drop = lastParkSocPct - currentSocPct;
  return drop >= 0.8 && drop <= 35 ? drop : undefined;
}
