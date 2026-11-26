import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CircleDot, Download, Square, VideoOff } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';

interface MotovlogCamScreenProps {
  onClose: () => void;
}

export const MotovlogCamScreen: React.FC<MotovlogCamScreenProps> = ({ onClose }) => {
  const { colors, effective, gpsState } = useDashboard();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString('id-ID'));

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('id-ID')), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: true })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCamReady(true);
      })
      .catch(() => {
        if (active) {
          setCamError('Kamera tidak tersedia atau izin ditolak. Menampilkan mode pratinjau HUD.');
        }
      });

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  const toggleRecording = () => {
    if (!streamRef.current) return;
    if (!recording) {
      chunksRef.current = [];
      setRecordedUrl(null);
      const rec = new MediaRecorder(streamRef.current);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedUrl(URL.createObjectURL(blob));
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } else {
      recorderRef.current?.stop();
      setRecording(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between overflow-hidden">
      {/* Video Background */}
      {camReady ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-black text-slate-400 p-6 text-center">
          <VideoOff size={40} className="mb-3 opacity-50" />
          <p className="text-sm max-w-md">{camError ?? 'Membuka kamera Motovlog HUD…'}</p>
        </div>
      )}

      {/* Top HUD Overlay */}
      <div className="relative z-10 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-black/60 border border-white/20 cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="px-3.5 py-1.5 rounded-xl bg-black/60 border border-white/20 text-xs font-semibold tnum">
            {clock} • {gpsState.areaName || 'GPS Aktif'}
          </div>
        </div>

        {recording && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/90 text-xs font-bold animate-pulse">
            <CircleDot size={13} /> REC
          </div>
        )}
      </div>

      {/* Bottom Telemetry Overlay + Record Controls */}
      <div className="relative z-10 p-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4 px-5 py-3.5 rounded-2xl bg-black/70 border border-white/15 backdrop-blur-md">
          <div>
            <div className="text-4xl font-extrabold tnum leading-none" style={{ color: colors.accent }}>
              {Math.round(effective.speedKmh ?? 0)}
            </div>
            <div className="text-[10px] font-bold tracking-widest text-slate-400 mt-1">KM/H</div>
          </div>
          <div className="h-10 w-px bg-white/15" />
          <div className="space-y-0.5 text-xs tnum">
            <div>
              SOC:{' '}
              <strong style={{ color: colors.accentSecondary }}>
                {effective.combinedSocPct?.toFixed(0) ?? '--'}%
              </strong>
            </div>
            <div>
              DAYA: <strong>{Math.round(effective.combinedPowerW ?? 0)} W</strong>
            </div>
            <div>
              MODE: <strong>{effective.modeLabel}</strong>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {recordedUrl && (
            <a
              href={recordedUrl}
              download={`Motovlog_EV_${Date.now()}.webm`}
              className="flex items-center gap-1.5 px-4 py-3 rounded-2xl text-xs font-bold"
              style={{ backgroundColor: colors.accent, color: '#041418' }}
            >
              <Download size={15} /> Unduh Video
            </a>
          )}
          <button
            disabled={!camReady}
            onClick={toggleRecording}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold disabled:opacity-40 cursor-pointer"
            style={{
              backgroundColor: recording ? '#EF4444' : '#FFFFFF',
              color: recording ? '#FFFFFF' : '#041418',
            }}
          >
            {recording ? <Square size={15} /> : <CircleDot size={15} />}
            {recording ? 'Stop Rekam' : 'Rekam HUD'}
          </button>
        </div>
      </div>
    </div>
  );
};
