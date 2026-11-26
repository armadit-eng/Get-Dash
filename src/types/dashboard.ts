export type ConnectionStateX = 'DISCONNECTED' | 'SCANNING' | 'CONNECTING' | 'CONNECTED';

export type BatterySourcePriority = 'motor' | 'jikong';

export type ControllerProtocolId = 'motor_mid' | 'fardriver';

export type BmsProtocolId = 'jk' | 'ant' | 'daly' | 'jbd';

export type ChargingIndicatorState = 'Mengisi Daya' | 'Terisi Penuh' | 'Tidak Mengisi' | 'Regeneratif';

export interface DiscoveredDevice {
  name: string;
  address: string;
  isBle: boolean;
  rssi: number;
  isPaired: boolean;
  deviceType: 'motor' | 'jikong' | 'esp1' | 'esp2';
  controllerProtocol?: ControllerProtocolId;
  bmsProtocol?: BmsProtocolId;
}

export interface ErrorDefinition {
  bit: number;
  label: string;
  fix: string;
}

export const kMotorErrorDefs: ErrorDefinition[] = [
  {
    bit: 0,
    label: 'Inverter Over Temperature',
    fix: 'Diamkan motor hingga suhu inverter normal, hindari beban berat terus-menerus.',
  },
  {
    bit: 1,
    label: 'Motor Over Temperature',
    fix: 'Istirahatkan motor sampai suhu turun ke rentang normal.',
  },
  {
    bit: 2,
    label: 'Motor Fault',
    fix: 'Periksa kabel & konektor fasa motor; bawa ke bengkel jika berulang.',
  },
  {
    bit: 3,
    label: 'Hall Sensor Fault',
    fix: 'Cek konektor sensor hall motor, pastikan tidak longgar atau kotor.',
  },
  {
    bit: 4,
    label: 'Throttle Fault',
    fix: 'Periksa posisi & kabel gas (throttle), pastikan kembali ke nol.',
  },
  {
    bit: 5,
    label: 'Controller Fault',
    fix: 'Restart sistem (kontak OFF lalu ON). Jika menetap, cek di bengkel resmi.',
  },
  {
    bit: 6,
    label: 'Over Voltage',
    fix: 'Periksa charger & sumber listrik, pastikan tegangan pack tidak melebihi batas.',
  },
  {
    bit: 7,
    label: 'Under Voltage',
    fix: 'Segera isi daya baterai, tegangan baterai terlalu rendah.',
  },
  {
    bit: 11,
    label: 'Throttle Signal Abnormal',
    fix: 'Cek soket sinyal throttle dan kabel bodi depan.',
  },
];

export interface MotorData {
  sourceProtocol: ControllerProtocolId;
  speedKmh?: number;
  vbat?: number;
  ibat?: number;
  phaseCurrentA?: number;
  throttlePct?: number;
  throttleVoltV?: number;
  socPct?: number;
  sohPct?: number;
  cbatCycles?: number;
  odoKm?: number;
  errMask: number;
  modeIndex?: number;
  isPark?: boolean;
  brakeActive?: boolean;
  tempInverterC?: number;
  tempMotorC?: number;
  tempBatteryC?: number;
  rpm?: number;
  erpm?: number;
  timeStr?: string;
  lastUpdatedMs: number;
}

export interface JkBmsData {
  protocol: BmsProtocolId;
  vpack?: number;
  ibat?: number;
  socPct?: number;
  sohPct?: number;
  temp1C?: number;
  temp2C?: number;
  tempMosC?: number;
  deltaCellV?: number;
  minCellV?: number;
  maxCellV?: number;
  minCellIndex: number;
  maxCellIndex: number;
  cellCount: number;
  cellVoltages: number[];
  cycles?: number;
  remainAh?: number;
  capacityAh?: number;
  balancingActive?: boolean;
  balanceStatus?: number;
  chargeMosOn?: boolean;
  dischargeMosOn?: boolean;
  faultLabels?: string[];
  lastUpdatedMs: number;
}

export interface Battery2Data {
  vbat?: number;
  ibat?: number;
  powerW?: number;
  socPct?: number;
  sohPct?: number;
  tempC?: number;
  deltaCellV?: number;
  cellCount: number;
  cellVoltages: number[];
  cycles?: number;
  remainAh?: number;
  canMode: string;
  simMode?: string;
  lastUpdatedMs: number;
}

export interface Esp32Data {
  speedKmh?: number;
  throttlePct?: number;
  cruiseActive: boolean;
  reverseActive: boolean;
  sideStandDown: boolean;
  modeIndex?: number;
  isPark?: boolean;
  contactOn?: boolean;
  matrixOn?: boolean;
  matrixBusy: boolean;
  musicTrack: number;
  musicState: string;
  musicVol: number;
  lastUpdatedMs: number;
}

export interface LiveTripMetrics {
  startTimeMs: number;
  distanceKm: number;
  energyWh: number;
  consumedAh: number;
  regenWh: number;
  chargeWh: number;
  maxSpeedKmh: number;
  maxPowerW: number;
  maxRegenW: number;
  maxCurrentA: number;
  minVbat?: number;
  maxVbat?: number;
  maxTbatC?: number;
  movingSeconds: number;
  stopCount: number;
  lastSampleMs: number;
  startSocPct?: number;
}

export interface RidingScoreState {
  samples: number;
  ecoViolations: number;
  hardBrakes: number;
  regenEvents: number;
  lastSpeedKmh: number;
}

export interface EffectiveTelemetry {
  speedKmh?: number;
  rpm?: number;
  throttlePct?: number;
  // Strictly isolated Baterai ORI / MID (Motor MID or Fardriver)
  oriActive: boolean;
  oriSourceLabel: string;
  oriSocPct?: number;
  oriVbat?: number;
  oriIbat?: number;
  oriTempC?: number;
  oriSohPct?: number;
  // Strictly isolated External Smart BMS (JK / ANT / DALY / JBD)
  smartBmsActive: boolean;
  smartBmsLabel: string;
  smartBmsSocPct?: number;
  smartBmsVbat?: number;
  smartBmsIbat?: number;
  smartBmsTempC?: number;
  smartBmsSohPct?: number;
  // Primary Pack 1 resolved strictly from chosen priority (never mixed field-by-field)
  b1SocPct?: number;
  b1Vbat?: number;
  b1Ibat?: number;
  b1TempC?: number;
  b1SohPct?: number;
  b1SourceLabel: string;
  b2Active: boolean;
  b2SocPct?: number;
  b2Vbat?: number;
  b2Ibat?: number;
  b2TempC?: number;
  combinedSocPct?: number;
  combinedSohPct?: number;
  combinedPowerW?: number;
  combinedCurrentA?: number;
  avgVoltageV?: number;
  isCharging: boolean;
  isRegen: boolean;
  rangeKm?: number;
  blendedWhPerKm: number;
  totalAvailableWh: number;
  chargeEtaHours?: number;
  odoKm?: number;
  modeLabel: string;
  isPark?: boolean;
  sideStandDown: boolean;
  cruiseActive: boolean;
  reverseActive: boolean;
  activeErrors: ErrorDefinition[];
}

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface AppAlert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  timestampMs: number;
}

export interface TelemetryPoint {
  timestampMs: number;
  speedKmh: number;
  throttlePct: number;
  powerW: number;
  socPct: number;
  voltageV: number;
  currentA: number;
  tempC: number;
  lat?: number;
  lng?: number;
  altM?: number;
}

export interface SerialLogEntry {
  timestampMs: number;
  source: string;
  message: string;
  isError?: boolean;
}

export type HillGrade = 'FLAT' | 'UPHILL_MILD' | 'UPHILL_STEEP' | 'DOWNHILL';

export interface MapStyleOption {
  id: string;
  label: string;
  tileUrlTemplate: string;
  isDarkBase: boolean;
  attribution: string;
}

export const kMapStyles: MapStyleOption[] = [
  {
    id: 'dark',
    label: 'Carto Dark Matter',
    tileUrlTemplate: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    isDarkBase: true,
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
  {
    id: 'osm',
    label: 'OSM Standar',
    tileUrlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    isDarkBase: false,
    attribution: '&copy; OpenStreetMap contributors',
  },
  {
    id: 'osm_hot',
    label: 'OSM Humanitarian',
    tileUrlTemplate: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    isDarkBase: false,
    attribution: '&copy; OpenStreetMap, HOT',
  },
  {
    id: 'carto_voyager',
    label: 'Carto Voyager',
    tileUrlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    isDarkBase: false,
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
  {
    id: 'carto_positron',
    label: 'Carto Positron',
    tileUrlTemplate: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    isDarkBase: false,
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
  {
    id: 'sat',
    label: 'Satelit Esri',
    tileUrlTemplate: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    isDarkBase: true,
    attribution: '&copy; Esri World Imagery',
  },
  {
    id: 'topo',
    label: 'Topografi',
    tileUrlTemplate: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    isDarkBase: false,
    attribution: '&copy; OpenTopoMap',
  },
];

export interface GeoPoint {
  lat: number;
  lng: number;
  altM?: number;
}

export interface GpsState {
  location?: GeoPoint;
  speedKmh?: number;
  headingDeg?: number;
  accuracyM?: number;
  roadName: string;
  areaName: string;
  isFromCache: boolean;
}

export interface RouteStep {
  instruction: string;
  roadName: string;
  distanceM: number;
  durationSec: number;
  maneuverType: string;
  modifier?: string;
  location: GeoPoint;
}

export interface ElevationSample {
  distanceKm: number;
  elevationM: number;
  gradePct: number;
  gradeType: HillGrade;
  point: GeoPoint;
}

export interface RouteEnergyEstimate {
  totalWh: number;
  regenWh: number;
  netWh: number;
  whPerKm: number;
  socUsedPct: number;
  socAtArrivalPct?: number;
  maxClimbPct: number;
  totalAscentM: number;
  totalDescentM: number;
}

export interface HillSegment {
  id: number;
  isUphill: boolean;
  startDistM: number;
  endDistM: number;
  lengthM: number;
  gainM: number;
  avgGradePct: number;
  maxGradePct: number;
  dWh: number;
  socPct?: number;
  notable: boolean;
  steep: boolean;
}

export interface NavRoute {
  geometry: GeoPoint[];
  steps: RouteStep[];
  distanceM: number;
  durationSec: number;
  elevationSamples: ElevationSample[];
  energyEstimate?: RouteEnergyEstimate;
  hillSegments: HillSegment[];
}

export interface PlannedStop {
  id: string;
  label: string;
  lat: number;
  lng: number;
  isSpklu?: boolean;
}

export interface SavedPlace {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  createdAtMs: number;
}

export interface SpkluStation {
  id: string;
  name: string;
  operatorName: string;
  lat: number;
  lng: number;
  socketType: string;
  powerKw?: number | null;
  isUserAdded?: boolean;
  distanceKm?: number | null;
  notes?: string;
  sourceLabel?: string;
  isMolisFriendly?: boolean;
}

export interface FieldNotePin {
  id: string;
  name: string;
  category: string;
  note: string;
  lat: number;
  lng: number;
  timestampMs: number;
}

export interface WeatherData {
  tempC: number;
  feelsLikeC: number;
  humidityPct: number;
  windKmh: number;
  rainProbPct: number;
  uvIndex?: number;
  weatherCode: number;
  description: string;
  moodTag: string;
  sunrise: string;
  sunset: string;
  fetchedAtMs: number;
}

export interface AtNavSlotConfig {
  showRange: boolean;
  showTrip: boolean;
  showEnergy: boolean;
  showEfficiency: boolean;
  showPower: boolean;
  showCo2: boolean;
  showLocation: boolean;
  showWeather: boolean;
  intervalSec: number;
}

export interface MatrixQueueItem {
  id: string;
  text: string;
  enabled: boolean;
  speedMs: number;
  effectId: number;
}

export interface TripRecord {
  id: string;
  startTimeMs: number;
  endTimeMs: number;
  distanceKm: number;
  energyWh: number;
  regenWh: number;
  whPerKm: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  maxPowerW: number;
  ridingScore?: number;
  startArea: string;
  endArea: string;
  pathPoints: GeoPoint[];
}

export interface MaintenanceLogEntry {
  id: string;
  odoKm: number;
  category: string;
  notes: string;
  costRp: number;
  timestampMs: number;
}

export interface CalibrationEntry {
  id: string;
  factor: number;
  note: string;
  timestampMs: number;
}

export interface ChargingLogEntry {
  id: string;
  startTimeMs: number;
  endTimeMs: number;
  startSocPct: number;
  endSocPct: number;
  energyWh: number;
  costRp: number;
}

export interface SohSample {
  timestampMs: number;
  sohPct: number;
  source: string;
}

export interface ParkedLocation {
  lat: number;
  lng: number;
  timestampMs: number;
  note?: string;
}

export interface AppSettings {
  isDarkTheme: boolean;
  accentId: string;
  garageStyleId: string;
  riderName: string;
  bikeName: string;
  plateNumber: string;
  avatarDataUrl: string;
  cockpitLayout: 'compact' | 'complete';
  controllerProtocol: ControllerProtocolId;
  bmsProtocol: BmsProtocolId;
  fardriverPolePairs: number;
  wheelCircumferenceMm: number;
  batteryPriorityId: BatterySourcePriority;
  b1NominalV: number;
  b1CapacityAh: number;
  b2NominalV: number;
  b2CapacityAh: number;
  invertB2Current: boolean;
  refWhPerKm: number;
  calFactor: number;
  bikeKg: number;
  riderKg: number;
  loadKg: number;
  iceKmPerLiter: number;
  bbmPricePerLiter: number;
  plnPricePerKwh: number;
  weeklyGoalKm: number;
  maintIntervalKm: number;
  maintLastOdoKm: number;
  odoBackupKm: number;
  alarmMasterOn: boolean;
  alarmLowSocPct: number;
  alarmHighTempC: number;
  alarmCellDeltaMv: number;
  alarmOvercurrentA: number;
  mapStyleId: string;
  dataSaverMap: boolean;
  voiceNavEnabled: boolean;
  molisCommunityEnabled: boolean;
  autoReconnect: boolean;
  atNavConfig: AtNavSlotConfig;
  lastParkSocPct?: number;
  lastParkTsMs: number;
}

export interface RiderBadge {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
}

export interface FuelSavingsSummary {
  totalKm: number;
  totalKwhUsed: number;
  plnCostRp: number;
  bbmCostRp: number;
  netSavingsRp: number;
  co2SavedKg: number;
}

export interface MaintenanceStatus {
  currentOdoKm: number;
  nextServiceKm: number;
  remainingKm: number;
  progressPct: number;
  level: 'OK' | 'SOON' | 'OVERDUE';
}

export interface PersonalRecords {
  maxSpeedKmh: number;
  longestTripKm: number;
  bestEfficiencyWhKm?: number;
  bestScore?: number;
  mostRegenWh: number;
}

export interface EfficiencyTrend {
  recentAvgWhKm: number;
  prevAvgWhKm: number;
  deltaPct: number;
}

export interface DailyChallenge {
  title: string;
  description: string;
  progress: number;
  completed: boolean;
}
