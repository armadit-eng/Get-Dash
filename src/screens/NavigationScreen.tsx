import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Bookmark,
  Compass,
  FileDown,
  Layers,
  LocateFixed,
  MapPin,
  Navigation,
  Pin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { ElevationProfileChart } from '../components/TelemetryCharts';
import { useDashboard } from '../context/DashboardContext';
import { downloadTextFile, exportFieldNotesGpx } from '../engine/routePhysics';
import { RemoteApisService } from '../services/remoteApis';
import { kMapStyles, SavedPlace, SpkluStation } from '../types/dashboard';

export const NavigationScreen: React.FC = () => {
  const {
    colors,
    settings,
    updateSettings,
    gpsState,
    plannedStops,
    activeRoute,
    isLoadingRoute,
    isNavigating,
    activeStepIndex,
    distToNextStepM,
    remainingDistKm,
    etaMin,
    nearbySpklu,
    savedPlaces,
    fieldNotes,
    midStreaming,
    mapsFramesSent,
    lastMidFramePreview,
    addStopAndRoute,
    removeStopAndRoute,
    clearRoute,
    startNavigation,
    stopNavigation,
    toggleMidStreaming,
    refreshNearbySpklu,
    addSavedPlace,
    deleteSavedPlace,
    addUserSpklu,
    addFieldNote,
    deleteFieldNote,
  } = useDashboard();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SavedPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [followRider, setFollowRider] = useState(true);
  const [activeSheet, setActiveSheet] = useState<null | 'style' | 'spklu' | 'places' | 'notes'>(null);

  // Add SPKLU form
  const [spkluName, setSpkluName] = useState('');
  // Add Field Note form
  const [noteTitle, setNoteTitle] = useState('');
  const [noteCategory, setNoteCategory] = useState('Jalan Rusak');
  const [noteBody, setNoteBody] = useState('');

  const addStopRef = useRef(addStopAndRoute);
  addStopRef.current = addStopAndRoute;

  const center = gpsState.location ?? { lat: -6.175392, lng: 106.827153 };
  const mapStyle = kMapStyles.find((m) => m.id === settings.mapStyleId) ?? kMapStyles[0];

  // Init Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [center.lat, center.lng],
      zoom: 14,
      zoomControl: false,
    });
    const tile = L.tileLayer(mapStyle.tileUrlTemplate, {
      attribution: mapStyle.attribution,
      maxZoom: settings.dataSaverMap ? 16 : 19,
    }).addTo(map);
    const group = L.layerGroup().addTo(map);

    map.on('dragstart', () => setFollowRider(false));
    map.on('contextmenu', (e: L.LeafletMouseEvent) => {
      addStopRef.current({
        id: `pin_${Date.now()}`,
        label: `Pin (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`,
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      });
    });

    mapRef.current = map;
    tileLayerRef.current = tile;
    markersLayerRef.current = group;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update tile style
  useEffect(() => {
    if (!mapRef.current) return;
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }
    tileLayerRef.current = L.tileLayer(mapStyle.tileUrlTemplate, {
      attribution: mapStyle.attribution,
      maxZoom: settings.dataSaverMap ? 16 : 19,
    }).addTo(mapRef.current);
  }, [mapStyle, settings.dataSaverMap]);

  // Follow rider
  useEffect(() => {
    if (followRider && mapRef.current && gpsState.location) {
      mapRef.current.panTo([gpsState.location.lat, gpsState.location.lng], { animate: true });
    }
  }, [followRider, gpsState.location]);

  // Update route polyline & markers
  useEffect(() => {
    const map = mapRef.current;
    const group = markersLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    if (activeRoute && activeRoute.geometry.length > 1) {
      const latlngs = activeRoute.geometry.map((p) => [p.lat, p.lng] as [number, number]);
      routeLayerRef.current = L.polyline(latlngs, {
        color: colors.accent,
        weight: 5,
        opacity: 0.9,
      }).addTo(map);
      if (!followRider) {
        map.fitBounds(routeLayerRef.current.getBounds(), { padding: [48, 48] });
      }
    }

    // Rider marker
    L.circleMarker([center.lat, center.lng], {
      radius: 9,
      color: '#FFFFFF',
      weight: 3,
      fillColor: colors.accent,
      fillOpacity: 1,
    })
      .bindPopup('Posisi Pengendara')
      .addTo(group);

    // Planned stops
    plannedStops.forEach((s, idx) => {
      L.circleMarker([s.lat, s.lng], {
        radius: 10,
        color: '#FFFFFF',
        weight: 2,
        fillColor: s.isSpklu ? colors.regen : colors.danger,
        fillOpacity: 1,
      })
        .bindPopup(`${s.isSpklu ? '⚡ ' : `${idx + 1}. `}${s.label}`)
        .addTo(group);
    });

    // Nearby SPKLU (top 30)
    nearbySpklu.slice(0, 30).forEach((st) => {
      const marker = L.circleMarker([st.lat, st.lng], {
        radius: 6,
        color: colors.regen,
        weight: 2,
        fillColor: colors.surfaceCard,
        fillOpacity: 0.95,
      }).addTo(group);
      marker.bindPopup(
        `<div style="font-size:12px"><strong>${st.name}</strong><br/>${st.operatorName} • ${st.socketType}<br/>${
          st.distanceKm !== null && st.distanceKm !== undefined ? `${st.distanceKm.toFixed(1)} km` : ''
        }</div>`
      );
    });

    // Field notes
    fieldNotes.forEach((fn) => {
      L.circleMarker([fn.lat, fn.lng], {
        radius: 6,
        color: colors.warning,
        weight: 2,
        fillColor: colors.warning,
        fillOpacity: 0.85,
      })
        .bindPopup(`<strong>${fn.name}</strong> (${fn.category})<br/>${fn.note}`)
        .addTo(group);
    });
  }, [
    activeRoute,
    plannedStops,
    nearbySpklu,
    fieldNotes,
    center.lat,
    center.lng,
    colors,
    followRider,
  ]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    const res = await RemoteApisService.searchPlaces(query);
    setSearchResults(res);
    setSearching(false);
  };

  return (
    <div className="relative h-[calc(100vh-140px)] md:h-[calc(100vh-48px)] rounded-3xl overflow-hidden border" style={{ borderColor: colors.borderSubtle }}>
      {/* Leaflet Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Search & Action Chips */}
      <div className="absolute top-3 left-3 right-3 z-10 space-y-2 pointer-events-none">
        <form
          onSubmit={handleSearch}
          className="pointer-events-auto flex items-center gap-2 p-2 rounded-2xl border shadow-lg backdrop-blur-md"
          style={{ backgroundColor: `${colors.surfaceCard}EB`, borderColor: colors.borderSubtle }}
        >
          <Search size={16} style={{ color: colors.textMuted }} className="ml-1.5 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari tujuan, koordinat, atau link Google Maps… (Klik kanan peta untuk Pin)"
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: colors.textPrimary }}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSearchResults([]);
              }}
              className="p-1 cursor-pointer"
              style={{ color: colors.textMuted }}
            >
              <X size={14} />
            </button>
          )}
          <button
            type="submit"
            disabled={searching}
            className="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
            style={{ backgroundColor: colors.accent, color: '#041418' }}
          >
            {searching ? '…' : 'Cari'}
          </button>
        </form>

        {/* Search Dropdown */}
        {searchResults.length > 0 && (
          <div
            className="pointer-events-auto rounded-2xl border shadow-xl max-h-52 overflow-y-auto divide-y"
            style={{
              backgroundColor: colors.surfaceCard,
              borderColor: colors.borderSubtle,
            }}
          >
            {searchResults.map((p) => (
              <div key={p.id} className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{p.name}</div>
                  <div className="text-[11px]" style={{ color: colors.textMuted }}>
                    {p.category} • {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => addSavedPlace(p)}
                    className="p-1.5 rounded-lg border cursor-pointer"
                    style={{ borderColor: colors.borderSubtle, color: colors.textMuted }}
                    title="Simpan tempat"
                  >
                    <Bookmark size={13} />
                  </button>
                  <button
                    onClick={() => {
                      addStopAndRoute({ id: p.id, label: p.name, lat: p.lat, lng: p.lng });
                      setSearchResults([]);
                      setFollowRider(false);
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                    style={{ backgroundColor: colors.accent, color: '#041418' }}
                  >
                    Rute
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Pills */}
        <div className="pointer-events-auto flex flex-wrap gap-1.5">
          <QuickChip
            icon={<Zap size={13} />}
            label={`SPKLU (${nearbySpklu.length})`}
            active={activeSheet === 'spklu'}
            onClick={() => setActiveSheet(activeSheet === 'spklu' ? null : 'spklu')}
            colors={colors}
          />
          <QuickChip
            icon={<Layers size={13} />}
            label={mapStyle.label}
            active={activeSheet === 'style'}
            onClick={() => setActiveSheet(activeSheet === 'style' ? null : 'style')}
            colors={colors}
          />
          <QuickChip
            icon={<Bookmark size={13} />}
            label={`Tersimpan (${savedPlaces.length})`}
            active={activeSheet === 'places'}
            onClick={() => setActiveSheet(activeSheet === 'places' ? null : 'places')}
            colors={colors}
          />
          <QuickChip
            icon={<Pin size={13} />}
            label={`Catatan (${fieldNotes.length})`}
            active={activeSheet === 'notes'}
            onClick={() => setActiveSheet(activeSheet === 'notes' ? null : 'notes')}
            colors={colors}
          />
          <QuickChip
            icon={<LocateFixed size={13} />}
            label={followRider ? 'Ikuti GPS' : 'Pusatkan'}
            active={followRider}
            onClick={() => {
              setFollowRider(true);
              mapRef.current?.setView([center.lat, center.lng], 15);
            }}
            colors={colors}
          />
        </div>
      </div>

      {/* Active Turn-by-Turn Banner */}
      {isNavigating && activeRoute && (
        <div
          className="absolute top-28 left-3 right-3 z-10 rounded-2xl p-3 border shadow-lg flex items-center justify-between gap-3"
          style={{ backgroundColor: `${colors.surfaceCard}F2`, borderColor: colors.accent }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Navigation size={20} style={{ color: colors.accent }} className="shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-extrabold truncate" style={{ color: colors.accent }}>
                {activeRoute.steps[activeStepIndex]?.instruction ?? 'Ikuti jalur rute'}
              </div>
              <div className="text-[11px] tnum" style={{ color: colors.textMuted }}>
                {Math.round(distToNextStepM)} m • Sisa {remainingDistKm.toFixed(1)} km • ETA {Math.round(etaMin)} mnt
              </div>
            </div>
          </div>
          <button
            onClick={stopNavigation}
            className="px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer"
            style={{ backgroundColor: `${colors.danger}22`, color: colors.danger }}
          >
            Selesai
          </button>
        </div>
      )}

      {/* Bottom Route & Energy Physics Card */}
      {(activeRoute || isLoadingRoute) && (
        <div
          className="absolute bottom-3 left-3 right-3 z-10 rounded-2xl p-4 border shadow-2xl space-y-3 max-h-[48vh] overflow-y-auto"
          style={{ backgroundColor: `${colors.surfaceCard}F5`, borderColor: colors.borderSubtle }}
        >
          {isLoadingRoute ? (
            <div className="text-xs font-semibold flex items-center gap-2" style={{ color: colors.accent }}>
              <Compass size={16} className="animate-spin" /> Menghitung rute OSRM & fisika elevasi EV…
            </div>
          ) : activeRoute ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-extrabold tnum">
                    {(activeRoute.distanceM / 1000).toFixed(1)} km • {Math.round(activeRoute.durationSec / 60)} menit
                  </div>
                  <div className="text-[11px] tnum" style={{ color: colors.textMuted }}>
                    Est. Energi: {Math.round(activeRoute.energyEstimate?.netWh ?? 0)} Wh • Tiba SOC{' '}
                    <strong style={{ color: colors.accent }}>
                      {activeRoute.energyEstimate?.socAtArrivalPct?.toFixed(0) ?? '--'}%
                    </strong>{' '}
                    • Tanjakan maks {activeRoute.energyEstimate?.maxClimbPct.toFixed(1) ?? '0'}%
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggleMidStreaming(!midStreaming)}
                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer"
                    style={{
                      backgroundColor: midStreaming ? `${colors.accentSecondary}22` : colors.surfaceElevated,
                      borderColor: midStreaming ? colors.accentSecondary : colors.borderSubtle,
                      color: midStreaming ? colors.accentSecondary : colors.textMuted,
                    }}
                  >
                    {midStreaming ? `MID (${mapsFramesSent})` : 'AT+MAPS'}
                  </button>
                  {!isNavigating && (
                    <button
                      onClick={startNavigation}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                      style={{ backgroundColor: colors.accent, color: '#041418' }}
                    >
                      Mulai
                    </button>
                  )}
                  <button
                    onClick={clearRoute}
                    className="p-1.5 rounded-xl border cursor-pointer"
                    style={{ borderColor: colors.borderSubtle, color: colors.danger }}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {midStreaming && lastMidFramePreview && (
                <div
                  className="text-[10px] font-mono px-2.5 py-1.5 rounded-lg truncate"
                  style={{ backgroundColor: colors.background, color: colors.accentSecondary }}
                >
                  {lastMidFramePreview}
                </div>
              )}

              <ElevationProfileChart samples={activeRoute.elevationSamples} colors={colors} />

              {/* Planned stops chips */}
              <div className="flex flex-wrap gap-1.5">
                {plannedStops.map((st, idx) => (
                  <span
                    key={st.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border"
                    style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}
                  >
                    <span>{st.isSpklu ? '⚡' : `${idx + 1}.`} {st.label}</span>
                    <button onClick={() => removeStopAndRoute(st.id)} className="cursor-pointer">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Side / Bottom Modal Sheets for Style, SPKLU, Places, Notes */}
      {activeSheet && (
        <div
          className="absolute right-3 top-28 bottom-3 w-[calc(100%-24px)] sm:w-80 z-20 rounded-2xl border p-4 shadow-2xl overflow-y-auto space-y-3"
          style={{ backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold">
              {activeSheet === 'style'
                ? 'Gaya Peta & Hemat Data'
                : activeSheet === 'spklu'
                  ? 'SPKLU & Komunitas Molis'
                  : activeSheet === 'places'
                    ? 'Lokasi Tersimpan'
                    : 'Catatan Lapangan & GPX'}
            </h3>
            <button onClick={() => setActiveSheet(null)} className="p-1 cursor-pointer">
              <X size={16} />
            </button>
          </div>

          {activeSheet === 'style' && (
            <div className="space-y-2">
              {kMapStyles.map((st) => (
                <button
                  key={st.id}
                  onClick={() => updateSettings({ ...settings, mapStyleId: st.id })}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold border cursor-pointer"
                  style={{
                    backgroundColor: settings.mapStyleId === st.id ? `${colors.accent}22` : colors.surfaceElevated,
                    borderColor: settings.mapStyleId === st.id ? colors.accent : colors.borderSubtle,
                    color: settings.mapStyleId === st.id ? colors.accent : colors.textPrimary,
                  }}
                >
                  {st.label}
                </button>
              ))}
              <label className="flex items-center justify-between pt-2 text-xs font-semibold">
                <span>Mode Hemat Data Peta (z16 max)</span>
                <input
                  type="checkbox"
                  checked={settings.dataSaverMap}
                  onChange={(e) => updateSettings({ ...settings, dataSaverMap: e.target.checked })}
                />
              </label>
            </div>
          )}

          {activeSheet === 'spklu' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={spkluName}
                  onChange={(e) => setSpkluName(e.target.value)}
                  placeholder="Tambah SPKLU di posisi GPS…"
                  className="flex-1 px-2.5 py-2 rounded-xl text-xs border outline-none"
                  style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}
                />
                <button
                  onClick={() => {
                    if (!spkluName.trim()) return;
                    const newSt: SpkluStation = {
                      id: `usr_${Date.now()}`,
                      name: spkluName.trim(),
                      operatorName: 'Komunitas / Pribadi',
                      lat: center.lat,
                      lng: center.lng,
                      socketType: 'Schuko / SPLU',
                      isUserAdded: true,
                      distanceKm: 0,
                      isMolisFriendly: true,
                    };
                    addUserSpklu(newSt);
                    setSpkluName('');
                  }}
                  className="px-3 rounded-xl text-xs font-bold cursor-pointer"
                  style={{ backgroundColor: colors.regen, color: '#041418' }}
                >
                  <Plus size={14} />
                </button>
              </div>
              <button
                onClick={refreshNearbySpklu}
                className="w-full py-2 rounded-xl text-xs font-bold border cursor-pointer"
                style={{ borderColor: colors.borderSubtle, color: colors.accentSecondary }}
              >
                Segarkan SPKLU Terdekat (Overpass + Seed)
              </button>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {nearbySpklu.slice(0, 25).map((st) => (
                  <div
                    key={st.id}
                    className="p-2.5 rounded-xl border flex items-center justify-between gap-2"
                    style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate flex items-center gap-1">
                        {st.isMolisFriendly && <Sparkles size={11} style={{ color: colors.accent }} />}
                        <span>{st.name}</span>
                      </div>
                      <div className="text-[11px] truncate" style={{ color: colors.textMuted }}>
                        {st.operatorName} • {st.distanceKm?.toFixed(1) ?? '--'} km
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        addStopAndRoute({
                          id: st.id,
                          label: st.name,
                          lat: st.lat,
                          lng: st.lng,
                          isSpklu: true,
                        });
                        setActiveSheet(null);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer"
                      style={{ backgroundColor: colors.regen, color: '#041418' }}
                    >
                      Ke Sini
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSheet === 'places' && (
            <div className="space-y-2">
              {savedPlaces.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-xl border flex items-center justify-between gap-2"
                  style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{p.name}</div>
                    <div className="text-[10px]" style={{ color: colors.textMuted }}>{p.category}</div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        addStopAndRoute({ id: p.id, label: p.name, lat: p.lat, lng: p.lng });
                        setActiveSheet(null);
                      }}
                      className="px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer"
                      style={{ backgroundColor: colors.accent, color: '#041418' }}
                    >
                      Rute
                    </button>
                    <button
                      onClick={() => deleteSavedPlace(p.id)}
                      className="p-1 text-red-400 cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSheet === 'notes' && (
            <div className="space-y-2.5">
              <input
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Judul pin lapangan…"
                className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}
              />
              <div className="flex flex-wrap gap-1">
                {['Jalan Rusak', 'Charger Umum', 'Banjir', 'Bengkel EV'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setNoteCategory(cat)}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer"
                    style={{
                      backgroundColor: noteCategory === cat ? `${colors.warning}22` : colors.surfaceElevated,
                      borderColor: noteCategory === cat ? colors.warning : colors.borderSubtle,
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                rows={2}
                placeholder="Catatan lokasi saat ini…"
                className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!noteTitle.trim()) return;
                    addFieldNote({
                      name: noteTitle.trim(),
                      category: noteCategory,
                      note: noteBody.trim() || 'Pin lapangan',
                      lat: center.lat,
                      lng: center.lng,
                    });
                    setNoteTitle('');
                    setNoteBody('');
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer"
                  style={{ backgroundColor: colors.warning, color: '#041418' }}
                >
                  Simpan Pin
                </button>
                <button
                  disabled={fieldNotes.length === 0}
                  onClick={() =>
                    downloadTextFile(
                      'FieldNotes_EV.gpx',
                      exportFieldNotesGpx(fieldNotes),
                      'application/gpx+xml'
                    )
                  }
                  className="px-3 py-2 rounded-xl text-xs font-bold border disabled:opacity-40 cursor-pointer"
                  style={{ borderColor: colors.borderSubtle, color: colors.accentSecondary }}
                >
                  <FileDown size={14} />
                </button>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {fieldNotes.map((n) => (
                  <div
                    key={n.id}
                    className="p-2.5 rounded-xl flex items-start justify-between gap-2"
                    style={{ backgroundColor: colors.surfaceElevated }}
                  >
                    <div>
                      <div className="text-xs font-bold">{n.name}</div>
                      <div className="text-[10px]" style={{ color: colors.textMuted }}>
                        {n.category} • {n.note}
                      </div>
                    </div>
                    <button onClick={() => deleteFieldNote(n.id)} className="text-red-400 cursor-pointer">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const QuickChip: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  colors: ReturnType<typeof useDashboard>['colors'];
}> = ({ icon, label, active, onClick, colors }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border shadow-md backdrop-blur-md cursor-pointer"
    style={{
      backgroundColor: active ? colors.accent : `${colors.surfaceCard}EC`,
      borderColor: active ? colors.accent : colors.borderSubtle,
      color: active ? '#041418' : colors.textPrimary,
    }}
  >
    {icon}
    <span>{label}</span>
  </button>
);
