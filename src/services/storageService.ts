import {
  AppSettings,
  CalibrationEntry,
  ChargingLogEntry,
  FieldNotePin,
  MaintenanceLogEntry,
  MatrixQueueItem,
  ParkedLocation,
  SavedPlace,
  SohSample,
  SpkluStation,
  TripRecord,
} from '../types/dashboard';

const KEYS = {
  settings: 'ev_dash_settings_v1',
  trips: 'ev_dash_trips_v1',
  places: 'ev_dash_places_v1',
  userSpklu: 'ev_dash_user_spklu_v1',
  fieldNotes: 'ev_dash_field_notes_v1',
  maintLogs: 'ev_dash_maint_logs_v1',
  calibLogs: 'ev_dash_calib_logs_v1',
  matrixQueue: 'ev_dash_matrix_queue_v1',
  parked: 'ev_dash_parked_v1',
  chargingLogs: 'ev_dash_charging_logs_v1',
  sohHistory: 'ev_dash_soh_history_v1',
};

export const defaultSettings: AppSettings = {
  isDarkTheme: true,
  accentId: 'emerald',
  garageStyleId: 'stealth_obsidian',
  riderName: 'Rider EV Nusantara',
  bikeName: 'GESITS G1 Dual-Pack',
  plateNumber: 'B 4567 EV',
  avatarDataUrl: '',
  cockpitLayout: 'complete',
  controllerProtocol: 'motor_mid',
  bmsProtocol: 'jk',
  fardriverPolePairs: 24,
  wheelCircumferenceMm: 1580,
  batteryPriorityId: 'motor',
  b1NominalV: 72.0,
  b1CapacityAh: 20.0,
  b2NominalV: 72.0,
  b2CapacityAh: 24.0,
  invertB2Current: false,
  refWhPerKm: 28.0,
  calFactor: 1.0,
  bikeKg: 94.5,
  riderKg: 70.0,
  loadKg: 5.0,
  iceKmPerLiter: 42.0,
  bbmPricePerLiter: 10000,
  plnPricePerKwh: 1445,
  weeklyGoalKm: 100,
  maintIntervalKm: 2500,
  maintLastOdoKm: 2400,
  odoBackupKm: 3120.5,
  alarmMasterOn: true,
  alarmLowSocPct: 18,
  alarmHighTempC: 55,
  alarmCellDeltaMv: 80,
  alarmOvercurrentA: 70,
  mapStyleId: 'dark',
  dataSaverMap: false,
  voiceNavEnabled: true,
  molisCommunityEnabled: true,
  autoReconnect: false,
  atNavConfig: {
    showRange: true,
    showTrip: true,
    showEnergy: true,
    showEfficiency: true,
    showPower: true,
    showCo2: false,
    showLocation: true,
    showWeather: true,
    intervalSec: 4,
  },
  lastParkTsMs: 0,
};

export const defaultMatrixQueue: MatrixQueueItem[] = [
  { id: 'mx_1', text: 'GESITS EV', enabled: true, speedMs: 45, effectId: 0 },
  { id: 'mx_2', text: 'DUAL PACK 1440+1728 WH', enabled: true, speedMs: 50, effectId: 1 },
  { id: 'mx_3', text: 'RIDE SAFE • ZERO EMISSION', enabled: false, speedMs: 40, effectId: 2 },
];

export const defaultSavedPlaces: SavedPlace[] = [
  {
    id: 'pl_monas',
    name: 'Monas Jakarta Pusat',
    category: 'Favorit',
    lat: -6.175392,
    lng: 106.827153,
    createdAtMs: Date.now() - 86_400_000 * 5,
  },
  {
    id: 'pl_senayan',
    name: 'GBK Senayan',
    category: 'Komunitas',
    lat: -6.218573,
    lng: 106.802483,
    createdAtMs: Date.now() - 86_400_000 * 2,
  },
];

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export const StorageService = {
  loadSettings: (): AppSettings => ({
    ...defaultSettings,
    ...readJson<Partial<AppSettings>>(KEYS.settings, {}),
    atNavConfig: {
      ...defaultSettings.atNavConfig,
      ...(readJson<Partial<AppSettings>>(KEYS.settings, {}).atNavConfig ?? {}),
    },
  }),
  saveSettings: (s: AppSettings) => writeJson(KEYS.settings, s),

  loadTrips: (): TripRecord[] => readJson<TripRecord[]>(KEYS.trips, []),
  saveTrips: (trips: TripRecord[]) => writeJson(KEYS.trips, trips),

  loadPlaces: (): SavedPlace[] => readJson<SavedPlace[]>(KEYS.places, defaultSavedPlaces),
  savePlaces: (places: SavedPlace[]) => writeJson(KEYS.places, places),

  loadUserSpklu: (): SpkluStation[] => readJson<SpkluStation[]>(KEYS.userSpklu, []),
  saveUserSpklu: (stations: SpkluStation[]) => writeJson(KEYS.userSpklu, stations),

  loadFieldNotes: (): FieldNotePin[] => readJson<FieldNotePin[]>(KEYS.fieldNotes, []),
  saveFieldNotes: (notes: FieldNotePin[]) => writeJson(KEYS.fieldNotes, notes),

  loadMaintLogs: (): MaintenanceLogEntry[] => readJson<MaintenanceLogEntry[]>(KEYS.maintLogs, []),
  saveMaintLogs: (logs: MaintenanceLogEntry[]) => writeJson(KEYS.maintLogs, logs),

  loadCalibLogs: (): CalibrationEntry[] => readJson<CalibrationEntry[]>(KEYS.calibLogs, []),
  saveCalibLogs: (logs: CalibrationEntry[]) => writeJson(KEYS.calibLogs, logs),

  loadMatrixQueue: (): MatrixQueueItem[] => readJson<MatrixQueueItem[]>(KEYS.matrixQueue, defaultMatrixQueue),
  saveMatrixQueue: (items: MatrixQueueItem[]) => writeJson(KEYS.matrixQueue, items),

  loadParked: (): ParkedLocation | undefined => readJson<ParkedLocation | undefined>(KEYS.parked, undefined),
  saveParked: (loc?: ParkedLocation) => {
    if (!loc) localStorage.removeItem(KEYS.parked);
    else writeJson(KEYS.parked, loc);
  },

  loadChargingLogs: (): ChargingLogEntry[] => readJson<ChargingLogEntry[]>(KEYS.chargingLogs, []),
  saveChargingLogs: (logs: ChargingLogEntry[]) => writeJson(KEYS.chargingLogs, logs),

  loadSohHistory: (): SohSample[] => readJson<SohSample[]>(KEYS.sohHistory, []),
  saveSohHistory: (samples: SohSample[]) => writeJson(KEYS.sohHistory, samples),
};
