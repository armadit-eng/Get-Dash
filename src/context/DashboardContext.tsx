import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  computeBadges,
  computeDailyChallenge,
  computeEffective,
  computeEfficiencyTrend,
  computeFuelSavings,
  computeMaintenanceStatus,
  computePersonalRecords,
  evaluateAlarms,
  getChargingIndicator,
  integrateSample,
  parseMotorAtLine,
} from '../engine/telemetryEngine';
import {
  detectAndParseBmsFrame,
  parseFardriverFrame,
  parseHexStringToBytes,
} from '../engine/protocolParsers';
import { distanceToPolylineM, haversineKm } from '../engine/routePhysics';
import { bluetoothTransport } from '../services/bluetoothTransport';
import { RemoteApisService } from '../services/remoteApis';
import { StorageService } from '../services/storageService';
import { getCockpitColors, CockpitColors } from '../theme/cockpitTheme';
import {
  AppAlert,
  AppSettings,
  Battery2Data,
  CalibrationEntry,
  ChargingIndicatorState,
  ChargingLogEntry,
  ConnectionStateX,
  DailyChallenge,
  DiscoveredDevice,
  EffectiveTelemetry,
  EfficiencyTrend,
  Esp32Data,
  FieldNotePin,
  FuelSavingsSummary,
  GeoPoint,
  GpsState,
  JkBmsData,
  LiveTripMetrics,
  MaintenanceLogEntry,
  MaintenanceStatus,
  MatrixQueueItem,
  MotorData,
  NavRoute,
  ParkedLocation,
  PersonalRecords,
  PlannedStop,
  RiderBadge,
  RidingScoreState,
  SavedPlace,
  SerialLogEntry,
  SohSample,
  SpkluStation,
  TelemetryPoint,
  TripRecord,
  WeatherData,
} from '../types/dashboard';

interface DashboardContextValue {
  settings: AppSettings;
  colors: CockpitColors;
  motorConnState: ConnectionStateX;
  motorConnName: string;
  jkConnState: ConnectionStateX;
  jkConnName: string;
  esp1ConnState: ConnectionStateX;
  esp1ConnName: string;
  esp2ConnState: ConnectionStateX;
  esp2ConnName: string;
  motorData: MotorData;
  jkData: JkBmsData;
  battery2Data: Battery2Data;
  esp1Data: Esp32Data;
  effective: EffectiveTelemetry;
  chargeState: ChargingIndicatorState;
  liveTrip: LiveTripMetrics;
  ridingScore: RidingScoreState;
  telemetryHistory: TelemetryPoint[];
  serialLogs: SerialLogEntry[];
  activeAlerts: AppAlert[];
  gpsState: GpsState;
  weather?: WeatherData;
  parkedLocation?: ParkedLocation;
  tripHistory: TripRecord[];
  savedPlaces: SavedPlace[];
  nearbySpklu: SpkluStation[];
  userSpklu: SpkluStation[];
  fieldNotes: FieldNotePin[];
  maintLogs: MaintenanceLogEntry[];
  calibLogs: CalibrationEntry[];
  chargingLogs: ChargingLogEntry[];
  sohHistory: SohSample[];
  matrixQueue: MatrixQueueItem[];
  matrixAutoRotate: boolean;
  plannedStops: PlannedStop[];
  activeRoute?: NavRoute;
  isLoadingRoute: boolean;
  isNavigating: boolean;
  activeStepIndex: number;
  distToNextStepM: number;
  remainingDistKm: number;
  etaMin: number;
  devSimActive: boolean;
  midStreaming: boolean;
  mapsFramesSent: number;
  lastMidFramePreview: string;
  discoveredDevices: DiscoveredDevice[];
  isScanningBle: boolean;
  scanError: string;
  badges: RiderBadge[];
  fuelSavings: FuelSavingsSummary;
  maintStatus: MaintenanceStatus;
  personalRecords: PersonalRecords;
  efficiencyTrend?: EfficiencyTrend;
  dailyChallenge: DailyChallenge;

  updateSettings: (next: AppSettings) => void;
  toggleDevSim: (enable: boolean) => void;
  scanDevices: () => Promise<void>;
  connectWebSerialMotor: () => Promise<void>;
  assignDiscoveredDeviceRole: (
    address: string,
    patch: Partial<Pick<DiscoveredDevice, 'deviceType' | 'controllerProtocol' | 'bmsProtocol'>>
  ) => void;
  connectDevice: (device: DiscoveredDevice) => Promise<void>;
  disconnectDevice: (type: DiscoveredDevice['deviceType']) => Promise<void>;
  injectMotorAtCommand: (line: string) => void;
  injectProtocolHexFrame: (hex: string, target: 'controller' | 'bms') => boolean;
  clearSerialLogs: () => void;
  saveLiveTrip: () => void;
  resetLiveTrip: () => void;
  deleteTrip: (id: string) => void;
  parkHere: () => void;
  clearParkPin: () => void;
  refreshWeatherAndGeo: () => Promise<void>;
  refreshNearbySpklu: () => Promise<void>;
  addStopAndRoute: (stop: PlannedStop) => Promise<void>;
  removeStopAndRoute: (id: string) => Promise<void>;
  clearRoute: () => void;
  startNavigation: () => void;
  stopNavigation: () => void;
  toggleMidStreaming: (enable: boolean) => void;
  addSavedPlace: (place: SavedPlace) => void;
  deleteSavedPlace: (id: string) => void;
  addUserSpklu: (station: SpkluStation) => void;
  addFieldNote: (note: Omit<FieldNotePin, 'id' | 'timestampMs'>) => void;
  deleteFieldNote: (id: string) => void;
  addMaintLog: (entry: Omit<MaintenanceLogEntry, 'id' | 'timestampMs'>) => void;
  addCalibrationLog: (factor: number, note: string) => void;
  setEsp1Control: (patch: Partial<Esp32Data>) => void;
  addMatrixItem: (text: string, speedMs?: number, effectId?: number) => void;
  toggleMatrixItem: (id: string) => void;
  deleteMatrixItem: (id: string) => void;
  setMatrixAutoRotate: (on: boolean) => void;
  restoreMotorOdo: (odoKm: number) => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

const DEFAULT_JAKARTA: GeoPoint = { lat: -6.175392, lng: 106.827153, altM: 12 };

const INITIAL_LIVE_TRIP: LiveTripMetrics = {
  startTimeMs: 0,
  distanceKm: 0,
  energyWh: 0,
  consumedAh: 0,
  regenWh: 0,
  chargeWh: 0,
  maxSpeedKmh: 0,
  maxPowerW: 0,
  maxRegenW: 0,
  maxCurrentA: 0,
  movingSeconds: 0,
  stopCount: 0,
  lastSampleMs: 0,
};

const INITIAL_SCORE: RidingScoreState = {
  samples: 0,
  ecoViolations: 0,
  hardBrakes: 0,
  regenEvents: 0,
  lastSpeedKmh: 0,
};

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => StorageService.loadSettings());
  const [motorConnState, setMotorConnState] = useState<ConnectionStateX>('DISCONNECTED');
  const [motorConnName, setMotorConnName] = useState('');
  const [jkConnState, setJkConnState] = useState<ConnectionStateX>('DISCONNECTED');
  const [jkConnName, setJkConnName] = useState('');
  const [esp1ConnState, setEsp1ConnState] = useState<ConnectionStateX>('DISCONNECTED');
  const [esp1ConnName, setEsp1ConnName] = useState('');
  const [esp2ConnState, setEsp2ConnState] = useState<ConnectionStateX>('DISCONNECTED');
  const [esp2ConnName, setEsp2ConnName] = useState('');

  const [motorData, setMotorData] = useState<MotorData>(() => ({
    sourceProtocol: StorageService.loadSettings().controllerProtocol,
    errMask: 0,
    lastUpdatedMs: 0,
  }));
  const [jkData, setJkData] = useState<JkBmsData>(() => ({
    protocol: StorageService.loadSettings().bmsProtocol,
    minCellIndex: -1,
    maxCellIndex: -1,
    cellCount: 0,
    cellVoltages: [],
    lastUpdatedMs: 0,
  }));
  const [battery2Data, setBattery2Data] = useState<Battery2Data>({
    cellCount: 0,
    cellVoltages: [],
    canMode: 'LISTEN',
    lastUpdatedMs: 0,
  });
  const [esp1Data, setEsp1Data] = useState<Esp32Data>({
    cruiseActive: false,
    reverseActive: false,
    sideStandDown: false,
    matrixBusy: false,
    musicTrack: 1,
    musicState: 'STOP',
    musicVol: 20,
    lastUpdatedMs: 0,
  });

  const [liveTrip, setLiveTrip] = useState<LiveTripMetrics>(INITIAL_LIVE_TRIP);
  const [ridingScore, setRidingScore] = useState<RidingScoreState>(INITIAL_SCORE);
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryPoint[]>([]);
  const [serialLogs, setSerialLogs] = useState<SerialLogEntry[]>([]);

  const [gpsState, setGpsState] = useState<GpsState>({
    location: DEFAULT_JAKARTA,
    roadName: 'Jl. Medan Merdeka Utara',
    areaName: 'Jakarta Pusat',
    isFromCache: true,
  });
  const [weather, setWeather] = useState<WeatherData | undefined>();
  const [parkedLocation, setParkedLocation] = useState<ParkedLocation | undefined>(() =>
    StorageService.loadParked()
  );

  const [tripHistory, setTripHistory] = useState<TripRecord[]>(() => StorageService.loadTrips());
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(() => StorageService.loadPlaces());
  const [nearbySpklu, setNearbySpklu] = useState<SpkluStation[]>([]);
  const [userSpklu, setUserSpklu] = useState<SpkluStation[]>(() => StorageService.loadUserSpklu());
  const [fieldNotes, setFieldNotes] = useState<FieldNotePin[]>(() => StorageService.loadFieldNotes());
  const [maintLogs, setMaintLogs] = useState<MaintenanceLogEntry[]>(() => StorageService.loadMaintLogs());
  const [calibLogs, setCalibLogs] = useState<CalibrationEntry[]>(() => StorageService.loadCalibLogs());
  const [chargingLogs] = useState<ChargingLogEntry[]>(() => StorageService.loadChargingLogs());
  const [sohHistory] = useState<SohSample[]>(() => StorageService.loadSohHistory());
  const [matrixQueue, setMatrixQueue] = useState<MatrixQueueItem[]>(() => StorageService.loadMatrixQueue());
  const [matrixAutoRotate, setMatrixAutoRotate] = useState(false);

  const [plannedStops, setPlannedStops] = useState<PlannedStop[]>([]);
  const [activeRoute, setActiveRoute] = useState<NavRoute | undefined>();
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [distToNextStepM, setDistToNextStepM] = useState(0);
  const [remainingDistKm, setRemainingDistKm] = useState(0);
  const [etaMin, setEtaMin] = useState(0);

  const [devSimActive, setDevSimActive] = useState(false);
  const [midStreaming, setMidStreaming] = useState(false);
  const [mapsFramesSent, setMapsFramesSent] = useState(0);
  const [lastMidFramePreview, setLastMidFramePreview] = useState('');
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [isScanningBle, setIsScanningBle] = useState(false);
  const [scanError, setScanError] = useState('');

  const livePathPointsRef = useRef<GeoPoint[]>([]);
  const wasMovingRef = useRef(false);
  const simStepRef = useRef(0);
  const lastSpokenStepRef = useRef(-1);

  const colors = useMemo(
    () => getCockpitColors(settings.isDarkTheme, settings.accentId),
    [settings.isDarkTheme, settings.accentId]
  );

  const addLog = useCallback((source: string, message: string, isError = false) => {
    setSerialLogs((prev) => [{ timestampMs: Date.now(), source, message, isError }, ...prev].slice(0, 150));
  }, []);

  const updateSettings = useCallback((next: AppSettings) => {
    setSettings(next);
    StorageService.saveSettings(next);
  }, []);

  const effective = useMemo(
    () =>
      computeEffective({
        motor: motorData,
        motorState: motorConnState,
        jk: jkData,
        jkState: jkConnState,
        esp1: esp1Data,
        esp1State: esp1ConnState,
        b2: battery2Data,
        esp2State: esp2ConnState,
        gpsSpeedKmh: gpsState.speedKmh,
        trip: liveTrip,
        settings,
      }),
    [
      motorData,
      motorConnState,
      jkData,
      jkConnState,
      esp1Data,
      esp1ConnState,
      battery2Data,
      esp2ConnState,
      gpsState.speedKmh,
      liveTrip,
      settings,
    ]
  );

  const chargeState = useMemo(() => getChargingIndicator(effective), [effective]);
  const activeAlerts = useMemo(
    () => evaluateAlarms(effective, jkData, battery2Data, settings),
    [effective, jkData, battery2Data, settings]
  );

  const badges = useMemo(
    () => computeBadges(tripHistory, liveTrip, ridingScore),
    [tripHistory, liveTrip, ridingScore]
  );
  const fuelSavings = useMemo(
    () => computeFuelSavings(tripHistory, liveTrip, settings),
    [tripHistory, liveTrip, settings]
  );
  const maintStatus = useMemo(
    () => computeMaintenanceStatus(effective.odoKm ?? settings.odoBackupKm, settings),
    [effective.odoKm, settings]
  );
  const personalRecords = useMemo(
    () => computePersonalRecords(tripHistory, liveTrip, ridingScore),
    [tripHistory, liveTrip, ridingScore]
  );
  const efficiencyTrend = useMemo(() => computeEfficiencyTrend(tripHistory), [tripHistory]);
  const dailyChallenge = useMemo(() => computeDailyChallenge(tripHistory), [tripHistory]);

  const refreshWeatherAndGeo = useCallback(async () => {
    const loc = gpsState.location ?? DEFAULT_JAKARTA;
    const [w, geo] = await Promise.all([
      RemoteApisService.fetchWeather(loc.lat, loc.lng),
      RemoteApisService.reverseGeocode(loc.lat, loc.lng),
    ]);
    if (w) setWeather(w);
    if (geo) {
      setGpsState((prev) => ({
        ...prev,
        roadName: geo.road || prev.roadName,
        areaName: geo.area || prev.areaName,
        isFromCache: false,
      }));
    }
  }, [gpsState.location]);

  const refreshNearbySpklu = useCallback(async () => {
    const loc = gpsState.location ?? DEFAULT_JAKARTA;
    const list = await RemoteApisService.fetchNearbySpklu(loc, settings.molisCommunityEnabled);
    setNearbySpklu(list);
  }, [gpsState.location, settings.molisCommunityEnabled]);

  // Initial geolocation, weather, and Molis SPKLU load
  useEffect(() => {
    refreshWeatherAndGeo();
    refreshNearbySpklu();

    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsState((prev) => ({
            ...prev,
            location: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              altM: pos.coords.altitude ?? undefined,
            },
            speedKmh:
              pos.coords.speed !== null && pos.coords.speed >= 0
                ? pos.coords.speed * 3.6
                : prev.speedKmh,
            headingDeg: pos.coords.heading ?? prev.headingDeg,
            accuracyM: pos.coords.accuracy,
            isFromCache: false,
          }));
        },
        () => {
          // Keep fallback coordinates quietly
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // DEV-SIM MOTOR 500ms generator
  useEffect(() => {
    if (!devSimActive) return;
    const timer = setInterval(() => {
      simStepRef.current += 1;
      const step = simStepRef.current;
      const now = Date.now();
      const spd = Math.min(78, Math.max(0, 36 + 24 * Math.sin(step * 0.14)));
      const ibat1 = spd > 45 ? -21.5 : spd < 14 ? 3.8 : -10.4;
      const ibat2 = spd > 45 ? -14.2 : spd < 14 ? 2.4 : -7.1;
      const vbat1 = 74.6 + (ibat1 > 0 ? 1.0 : ibat1 * 0.045);
      const vbat2 = 75.1 + (ibat2 > 0 ? 0.9 : ibat2 * 0.04);
      const soc1 = Math.max(12, 84 - (step * 0.025) % 45);
      const soc2 = Math.max(15, 88 - (step * 0.021) % 42);

      const cells1 = Array.from({ length: 20 }, (_, i) =>
        Number((vbat1 / 20 + Math.sin(step * 0.2 + i) * 0.012 + (i === 7 ? -0.018 : 0)).toFixed(3))
      );
      const minC1 = Math.min(...cells1);
      const maxC1 = Math.max(...cells1);
      const cells2 = Array.from({ length: 20 }, (_, i) =>
        Number((vbat2 / 20 + Math.cos(step * 0.15 + i) * 0.009).toFixed(3))
      );

      const isFardriver = settings.controllerProtocol === 'fardriver';
      const activeBmsProto = settings.bmsProtocol;
      const socOri = Math.max(12, 84 - (step * 0.025) % 45);
      const socBms = Math.max(12, 82 - (step * 0.024) % 44);
      const erpm = Math.round(spd * 51.45 * (settings.fardriverPolePairs / 24));
      const phaseA = Math.abs(ibat1) * 2.65;

      setMotorData((prev) => ({
        ...prev,
        sourceProtocol: settings.controllerProtocol,
        speedKmh: spd,
        vbat: vbat1,
        ibat: ibat1,
        phaseCurrentA: isFardriver ? Number(phaseA.toFixed(1)) : undefined,
        throttlePct: spd > 14 ? Math.min(100, spd * 1.15) : 0,
        throttleVoltV: isFardriver ? Number((0.85 + (spd / 78) * 3.1).toFixed(2)) : undefined,
        socPct: socOri,
        sohPct: 95,
        cbatCycles: 52,
        odoKm: Number((3120.5 + step * 0.005).toFixed(2)),
        modeIndex: spd > 52 ? 2 : spd > 28 ? 1 : 0,
        isPark: spd < 0.5,
        brakeActive: ibat1 > 0,
        tempInverterC: 42 + Math.sin(step * 0.08) * 4,
        tempMotorC: 49 + Math.sin(step * 0.06) * 5,
        tempBatteryC: 34.5 + Math.sin(step * 0.05) * 1.8,
        rpm: Math.round(spd * 51.45),
        erpm: isFardriver ? erpm : undefined,
        lastUpdatedMs: now,
      }));

      setJkData({
        protocol: activeBmsProto,
        vpack: Number((vbat1 + 0.15).toFixed(2)),
        ibat: Number((ibat1 * 0.98).toFixed(2)),
        socPct: socBms,
        sohPct: 97,
        temp1C: 33.8,
        temp2C: 34.6,
        tempMosC: 38.2,
        deltaCellV: Number((maxC1 - minC1).toFixed(3)),
        minCellV: minC1,
        maxCellV: maxC1,
        minCellIndex: cells1.indexOf(minC1),
        maxCellIndex: cells1.indexOf(maxC1),
        cellCount: 20,
        cellVoltages: cells1,
        cycles: 48,
        remainAh: Number(((settings.b1CapacityAh * socBms) / 100).toFixed(2)),
        capacityAh: settings.b1CapacityAh,
        balancingActive: maxC1 - minC1 > 0.015,
        balanceStatus: 1,
        chargeMosOn: true,
        dischargeMosOn: true,
        lastUpdatedMs: now,
      });

      setBattery2Data({
        vbat: vbat2,
        ibat: ibat2,
        powerW: -(vbat2 * ibat2),
        socPct: soc2,
        sohPct: 98,
        tempC: 32.4,
        deltaCellV: Number((Math.max(...cells2) - Math.min(...cells2)).toFixed(3)),
        cellCount: 20,
        cellVoltages: cells2,
        cycles: 31,
        remainAh: Number(((24 * soc2) / 100).toFixed(2)),
        canMode: 'CAN-ACTIVE',
        simMode: 'LIVE',
        lastUpdatedMs: now,
      });

      setEsp1Data((prev) => ({
        ...prev,
        speedKmh: spd,
        cruiseActive: spd > 46,
        contactOn: true,
        sideStandDown: false,
        modeIndex: spd > 52 ? 2 : spd > 28 ? 1 : 0,
        isPark: false,
        lastUpdatedMs: now,
      }));

      if (step % 4 === 0) {
        addLog(
          isFardriver ? 'FARDRIVER' : 'MID-AT',
          isFardriver
            ? `AA 13 SPD=${spd.toFixed(1)} ERPM=${erpm} I_LINE=${Math.abs(ibat1).toFixed(1)}A I_PHASE=${phaseA.toFixed(0)}A`
            : `AT+SPD=${spd.toFixed(1)} VBAT=${vbat1.toFixed(1)} IBAT=${ibat1.toFixed(1)}`
        );
      }
    }, 500);
    return () => clearInterval(timer);
  }, [devSimActive, settings.controllerProtocol, settings.bmsProtocol, settings.fardriverPolePairs, settings.b1CapacityAh, addLog]);

  // 1 Hz Telemetry Integrator + Navigation Progression + AT+MAPS Frame Stream
  const latestRef = useRef({
    effective,
    liveTrip,
    ridingScore,
    gpsState,
    activeRoute,
    isNavigating,
    activeStepIndex,
    midStreaming,
    settings,
    motorConnState,
    jkConnState,
    esp2ConnState,
    devSimActive,
  });
  latestRef.current = {
    effective,
    liveTrip,
    ridingScore,
    gpsState,
    activeRoute,
    isNavigating,
    activeStepIndex,
    midStreaming,
    settings,
    motorConnState,
    jkConnState,
    esp2ConnState,
    devSimActive,
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const cur = latestRef.current;
      const now = Date.now();
      const hasLive =
        cur.motorConnState === 'CONNECTED' ||
        cur.jkConnState === 'CONNECTED' ||
        cur.esp2ConnState === 'CONNECTED' ||
        cur.devSimActive ||
        (cur.gpsState.speedKmh ?? 0) > 2;

      if (hasLive) {
        const res = integrateSample(
          cur.liveTrip,
          cur.ridingScore,
          cur.effective,
          now,
          wasMovingRef.current
        );
        wasMovingRef.current = res.wasMoving;
        setLiveTrip(res.trip);
        setRidingScore(res.score);

        if (cur.gpsState.location) {
          const pts = livePathPointsRef.current;
          const last = pts[pts.length - 1];
          if (!last || haversineKm(last, cur.gpsState.location) > 0.015) {
            pts.push(cur.gpsState.location);
          }
        }

        const pt: TelemetryPoint = {
          timestampMs: now,
          speedKmh: cur.effective.speedKmh ?? 0,
          throttlePct: cur.effective.throttlePct ?? 0,
          powerW: cur.effective.combinedPowerW ?? 0,
          socPct: cur.effective.combinedSocPct ?? 0,
          voltageV: cur.effective.avgVoltageV ?? 0,
          currentA: cur.effective.combinedCurrentA ?? 0,
          tempC: cur.effective.b1TempC ?? cur.effective.b2TempC ?? 0,
          lat: cur.gpsState.location?.lat,
          lng: cur.gpsState.location?.lng,
          altM: cur.gpsState.location?.altM,
        };
        setTelemetryHistory((prev) => [...prev.slice(-239), pt]);
      }

      // Navigation progression
      if (cur.isNavigating && cur.activeRoute && cur.gpsState.location) {
        const steps = cur.activeRoute.steps;
        let idx = cur.activeStepIndex;
        if (idx < steps.length) {
          const dNextM = haversineKm(cur.gpsState.location, steps[idx].location) * 1000;
          setDistToNextStepM(dNextM);
          if (dNextM < 35 && idx < steps.length - 1) {
            idx += 1;
            setActiveStepIndex(idx);
          }
          if (cur.settings.voiceNavEnabled && lastSpokenStepRef.current !== idx && 'speechSynthesis' in window) {
            lastSpokenStepRef.current = idx;
            try {
              const utter = new SpeechSynthesisUtterance(
                `Dalam ${Math.round(dNextM)} meter, ${steps[idx].instruction}`
              );
              utter.lang = 'id-ID';
              window.speechSynthesis.speak(utter);
            } catch {
              // ignore speech synthesis blocked
            }
          }
        }
        const remM = distanceToPolylineM(cur.gpsState.location, cur.activeRoute.geometry);
        const totalKm = Math.max(0.1, cur.activeRoute.distanceM / 1000 - remM / 1000);
        setRemainingDistKm(totalKm);
        setEtaMin((totalKm / Math.max(18, cur.effective.speedKmh ?? 32)) * 60);
      }

      // AT+MAPS / AT+NAV MID frame preview
      if (cur.midStreaming) {
        const step = cur.activeRoute?.steps?.[cur.activeStepIndex];
        const frame = step
          ? `AT+NAV="${step.instruction.slice(0, 26)}|${Math.round(distToNextStepM)}m|SOC:${Math.round(
              cur.effective.combinedSocPct ?? 0
            )}%|RNG:${Math.round(cur.effective.rangeKm ?? 0)}km"`
          : `AT+NAV="SPD:${Math.round(cur.effective.speedKmh ?? 0)}kmh|PWR:${Math.round(
              cur.effective.combinedPowerW ?? 0
            )}W|SOC:${Math.round(cur.effective.combinedSocPct ?? 0)}%"`;
        setMapsFramesSent((c) => c + 1);
        setLastMidFramePreview(frame);
        if (cur.motorConnState === 'CONNECTED' && !cur.devSimActive) {
          void bluetoothTransport.sendTextCommand('motor', frame);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [distToNextStepM]);

  const toggleDevSim = useCallback(
    (enable: boolean) => {
      setDevSimActive(enable);
      if (enable) {
        const ctrlName =
          settings.controllerProtocol === 'fardriver' ? 'DEV-SIM FARDRIVER' : 'DEV-SIM MOTOR';
        const bmsName = `DEV-SIM ${settings.bmsProtocol.toUpperCase()}-BMS 20S`;
        setMotorConnState('CONNECTED');
        setMotorConnName(ctrlName);
        setJkConnState('CONNECTED');
        setJkConnName(bmsName);
        setEsp1ConnState('CONNECTED');
        setEsp1ConnName('DEV-SIM ESP32 #1');
        setEsp2ConnState('CONNECTED');
        setEsp2ConnName('DEV-SIM ESP32 #2');
        addLog('SYSTEM', `Simulasi Telemetri Dev (${ctrlName} + ${bmsName}) diaktifkan.`);
      } else {
        if (motorConnName.startsWith('DEV-SIM')) {
          setMotorConnState('DISCONNECTED');
          setMotorConnName('');
        }
        if (jkConnName.startsWith('DEV-SIM')) {
          setJkConnState('DISCONNECTED');
          setJkConnName('');
        }
        if (esp1ConnName.startsWith('DEV-SIM')) {
          setEsp1ConnState('DISCONNECTED');
          setEsp1ConnName('');
        }
        if (esp2ConnName.startsWith('DEV-SIM')) {
          setEsp2ConnState('DISCONNECTED');
          setEsp2ConnName('');
        }
        addLog('SYSTEM', 'Simulasi Telemetri Dev dimatikan.');
      }
    },
    [
      settings.controllerProtocol,
      settings.bmsProtocol,
      motorConnName,
      jkConnName,
      esp1ConnName,
      esp2ConnName,
      addLog,
    ]
  );

  const scanDevices = useCallback(async () => {
    setIsScanningBle(true);
    setScanError('');
    const result = await bluetoothTransport.scanRealDevices(
      settings.controllerProtocol,
      settings.bmsProtocol,
      (liveList) => setDiscoveredDevices(liveList),
      addLog
    );
    setDiscoveredDevices(result.devices);
    if (result.error) {
      setScanError(result.error);
    } else if (result.devices.length === 0) {
      setScanError(
        'Tidak ada perangkat Bluetooth ditemukan. Pastikan Bluetooth HP aktif dan modul Motor/BMS sudah menyala atau ter-pair di Pengaturan Bluetooth HP.'
      );
    }
    setIsScanningBle(false);
  }, [addLog, settings.bmsProtocol, settings.controllerProtocol]);

  const assignDiscoveredDeviceRole = useCallback(
    (
      address: string,
      patch: Partial<Pick<DiscoveredDevice, 'deviceType' | 'controllerProtocol' | 'bmsProtocol'>>
    ) => {
      setDiscoveredDevices((prev) =>
        prev.map((d) => (d.address === address ? { ...d, ...patch } : d))
      );
    },
    []
  );

  const handleIncomingTransportLine = useCallback(
    (deviceType: DiscoveredDevice['deviceType'], line: string) => {
      const now = Date.now();
      addLog(deviceType.toUpperCase(), line);

      if (deviceType === 'motor') {
        setMotorData((prev) => {
          const parsed = parseMotorAtLine(
            line,
            { ...prev, sourceProtocol: 'motor_mid' },
            now,
            (odo) => updateSettings({ ...latestRef.current.settings, odoBackupKm: odo }),
            (msg) => addLog('ODO-GUARD', msg, true)
          );
          return parsed ?? { ...prev, sourceProtocol: 'motor_mid', lastUpdatedMs: now };
        });
        return;
      }

      if (deviceType === 'esp1') {
        setEsp1Data((prev) => {
          const next = { ...prev, lastUpdatedMs: now };
          const pairs = line.split(/[,\s]+/);
          for (const p of pairs) {
            const [kRaw, vRaw] = p.split('=');
            if (!kRaw || vRaw === undefined) continue;
            const k = kRaw.toUpperCase();
            const vNum = Number(vRaw);
            if (k === 'SPD' && !Number.isNaN(vNum)) next.speedKmh = vNum;
            else if (k === 'THR' && !Number.isNaN(vNum)) next.throttlePct = vNum;
            else if (k === 'CRUISE') next.cruiseActive = vRaw === '1' || vRaw.toUpperCase() === 'ON';
            else if (k === 'REV') next.reverseActive = vRaw === '1' || vRaw.toUpperCase() === 'ON';
            else if (k === 'STAND') next.sideStandDown = vRaw === '1' || vRaw.toUpperCase() === 'DOWN';
            else if (k === 'CONTACT' || k === 'RELAY') next.contactOn = vRaw === '1' || vRaw.toUpperCase() === 'ON';
            else if (k === 'MODE' && !Number.isNaN(vNum)) next.modeIndex = vNum;
          }
          return next;
        });
        return;
      }

      if (deviceType === 'esp2') {
        setBattery2Data((prev) => {
          const next = { ...prev, lastUpdatedMs: now };
          const pairs = line.split(/[,\s]+/);
          for (const p of pairs) {
            const [kRaw, vRaw] = p.split('=');
            if (!kRaw || vRaw === undefined) continue;
            const k = kRaw.toUpperCase();
            const vNum = Number(vRaw);
            if ((k === 'VBAT' || k === 'V2') && !Number.isNaN(vNum)) next.vbat = vNum;
            else if ((k === 'IBAT' || k === 'I2') && !Number.isNaN(vNum)) next.ibat = vNum;
            else if ((k === 'SOC' || k === 'SOC2') && !Number.isNaN(vNum)) next.socPct = vNum;
            else if (k === 'TEMP' && !Number.isNaN(vNum)) next.tempC = vNum;
            else if (k === 'SOH' && !Number.isNaN(vNum)) next.sohPct = vNum;
            else if (k === 'CAN') next.canMode = vRaw;
          }
          return next;
        });
      }
    },
    [addLog, updateSettings]
  );

  const handleIncomingTransportBinary = useCallback(
    (deviceType: DiscoveredDevice['deviceType'], bytes: Uint8Array) => {
      const now = Date.now();
      const curSettings = latestRef.current.settings;

      if (deviceType === 'motor') {
        setMotorData((prev) => {
          const parsed = parseFardriverFrame(bytes, prev, {
            polePairs: curSettings.fardriverPolePairs,
            wheelCircumferenceMm: curSettings.wheelCircumferenceMm,
            nowMs: now,
          });
          if (parsed) {
            addLog('FARDRIVER', parsed.summary);
            return parsed.data;
          }
          return prev;
        });
        return;
      }

      if (deviceType === 'jikong') {
        setJkData((prev) => {
          const bmsProto = prev.protocol || curSettings.bmsProtocol;
          const parsed = detectAndParseBmsFrame(bytes, bmsProto, prev, now);
          if (parsed) {
            addLog(
              bmsProto.toUpperCase(),
              `V=${parsed.vpack?.toFixed(2) ?? '--'}V I=${parsed.ibat?.toFixed(1) ?? '--'}A SOC=${parsed.socPct ?? '--'}%`
            );
            return parsed;
          }
          return prev;
        });
      }
    },
    [addLog]
  );

  const connectDevice = useCallback(
    async (device: DiscoveredDevice) => {
      const now = Date.now();
      setScanError('');
      if (device.deviceType === 'motor') setMotorConnState('CONNECTING');
      else if (device.deviceType === 'jikong') setJkConnState('CONNECTING');
      else if (device.deviceType === 'esp1') setEsp1ConnState('CONNECTING');
      else setEsp2ConnState('CONNECTING');

      const protoCtrl = device.controllerProtocol ?? (device.isBle ? settings.controllerProtocol : 'motor_mid');
      const protoBms = device.bmsProtocol ?? settings.bmsProtocol;

      if (device.deviceType === 'motor' && protoCtrl !== settings.controllerProtocol) {
        updateSettings({ ...settings, controllerProtocol: protoCtrl });
      }
      if (device.deviceType === 'jikong' && protoBms !== settings.bmsProtocol) {
        updateSettings({ ...settings, bmsProtocol: protoBms });
      }

      const ok = await bluetoothTransport.connectDevice(
        device,
        { controllerProtocol: protoCtrl, bmsProtocol: protoBms },
        {
          onTextLine: handleIncomingTransportLine,
          onBinaryFrame: handleIncomingTransportBinary,
          onDisconnected: (slot, reason) => {
            if (slot === 'motor') {
              setMotorConnState('DISCONNECTED');
              setMotorConnName('');
            } else if (slot === 'jikong') {
              setJkConnState('DISCONNECTED');
              setJkConnName('');
            } else if (slot === 'esp1') {
              setEsp1ConnState('DISCONNECTED');
              setEsp1ConnName('');
            } else {
              setEsp2ConnState('DISCONNECTED');
              setEsp2ConnName('');
            }
            addLog(slot.toUpperCase(), reason, true);
          },
          onLog: addLog,
        }
      );

      if (!ok) {
        if (device.deviceType === 'motor') setMotorConnState('DISCONNECTED');
        else if (device.deviceType === 'jikong') setJkConnState('DISCONNECTED');
        else if (device.deviceType === 'esp1') setEsp1ConnState('DISCONNECTED');
        else setEsp2ConnState('DISCONNECTED');
        setScanError(`Gagal menghubungkan ${device.name}. Cek log serial di tab Garasi untuk detail.`);
        return;
      }

      if (device.deviceType === 'motor') {
        setMotorConnState('CONNECTED');
        setMotorConnName(device.name);
        setMotorData((prev) => ({ ...prev, sourceProtocol: protoCtrl, lastUpdatedMs: now }));
      } else if (device.deviceType === 'jikong') {
        setJkConnState('CONNECTED');
        setJkConnName(device.name);
        setJkData((prev) => ({ ...prev, protocol: protoBms, lastUpdatedMs: now }));
      } else if (device.deviceType === 'esp1') {
        setEsp1ConnState('CONNECTED');
        setEsp1ConnName(device.name);
        setEsp1Data((prev) => ({ ...prev, lastUpdatedMs: now }));
      } else {
        setEsp2ConnState('CONNECTED');
        setEsp2ConnName(device.name);
        setBattery2Data((prev) => ({ ...prev, lastUpdatedMs: now }));
      }
    },
    [
      addLog,
      handleIncomingTransportBinary,
      handleIncomingTransportLine,
      settings,
      updateSettings,
    ]
  );

  const connectWebSerialMotor = useCallback(async () => {
    setScanError('');
    setMotorConnState('CONNECTING');
    const dev = await bluetoothTransport.connectWebSerialSpp({
      onTextLine: handleIncomingTransportLine,
      onBinaryFrame: handleIncomingTransportBinary,
      onDisconnected: () => {
        setMotorConnState('DISCONNECTED');
        setMotorConnName('');
      },
      onLog: addLog,
    });
    if (!dev) {
      setMotorConnState('DISCONNECTED');
      setScanError('Gagal membuka port Serial SPP (Web Serial hanya tersedia di Chrome Desktop / adapter serial).');
      return;
    }
    setMotorConnState('CONNECTED');
    setMotorConnName(dev.name);
    updateSettings({ ...settings, controllerProtocol: 'motor_mid' });
  }, [addLog, handleIncomingTransportBinary, handleIncomingTransportLine, settings, updateSettings]);

  const disconnectDevice = useCallback(
    async (type: DiscoveredDevice['deviceType']) => {
      await bluetoothTransport.disconnectSlot(type);
      if (type === 'motor') {
        setMotorConnState('DISCONNECTED');
        setMotorConnName('');
      } else if (type === 'jikong') {
        setJkConnState('DISCONNECTED');
        setJkConnName('');
      } else if (type === 'esp1') {
        setEsp1ConnState('DISCONNECTED');
        setEsp1ConnName('');
      } else {
        setEsp2ConnState('DISCONNECTED');
        setEsp2ConnName('');
      }
      addLog('CONN', `Perangkat ${type.toUpperCase()} diputuskan.`);
    },
    [addLog]
  );

  const injectMotorAtCommand = useCallback(
    (line: string) => {
      addLog('TX/RX', line);
      if (motorConnState === 'CONNECTED' && !devSimActive) {
        void bluetoothTransport.sendTextCommand('motor', line);
      }
      const now = Date.now();
      setMotorConnState('CONNECTED');
      if (!motorConnName) setMotorConnName('MID-AT-CONSOLE');
      setMotorData((prev) => {
        const parsed = parseMotorAtLine(
          line,
          { ...prev, sourceProtocol: 'motor_mid' },
          now,
          (odo) => updateSettings({ ...settings, odoBackupKm: odo }),
          (msg) => addLog('ODO-GUARD', msg, true)
        );
        return parsed ?? { ...prev, sourceProtocol: 'motor_mid', lastUpdatedMs: now };
      });
    },
    [addLog, devSimActive, motorConnName, motorConnState, settings, updateSettings]
  );

  const injectProtocolHexFrame = useCallback(
    (hex: string, target: 'controller' | 'bms'): boolean => {
      const bytes = parseHexStringToBytes(hex);
      if (!bytes) {
        addLog('PROTO', 'Format HEX tidak valid.', true);
        return false;
      }
      const now = Date.now();
      if (target === 'controller') {
        const res = parseFardriverFrame(bytes, motorData, {
          polePairs: settings.fardriverPolePairs,
          wheelCircumferenceMm: settings.wheelCircumferenceMm,
          nowMs: now,
        });
        if (!res) {
          addLog('FARDRIVER', 'Frame Fardriver tidak cocok atau CRC16 salah.', true);
          return false;
        }
        setMotorConnState('CONNECTED');
        if (!motorConnName) setMotorConnName('FARDRIVER-BLE');
        if (settings.controllerProtocol !== 'fardriver') {
          updateSettings({ ...settings, controllerProtocol: 'fardriver' });
        }
        setMotorData(res.data);
        addLog('FARDRIVER', res.summary);
        return true;
      } else {
        const parsed = detectAndParseBmsFrame(bytes, settings.bmsProtocol, jkData, now);
        if (!parsed) {
          addLog(
            settings.bmsProtocol.toUpperCase(),
            `Frame ${settings.bmsProtocol.toUpperCase()} tidak cocok / checksum gagal.`,
            true
          );
          return false;
        }
        setJkConnState('CONNECTED');
        if (!jkConnName) setJkConnName(`${settings.bmsProtocol.toUpperCase()}-BMS`);
        setJkData(parsed);
        addLog(
          settings.bmsProtocol.toUpperCase(),
          `Decoded V=${parsed.vpack?.toFixed(2) ?? '--'}V I=${parsed.ibat?.toFixed(1) ?? '--'}A SOC=${parsed.socPct ?? '--'}% (${parsed.cellCount}S)`
        );
        return true;
      }
    },
    [addLog, jkConnName, jkData, motorConnName, motorData, settings, updateSettings]
  );

  const saveLiveTrip = useCallback(() => {
    if (liveTrip.distanceKm < 0.01 && liveTrip.energyWh < 0.5) return;
    const { score } = {
      score:
        ridingScore.samples >= 3
          ? Math.min(
              100,
              Math.max(
                0,
                Math.round(
                  (1 - ridingScore.ecoViolations / ridingScore.samples) * 50 +
                    (1 - Math.min(1, ridingScore.hardBrakes / (ridingScore.samples * 0.05))) * 30 +
                    Math.min(1, ridingScore.regenEvents / (ridingScore.samples * 0.1)) * 20
                )
              )
            )
          : undefined,
    };
    const rec: TripRecord = {
      id: `trip_${Date.now()}`,
      startTimeMs: liveTrip.startTimeMs || Date.now() - 60000,
      endTimeMs: Date.now(),
      distanceKm: liveTrip.distanceKm,
      energyWh: liveTrip.energyWh,
      regenWh: liveTrip.regenWh,
      whPerKm: liveTrip.distanceKm > 0.05 ? liveTrip.energyWh / liveTrip.distanceKm : effective.blendedWhPerKm,
      maxSpeedKmh: liveTrip.maxSpeedKmh,
      avgSpeedKmh:
        liveTrip.movingSeconds > 0 ? liveTrip.distanceKm / (liveTrip.movingSeconds / 3600) : 0,
      maxPowerW: liveTrip.maxPowerW,
      ridingScore: score,
      startArea: gpsState.areaName || 'Lokasi Awal',
      endArea: gpsState.roadName || gpsState.areaName || 'Tujuan',
      pathPoints: [...livePathPointsRef.current],
    };
    const next = [rec, ...tripHistory];
    setTripHistory(next);
    StorageService.saveTrips(next);
    setLiveTrip(INITIAL_LIVE_TRIP);
    setRidingScore(INITIAL_SCORE);
    livePathPointsRef.current = [];
  }, [liveTrip, ridingScore, effective.blendedWhPerKm, gpsState, tripHistory]);

  const resetLiveTrip = useCallback(() => {
    setLiveTrip(INITIAL_LIVE_TRIP);
    setRidingScore(INITIAL_SCORE);
    livePathPointsRef.current = [];
  }, []);

  const deleteTrip = useCallback(
    (id: string) => {
      const next = tripHistory.filter((t) => t.id !== id);
      setTripHistory(next);
      StorageService.saveTrips(next);
    },
    [tripHistory]
  );

  const parkHere = useCallback(() => {
    const loc = gpsState.location ?? DEFAULT_JAKARTA;
    const parked: ParkedLocation = {
      lat: loc.lat,
      lng: loc.lng,
      timestampMs: Date.now(),
      note: gpsState.roadName || gpsState.areaName,
    };
    setParkedLocation(parked);
    StorageService.saveParked(parked);
    updateSettings({
      ...settings,
      lastParkSocPct: effective.combinedSocPct,
      lastParkTsMs: Date.now(),
    });
  }, [gpsState, settings, effective.combinedSocPct, updateSettings]);

  const clearParkPin = useCallback(() => {
    setParkedLocation(undefined);
    StorageService.saveParked(undefined);
  }, []);

  const calculateRouteForStops = useCallback(
    async (stops: PlannedStop[]) => {
      if (stops.length === 0) {
        setActiveRoute(undefined);
        setIsNavigating(false);
        return;
      }
      setIsLoadingRoute(true);
      const origin = gpsState.location ?? DEFAULT_JAKARTA;
      const waypoints: GeoPoint[] = [origin, ...stops.map((s) => ({ lat: s.lat, lng: s.lng }))];
      const totalPackWh =
        settings.b1NominalV * settings.b1CapacityAh + settings.b2NominalV * settings.b2CapacityAh;
      const route = await RemoteApisService.fetchRoute({
        waypoints,
        bikeKg: settings.bikeKg,
        riderKg: settings.riderKg,
        loadKg: settings.loadKg,
        calFactor: settings.calFactor,
        totalPackWh,
        currentSocPct: effective.combinedSocPct ?? 82,
      });
      if (route) {
        setActiveRoute(route);
        setActiveStepIndex(0);
        setRemainingDistKm(route.distanceM / 1000);
        setEtaMin(route.durationSec / 60);
      }
      setIsLoadingRoute(false);
    },
    [gpsState.location, settings, effective.combinedSocPct]
  );

  const addStopAndRoute = useCallback(
    async (stop: PlannedStop) => {
      const next = [...plannedStops, stop];
      setPlannedStops(next);
      await calculateRouteForStops(next);
    },
    [plannedStops, calculateRouteForStops]
  );

  const removeStopAndRoute = useCallback(
    async (id: string) => {
      const next = plannedStops.filter((s) => s.id !== id);
      setPlannedStops(next);
      await calculateRouteForStops(next);
    },
    [plannedStops, calculateRouteForStops]
  );

  const clearRoute = useCallback(() => {
    setPlannedStops([]);
    setActiveRoute(undefined);
    setIsNavigating(false);
    setActiveStepIndex(0);
  }, []);

  const addSavedPlace = useCallback(
    (place: SavedPlace) => {
      const next = [place, ...savedPlaces.filter((p) => p.id !== place.id)];
      setSavedPlaces(next);
      StorageService.savePlaces(next);
    },
    [savedPlaces]
  );

  const deleteSavedPlace = useCallback(
    (id: string) => {
      const next = savedPlaces.filter((p) => p.id !== id);
      setSavedPlaces(next);
      StorageService.savePlaces(next);
    },
    [savedPlaces]
  );

  const addUserSpklu = useCallback(
    (station: SpkluStation) => {
      const next = [station, ...userSpklu];
      setUserSpklu(next);
      StorageService.saveUserSpklu(next);
      setNearbySpklu((prev) => [station, ...prev]);
    },
    [userSpklu]
  );

  const addFieldNote = useCallback(
    (note: Omit<FieldNotePin, 'id' | 'timestampMs'>) => {
      const entry: FieldNotePin = {
        ...note,
        id: `fn_${Date.now()}`,
        timestampMs: Date.now(),
      };
      const next = [entry, ...fieldNotes];
      setFieldNotes(next);
      StorageService.saveFieldNotes(next);
    },
    [fieldNotes]
  );

  const deleteFieldNote = useCallback(
    (id: string) => {
      const next = fieldNotes.filter((n) => n.id !== id);
      setFieldNotes(next);
      StorageService.saveFieldNotes(next);
    },
    [fieldNotes]
  );

  const addMaintLog = useCallback(
    (entry: Omit<MaintenanceLogEntry, 'id' | 'timestampMs'>) => {
      const item: MaintenanceLogEntry = {
        ...entry,
        id: `maint_${Date.now()}`,
        timestampMs: Date.now(),
      };
      const next = [item, ...maintLogs];
      setMaintLogs(next);
      StorageService.saveMaintLogs(next);
      updateSettings({ ...settings, maintLastOdoKm: entry.odoKm });
    },
    [maintLogs, settings, updateSettings]
  );

  const addCalibrationLog = useCallback(
    (factor: number, note: string) => {
      const item: CalibrationEntry = {
        id: `cal_${Date.now()}`,
        factor,
        note,
        timestampMs: Date.now(),
      };
      const next = [item, ...calibLogs];
      setCalibLogs(next);
      StorageService.saveCalibLogs(next);
      updateSettings({ ...settings, calFactor: factor });
    },
    [calibLogs, settings, updateSettings]
  );

  const setEsp1Control = useCallback(
    (patch: Partial<Esp32Data>) => {
      const now = Date.now();
      setEsp1ConnState('CONNECTED');
      if (!esp1ConnName) setEsp1ConnName('ESP32-CTRL');
      setEsp1Data((prev) => ({ ...prev, ...patch, lastUpdatedMs: now }));
      addLog('ESP1', `Kontrol ESP32 #1 diperbarui: ${JSON.stringify(patch)}`);
    },
    [esp1ConnName, addLog]
  );

  const addMatrixItem = useCallback(
    (text: string, speedMs = 45, effectId = 0) => {
      const item: MatrixQueueItem = {
        id: `mx_${Date.now()}`,
        text: text.toUpperCase().slice(0, 40),
        enabled: true,
        speedMs,
        effectId,
      };
      const next = [...matrixQueue, item];
      setMatrixQueue(next);
      StorageService.saveMatrixQueue(next);
    },
    [matrixQueue]
  );

  const toggleMatrixItem = useCallback(
    (id: string) => {
      const next = matrixQueue.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m));
      setMatrixQueue(next);
      StorageService.saveMatrixQueue(next);
    },
    [matrixQueue]
  );

  const deleteMatrixItem = useCallback(
    (id: string) => {
      const next = matrixQueue.filter((m) => m.id !== id);
      setMatrixQueue(next);
      StorageService.saveMatrixQueue(next);
    },
    [matrixQueue]
  );

  const restoreMotorOdo = useCallback(
    (odoKm: number) => {
      injectMotorAtCommand(`AT+ODO=${odoKm.toFixed(1)}`);
    },
    [injectMotorAtCommand]
  );

  const value: DashboardContextValue = {
    settings,
    colors,
    motorConnState,
    motorConnName,
    jkConnState,
    jkConnName,
    esp1ConnState,
    esp1ConnName,
    esp2ConnState,
    esp2ConnName,
    motorData,
    jkData,
    battery2Data,
    esp1Data,
    effective,
    chargeState,
    liveTrip,
    ridingScore,
    telemetryHistory,
    serialLogs,
    activeAlerts,
    gpsState,
    weather,
    parkedLocation,
    tripHistory,
    savedPlaces,
    nearbySpklu,
    userSpklu,
    fieldNotes,
    maintLogs,
    calibLogs,
    chargingLogs,
    sohHistory,
    matrixQueue,
    matrixAutoRotate,
    plannedStops,
    activeRoute,
    isLoadingRoute,
    isNavigating,
    activeStepIndex,
    distToNextStepM,
    remainingDistKm,
    etaMin,
    devSimActive,
    midStreaming,
    mapsFramesSent,
    lastMidFramePreview,
    discoveredDevices,
    isScanningBle,
    scanError,
    badges,
    fuelSavings,
    maintStatus,
    personalRecords,
    efficiencyTrend,
    dailyChallenge,
    updateSettings,
    toggleDevSim,
    scanDevices,
    connectWebSerialMotor,
    assignDiscoveredDeviceRole,
    connectDevice,
    disconnectDevice,
    injectMotorAtCommand,
    injectProtocolHexFrame,
    clearSerialLogs: () => setSerialLogs([]),
    saveLiveTrip,
    resetLiveTrip,
    deleteTrip,
    parkHere,
    clearParkPin,
    refreshWeatherAndGeo,
    refreshNearbySpklu,
    addStopAndRoute,
    removeStopAndRoute,
    clearRoute,
    startNavigation: () => setIsNavigating(true),
    stopNavigation: () => setIsNavigating(false),
    toggleMidStreaming: (enable: boolean) => setMidStreaming(enable),
    addSavedPlace,
    deleteSavedPlace,
    addUserSpklu,
    addFieldNote,
    deleteFieldNote,
    addMaintLog,
    addCalibrationLog,
    setEsp1Control,
    addMatrixItem,
    toggleMatrixItem,
    deleteMatrixItem,
    setMatrixAutoRotate,
    restoreMotorOdo,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
};

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}
