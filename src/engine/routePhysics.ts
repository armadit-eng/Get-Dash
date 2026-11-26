import {
  ElevationSample,
  FieldNotePin,
  GeoPoint,
  HillGrade,
  HillSegment,
  RouteEnergyEstimate,
  TripRecord,
} from '../types/dashboard';

export const GRAVITY = 9.81;
export const CRR = 0.013;
export const CDA = 0.55;
export const RHO = 1.18;
export const ETA_DRIVE = 0.8;
export const ETA_REGEN = 0.45;
export const AUX_W = 25.0;

const degToRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const r = 6371.0;
  const dLat = degToRad(b.lat - a.lat);
  const dLon = degToRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(degToRad(a.lat)) * Math.cos(degToRad(b.lat)) * sinLon * sinLon;
  return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function distanceToPolylineM(point: GeoPoint, polyline: GeoPoint[]): number {
  if (polyline.length === 0) return Number.MAX_VALUE;
  if (polyline.length === 1) return haversineKm(point, polyline[0]) * 1000;
  const cosLat = Math.min(1, Math.max(0.2, Math.cos(degToRad(point.lat))));
  let minDistM = Number.MAX_VALUE;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const bx = (b.lng - a.lng) * 111320 * cosLat;
    const by = (b.lat - a.lat) * 110540;
    const px = (point.lng - a.lng) * 111320 * cosLat;
    const py = (point.lat - a.lat) * 110540;
    const len2 = bx * bx + by * by;
    const t = len2 > 1e-6 ? Math.min(1, Math.max(0, (px * bx + py * by) / len2)) : 0;
    const distM = Math.hypot(px - t * bx, py - t * by);
    if (distM < minDistM) minDistM = distM;
  }
  return minDistM;
}

export function bearingDeg(a: GeoPoint, b: GeoPoint): number {
  const lat1 = degToRad(a.lat);
  const lat2 = degToRad(b.lat);
  const dLon = degToRad(b.lng - a.lng);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function parseCoordinatesOrGoogleMapsUrl(input: string): GeoPoint | null {
  const trimmed = input.trim();
  const direct = trimmed.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (direct) {
    const lat = Number(direct[1]);
    const lng = Number(direct[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }
  const gmaps = trimmed.match(/[@/](-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
  if (gmaps) {
    const lat = Number(gmaps[1]);
    const lng = Number(gmaps[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }
  return null;
}

export function downsamplePoints(points: GeoPoint[], maxSamples = 36): GeoPoint[] {
  if (points.length <= maxSamples) return points;
  const step = (points.length - 1) / (maxSamples - 1);
  return Array.from({ length: maxSamples }, (_, i) => {
    const idx = Math.min(points.length - 1, Math.max(0, Math.floor(i * step)));
    return points[idx];
  });
}

export function buildElevationAndEnergy(params: {
  sampledPoints: GeoPoint[];
  elevations: number[];
  totalDistanceKm: number;
  durationMin: number;
  bikeKg: number;
  riderKg: number;
  loadKg: number;
  calFactor: number;
  totalPackWh: number;
  currentSocPct?: number;
}): { samples: ElevationSample[]; estimate: RouteEnergyEstimate; hillSegments: HillSegment[] } {
  const {
    sampledPoints,
    elevations,
    totalDistanceKm,
    durationMin,
    bikeKg,
    riderKg,
    loadKg,
    calFactor,
    totalPackWh,
    currentSocPct,
  } = params;

  const n = Math.min(sampledPoints.length, elevations.length);
  if (n < 2) {
    const fallbackWh = totalDistanceKm * 28.0 * calFactor;
    const socUsedPct = totalPackWh > 0 ? (fallbackWh / totalPackWh) * 100 : 0;
    return {
      samples: [],
      hillSegments: [],
      estimate: {
        totalWh: fallbackWh,
        regenWh: 0,
        netWh: fallbackWh,
        whPerKm: totalDistanceKm > 0.1 ? fallbackWh / totalDistanceKm : 28.0,
        socUsedPct,
        socAtArrivalPct: currentSocPct !== undefined ? Math.min(100, Math.max(0, currentSocPct - socUsedPct)) : undefined,
        maxClimbPct: 0,
        totalAscentM: 0,
        totalDescentM: 0,
      },
    };
  }

  const totalMassKg = bikeKg + riderKg + loadKg;
  const avgSpeedMs =
    durationMin > 0.1 && totalDistanceKm > 0.05
      ? Math.min(22, Math.max(4, (totalDistanceKm * 1000) / (durationMin * 60)))
      : 10.5;

  let totalWh = 0;
  let regenWh = 0;
  let totalAscentM = 0;
  let totalDescentM = 0;
  let maxClimbPct = 0;
  let cumKm = 0;

  const samples: ElevationSample[] = [];
  const hillSegments: HillSegment[] = [];

  for (let i = 0; i < n; i++) {
    const pt = sampledPoints[i];
    const ele = elevations[i];
    let gradePct = 0;

    if (i > 0) {
      const segKm = Math.max(0.01, haversineKm(sampledPoints[i - 1], pt));
      cumKm += segKm;
      const segM = segKm * 1000;
      const dh = ele - elevations[i - 1];
      gradePct = (dh / segM) * 100;
      if (dh > 0) {
        totalAscentM += dh;
        if (gradePct > maxClimbPct) maxClimbPct = gradePct;
      } else {
        totalDescentM += Math.abs(dh);
      }

      const sinTheta = dh / Math.hypot(segM, dh);
      const cosTheta = segM / Math.hypot(segM, dh);
      const fRoll = CRR * totalMassKg * GRAVITY * cosTheta;
      const fAero = 0.5 * RHO * CDA * avgSpeedMs * avgSpeedMs;
      const fGrav = totalMassKg * GRAVITY * sinTheta;
      const fNet = fRoll + fAero + fGrav;
      const dtHr = segM / avgSpeedMs / 3600;
      const auxWh = AUX_W * dtHr;

      let segWh = 0;
      if (fNet >= 0) {
        const mechWh = (fNet * segM) / 3600;
        segWh = (mechWh / ETA_DRIVE) * calFactor + auxWh;
        totalWh += segWh;
      } else {
        const mechRegenWh = (Math.abs(fNet) * segM) / 3600;
        const recWh = mechRegenWh * ETA_REGEN;
        regenWh += recWh;
        totalWh += auxWh;
        segWh = auxWh - recWh;
      }

      if (Math.abs(gradePct) >= 2.5 && segM >= 80) {
        hillSegments.push({
          id: hillSegments.length + 1,
          isUphill: dh > 0,
          startDistM: (cumKm - segKm) * 1000,
          endDistM: cumKm * 1000,
          lengthM: segM,
          gainM: dh,
          avgGradePct: gradePct,
          maxGradePct: Math.abs(gradePct),
          dWh: segWh,
          socPct: totalPackWh > 0 ? (segWh / totalPackWh) * 100 : undefined,
          notable: Math.abs(gradePct) >= 4.0,
          steep: Math.abs(gradePct) >= 7.0,
        });
      }
    }

    const gradeType: HillGrade =
      gradePct >= 6
        ? 'UPHILL_STEEP'
        : gradePct >= 2
          ? 'UPHILL_MILD'
          : gradePct <= -2.5
            ? 'DOWNHILL'
            : 'FLAT';

    samples.push({
      distanceKm: cumKm,
      elevationM: ele,
      gradePct,
      gradeType,
      point: { ...pt, altM: ele },
    });
  }

  const netWh = Math.max(0, totalWh - regenWh);
  const whPerKm = totalDistanceKm > 0.1 ? netWh / totalDistanceKm : 28.0;
  const socUsedPct = totalPackWh > 0 ? (netWh / totalPackWh) * 100 : 0;

  return {
    samples,
    hillSegments,
    estimate: {
      totalWh,
      regenWh,
      netWh,
      whPerKm,
      socUsedPct,
      socAtArrivalPct:
        currentSocPct !== undefined
          ? Math.min(100, Math.max(0, currentSocPct - socUsedPct))
          : undefined,
      maxClimbPct,
      totalAscentM,
      totalDescentM,
    },
  };
}

export function decodeWeatherCode(code: number): { desc: string; moodTag: string } {
  if (code === 0) return { desc: 'Cerah', moodTag: 'Ideal untuk Riding' };
  if (code <= 3) return { desc: 'Cerah Berawan', moodTag: 'Nyaman & Sejuk' };
  if (code <= 48) return { desc: 'Berkabut', moodTag: 'Waspada Jarak Pandang' };
  if (code <= 67) return { desc: 'Hujan Ringan–Sedang', moodTag: 'Siapkan Jas Hujan' };
  if (code <= 82) return { desc: 'Hujan Lebat', moodTag: 'Kurangi Kecepatan' };
  return { desc: 'Badai Petir', moodTag: 'Tunda Perjalanan / Berteduh' };
}

export function exportTripsCsv(trips: TripRecord[]): string {
  const header = 'id,startTime,endTime,distanceKm,energyWh,regenWh,whPerKm,maxSpeedKmh,avgSpeedKmh,maxPowerW,ridingScore,startArea,endArea';
  const rows = trips.map((t) =>
    [
      t.id,
      new Date(t.startTimeMs).toISOString(),
      new Date(t.endTimeMs).toISOString(),
      t.distanceKm.toFixed(3),
      t.energyWh.toFixed(1),
      t.regenWh.toFixed(1),
      t.whPerKm.toFixed(1),
      t.maxSpeedKmh.toFixed(1),
      t.avgSpeedKmh.toFixed(1),
      t.maxPowerW.toFixed(0),
      t.ridingScore ?? '',
      `"${(t.startArea || '').replace(/"/g, "'")}"`,
      `"${(t.endArea || '').replace(/"/g, "'")}"`,
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

export function exportTripGpx(trip: TripRecord): string {
  const pts = trip.pathPoints
    .map(
      (p) =>
        `  <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">${
          p.altM !== undefined ? `<ele>${p.altM.toFixed(1)}</ele>` : ''
        }</trkpt>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Dashboard App EV">\n<trk><name>Trip ${trip.id}</name><trkseg>\n${pts}\n</trkseg></trk>\n</gpx>`;
}

export function exportFieldNotesGpx(notes: FieldNotePin[]): string {
  const wpts = notes
    .map(
      (n) =>
        `<wpt lat="${n.lat.toFixed(6)}" lon="${n.lng.toFixed(6)}"><name>${escapeXml(
          n.name
        )}</name><type>${escapeXml(n.category)}</type><desc>${escapeXml(n.note)}</desc></wpt>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Dashboard App EV Field Notes">\n${wpts}\n</gpx>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
