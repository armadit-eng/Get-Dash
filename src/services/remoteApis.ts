import {
  buildElevationAndEnergy,
  decodeWeatherCode,
  downsamplePoints,
  haversineKm,
  parseCoordinatesOrGoogleMapsUrl,
} from '../engine/routePhysics';
import {
  GeoPoint,
  NavRoute,
  RouteStep,
  SavedPlace,
  SpkluStation,
  WeatherData,
} from '../types/dashboard';

let cachedMolisSeed: SpkluStation[] | null = null;

export const RemoteApisService = {
  async fetchWeather(lat: number, lng: number): Promise<WeatherData | null> {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
        `&hourly=precipitation_probability,uv_index&daily=sunrise,sunset&timezone=auto&forecast_days=1`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const j = await res.json();
      const cur = j.current;
      if (!cur) return null;

      const probs: number[] = j.hourly?.precipitation_probability ?? [];
      const uvs: number[] = j.hourly?.uv_index ?? [];
      const hourIdx = Math.min(Math.max(0, new Date().getHours()), Math.max(0, probs.length - 1));
      const rainProbPct = probs.length > 0 ? Math.round(probs[hourIdx] ?? 0) : 0;
      const uvIndex = uvs.length > hourIdx ? Number(uvs[hourIdx]) : undefined;

      const srFirst = j.daily?.sunrise?.[0];
      const ssFirst = j.daily?.sunset?.[0];
      const sunrise = typeof srFirst === 'string' && srFirst.includes('T') ? srFirst.split('T')[1] : '--:--';
      const sunset = typeof ssFirst === 'string' && ssFirst.includes('T') ? ssFirst.split('T')[1] : '--:--';

      const weatherCode = Number(cur.weather_code ?? 1);
      const { desc, moodTag } = decodeWeatherCode(weatherCode);

      return {
        tempC: Number(cur.temperature_2m ?? 28),
        feelsLikeC: Number(cur.apparent_temperature ?? 30),
        humidityPct: Math.round(Number(cur.relative_humidity_2m ?? 70)),
        windKmh: Number(cur.wind_speed_10m ?? 8),
        rainProbPct,
        uvIndex,
        weatherCode,
        description: desc,
        moodTag,
        sunrise,
        sunset,
        fetchedAtMs: Date.now(),
      };
    } catch {
      return null;
    }
  },

  async reverseGeocode(lat: number, lng: number): Promise<{ road: string; area: string } | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const j = await res.json();
      const addr = j.address ?? {};
      const road = addr.road || addr.pedestrian || addr.suburb || j.name || '';
      const area =
        addr.city_district || addr.suburb || addr.village || addr.city || addr.town || '';
      return { road, area };
    } catch {
      return null;
    }
  },

  async searchPlaces(query: string): Promise<SavedPlace[]> {
    if (!query.trim()) return [];
    const direct = parseCoordinatesOrGoogleMapsUrl(query);
    if (direct) {
      return [
        {
          id: `coord_${direct.lat}_${direct.lng}`,
          name: `Koordinat (${direct.lat.toFixed(5)}, ${direct.lng.toFixed(5)})`,
          category: 'Pin Koordinat',
          lat: direct.lat,
          lng: direct.lng,
          createdAtMs: Date.now(),
        },
      ];
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
        query
      )}&limit=8&countrycodes=id`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const arr = await res.json();
      if (!Array.isArray(arr)) return [];
      return arr.map((item: Record<string, unknown>, idx: number) => ({
        id: `nom_${item.place_id ?? idx}`,
        name: String(item.display_name ?? query).split(',').slice(0, 3).join(','),
        category: String(item.type ?? 'Lokasi'),
        lat: Number(item.lat),
        lng: Number(item.lon),
        createdAtMs: Date.now(),
      }));
    } catch {
      return [];
    }
  },

  async fetchRoute(params: {
    waypoints: GeoPoint[];
    bikeKg: number;
    riderKg: number;
    loadKg: number;
    calFactor: number;
    totalPackWh: number;
    currentSocPct?: number;
  }): Promise<NavRoute | null> {
    const { waypoints } = params;
    if (waypoints.length < 2) return null;
    try {
      const coords = waypoints.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
      const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const j = await res.json();
      const route = j.routes?.[0];
      if (!route) return null;

      const rawCoords: [number, number][] = route.geometry?.coordinates ?? [];
      const geometry: GeoPoint[] = rawCoords.map(([lng, lat]) => ({ lat, lng }));
      const distanceM = Number(route.distance ?? 0);
      const durationSec = Number(route.duration ?? 0);

      const steps: RouteStep[] = [];
      for (const leg of route.legs ?? []) {
        for (const s of leg.steps ?? []) {
          const loc = s.maneuver?.location ?? [waypoints[0].lng, waypoints[0].lat];
          const type = String(s.maneuver?.type ?? 'turn');
          const mod = s.maneuver?.modifier ? String(s.maneuver.modifier) : undefined;
          const roadName = String(s.name || 'Jalan');
          steps.push({
            instruction: formatStepInstruction(type, mod, roadName),
            roadName,
            distanceM: Number(s.distance ?? 0),
            durationSec: Number(s.duration ?? 0),
            maneuverType: type,
            modifier: mod,
            location: { lat: Number(loc[1]), lng: Number(loc[0]) },
          });
        }
      }

      const sampled = downsamplePoints(geometry, 36);
      const elevations = await this.fetchElevations(sampled);
      const physics = buildElevationAndEnergy({
        sampledPoints: sampled,
        elevations,
        totalDistanceKm: distanceM / 1000,
        durationMin: durationSec / 60,
        bikeKg: params.bikeKg,
        riderKg: params.riderKg,
        loadKg: params.loadKg,
        calFactor: params.calFactor,
        totalPackWh: params.totalPackWh,
        currentSocPct: params.currentSocPct,
      });

      return {
        geometry,
        steps,
        distanceM,
        durationSec,
        elevationSamples: physics.samples,
        energyEstimate: physics.estimate,
        hillSegments: physics.hillSegments,
      };
    } catch {
      return null;
    }
  },

  async fetchElevations(points: GeoPoint[]): Promise<number[]> {
    if (points.length === 0) return [];
    try {
      const lats = points.map((p) => p.lat.toFixed(5)).join(',');
      const lngs = points.map((p) => p.lng.toFixed(5)).join(',');
      const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;
      const res = await fetch(url);
      if (!res.ok) return points.map(() => 15);
      const j = await res.json();
      if (Array.isArray(j.elevation)) {
        return j.elevation.map((v: unknown) => Number(v ?? 15));
      }
      return points.map(() => 15);
    } catch {
      return points.map(() => 15);
    }
  },

  async loadMolisSeedStations(): Promise<SpkluStation[]> {
    if (cachedMolisSeed) return cachedMolisSeed;
    try {
      const res = await fetch('/data/molis_community_seed.json');
      if (!res.ok) return [];
      const list = (await res.json()) as SpkluStation[];
      cachedMolisSeed = list;
      return list;
    } catch {
      return [];
    }
  },

  async fetchNearbySpklu(center: GeoPoint, includeMolisSeed = true): Promise<SpkluStation[]> {
    const stations: SpkluStation[] = [];
    if (includeMolisSeed) {
      const seed = await this.loadMolisSeedStations();
      for (const s of seed) {
        const d = haversineKm(center, { lat: s.lat, lng: s.lng });
        stations.push({ ...s, distanceKm: d });
      }
    }

    try {
      const query = `[out:json][timeout:8];node["amenity"="charging_station"](around:12000,${center.lat},${center.lng});out body 25;`;
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
      });
      if (res.ok) {
        const j = await res.json();
        for (const el of j.elements ?? []) {
          const lat = Number(el.lat);
          const lng = Number(el.lon);
          const tags = el.tags ?? {};
          stations.push({
            id: `osm_${el.id}`,
            name: tags.name || 'SPKLU Umum',
            operatorName: tags.operator || 'PLN / Umum',
            lat,
            lng,
            socketType: tags['socket:type2'] ? 'Type 2' : 'SPLU / SPKLU',
            powerKw: tags.capacity ? Number(tags.capacity) : null,
            isUserAdded: false,
            distanceKm: haversineKm(center, { lat, lng }),
            sourceLabel: 'OpenStreetMap',
            isMolisFriendly: false,
          });
        }
      }
    } catch {
      // Overpass fallback quietly ignored when seed is loaded
    }

    return stations.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  },
};

function formatStepInstruction(type: string, modifier: string | undefined, roadName: string): string {
  const dir =
    modifier === 'left'
      ? 'Belok kiri'
      : modifier === 'right'
        ? 'Belok kanan'
        : modifier === 'slight left'
          ? 'Serong kiri'
          : modifier === 'slight right'
            ? 'Serong kanan'
            : modifier === 'uturn'
              ? 'Putar balik'
              : 'Lurus';
  if (type === 'depart') return `Mulai perjalanan di ${roadName}`;
  if (type === 'arrive') return `Tiba di tujuan (${roadName})`;
  if (type === 'roundabout') return `Masuk bundaran ke ${roadName}`;
  return `${dir} ke ${roadName}`;
}
