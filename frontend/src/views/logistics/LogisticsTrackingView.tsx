import React, { useState, useEffect } from 'react';
import {
  Truck,
  Navigation,
  Clock,
  BatteryCharging,
  Gauge,
  Phone,
  RotateCw,
  Layers,
  AlertCircle,
  Play,
} from 'lucide-react';
import { logisticsApi } from '../../services/logisticsApi';
import type { LiveFleetMarker } from '../../services/logisticsApi';

export const LogisticsTrackingView: React.FC = () => {
  const [fleet, setFleet] = useState<LiveFleetMarker[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<LiveFleetMarker | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const loadTracking = async () => {
    try {
      setLoading(true);
      const data = await logisticsApi.getLiveTracking();
      setFleet(data);
      if (data.length > 0 && !selectedVehicle) {
        setSelectedVehicle(data[0]);
      }
    } catch (err) {
      console.error('Error al cargar tracking GPS:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracking();
    const interval = setInterval(() => {
      logisticsApi.getLiveTracking().then(setFleet).catch(() => {});
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Simular movimiento GPS en vivo
  const handleSimulateStep = async () => {
    if (!selectedVehicle) return;
    setIsSimulating(true);
    try {
      const nextLat = selectedVehicle.lat + (Math.random() - 0.4) * 0.005;
      const nextLng = selectedVehicle.lng + (Math.random() - 0.4) * 0.005;
      const nextSpeed = Math.floor(30 + Math.random() * 25);
      await logisticsApi.sendTelemetryPing(selectedVehicle.order_id, {
        lat: nextLat,
        lng: nextLng,
        velocidad_kmh: nextSpeed,
        bateria_pct: Math.max(20, selectedVehicle.bateria_pct - 1),
      });
      await loadTracking();
    } catch (err) {
      console.error('Error al simular ping:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Coordenadas bounds para mapa centrado en Montevideo Metropolitano
  // Lat: -34.82 a -34.93 | Lng: -56.25 a -56.00
  const latMin = -34.94;
  const latMax = -34.82;
  const lngMin = -56.25;
  const lngMax = -56.00;

  const projectToMap = (lat: number, lng: number) => {
    const x = ((lng - lngMin) / (lngMax - lngMin)) * 100;
    const y = ((latMax - lat) / (latMax - latMin)) * 100;
    return {
      x: Math.max(5, Math.min(95, x)),
      y: Math.max(5, Math.min(95, y)),
    };
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
              <Navigation size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Ruteo & Tracking GPS en Vivo
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Telemetría en tiempo real, cálculo de ETA y seguimiento de flota 3PL en Montevideo y Canelones
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSimulateStep}
            disabled={isSimulating || !selectedVehicle}
            className="inline-flex items-center space-x-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Play size={14} className="text-emerald-500" />
            <span>Simular Ping GPS Chofer</span>
          </button>

          <button
            onClick={loadTracking}
            className="inline-flex items-center space-x-2 px-3.5 py-2 bg-[#00a2e8] hover:bg-[#008ecb] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Actualizar Telemetría</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Interactive Map + Fleet Status Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Map Visualizer */}
        <div className="lg:col-span-2 bg-slate-950 rounded-2xl border border-slate-800 p-4 shadow-lg flex flex-col justify-between min-h-[520px] relative overflow-hidden">
          {/* Map Header Overlay */}
          <div className="flex items-center justify-between z-10 bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Área Metropolitana de Montevideo & Costa
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              {fleet.length} vehículo(s) activo(s) en distribución
            </span>
          </div>

          {/* SVG Map Canvas */}
          <div className="relative flex-1 w-full my-4 rounded-xl overflow-hidden bg-[#0d1627] border border-slate-800/80">
            {/* Grid Pattern Background */}
            <div
              className="absolute inset-0 opacity-15"
              style={{
                backgroundImage:
                  'radial-gradient(circle, #38bdf8 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />

            {/* Stylized Coastline of Rio de la Plata (Montevideo) */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              {/* Río de la Plata Blue Wave Background */}
              <path
                d="M 0,85 Q 25,78 45,88 T 85,82 L 100,80 L 100,100 L 0,100 Z"
                fill="#03254c"
              />
              {/* Main Arteries (Rambla, Av. Italia, Cno. Maldonado, Ruta 5) */}
              <path
                d="M 5,82 Q 35,76 65,80 T 95,78"
                stroke="#0284c7"
                strokeWidth="1.2"
                strokeDasharray="2,2"
                fill="none"
              />
              <path
                d="M 40,85 L 85,35"
                stroke="#0369a1"
                strokeWidth="1.0"
                fill="none"
              />
              <path
                d="M 40,85 L 45,15"
                stroke="#0369a1"
                strokeWidth="1.0"
                fill="none"
              />
            </svg>

            {/* Hub Depósito Central Calcu (Punto Origen) */}
            <div
              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
              style={{ left: '42%', top: '65%' }}
            >
              <div className="w-6 h-6 rounded-lg bg-sky-500 border-2 border-white shadow-md flex items-center justify-center text-white">
                <Layers size={13} />
              </div>
              <span className="text-[9px] font-bold text-sky-300 bg-slate-900/90 px-1.5 py-0.5 rounded mt-1 border border-sky-800">
                Hub Central 3PL
              </span>
            </div>

            {/* Vehicle Markers */}
            {fleet.map((veh) => {
              const pos = projectToMap(veh.lat, veh.lng);
              const isSelected = selectedVehicle?.order_id === veh.order_id;

              return (
                <div
                  key={veh.order_id}
                  onClick={() => setSelectedVehicle(veh)}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20 group transition-all duration-500"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                >
                  {/* Radar Pulse */}
                  <div className="absolute -inset-2 rounded-full bg-sky-400 opacity-40 animate-ping" />

                  {/* Vehicle Pin */}
                  <div
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-white shadow-lg transition-transform ${
                      isSelected
                        ? 'bg-amber-500 border-white scale-125 ring-4 ring-amber-500/30'
                        : 'bg-[#00a2e8] border-white group-hover:scale-110'
                    }`}
                  >
                    <Truck size={15} />
                  </div>

                  {/* Marker Tooltip */}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-9 whitespace-nowrap bg-slate-900/95 border border-slate-700 text-white rounded-lg px-2 py-1 shadow-md opacity-90 group-hover:opacity-100 flex flex-col items-center pointer-events-none">
                    <span className="text-[10px] font-bold font-mono text-sky-300">
                      {veh.vehicle_matricula} ({veh.velocidad_kmh.toFixed(0)} km/h)
                    </span>
                    <span className="text-[9px] text-slate-300">{veh.driver_nombre.split(' ')[0]} - {veh.client_nombre}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Map Footer Info */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-2">
            <span>Latencia GPS: <b>&lt; 5s</b></span>
            <span>Motor de Cálculo de Rutas: <b>Hojas de Ruta Capilar MVD</b></span>
          </div>
        </div>

        {/* Selected Vehicle Telemetry Card & Stops */}
        <div className="space-y-4">
          {selectedVehicle ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                    Telemetría en Vivo
                  </span>
                  <h3 className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">
                    {selectedVehicle.vehicle_matricula}
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                  En Ruta
                </span>
              </div>

              {/* Driver & Client info */}
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Cliente 3PL:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedVehicle.client_nombre}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Chofer:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedVehicle.driver_nombre}
                  </span>
                </div>
                {selectedVehicle.driver_telefono && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Teléfono:</span>
                    <a
                      href={`tel:${selectedVehicle.driver_telefono}`}
                      className="text-sky-600 dark:text-sky-400 font-semibold flex items-center space-x-1"
                    >
                      <Phone size={12} />
                      <span>{selectedVehicle.driver_telefono}</span>
                    </a>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Orden de Despacho:</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                    {selectedVehicle.numero_orden}
                  </span>
                </div>
              </div>

              {/* Speed, Battery and ETA Metrics */}
              <div className="grid grid-cols-3 gap-2 mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                <div>
                  <Gauge className="mx-auto text-sky-500 mb-1" size={18} />
                  <span className="text-[10px] text-slate-400 uppercase block">Velocidad</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {selectedVehicle.velocidad_kmh.toFixed(0)} km/h
                  </span>
                </div>

                <div>
                  <Clock className="mx-auto text-amber-500 mb-1" size={18} />
                  <span className="text-[10px] text-slate-400 uppercase block">ETA Destino</span>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                    {selectedVehicle.eta_minutos} min
                  </span>
                </div>

                <div>
                  <BatteryCharging className="mx-auto text-emerald-500 mb-1" size={18} />
                  <span className="text-[10px] text-slate-400 uppercase block">Batería</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {selectedVehicle.bateria_pct}%
                  </span>
                </div>
              </div>

              {/* Destination address */}
              <div className="mt-4 p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 text-xs">
                <span className="font-semibold text-blue-900 dark:text-blue-300 block mb-1">
                  Punto de Entrega Acordado:
                </span>
                <p className="text-slate-700 dark:text-slate-300 font-medium">
                  {selectedVehicle.destino_direccion}
                </p>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Ventana: {selectedVehicle.ventana_horaria}</span>
                  <span>Carga: {selectedVehicle.total_bultos} bultos</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <AlertCircle className="mx-auto text-slate-400 mb-2" size={28} />
              <p className="text-xs text-slate-500">Seleccione un vehículo en el mapa para ver su telemetría</p>
            </div>
          )}

          {/* List of active vehicles */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3">
              Unidades en Ruta ({fleet.length})
            </h4>

            <div className="space-y-2">
              {fleet.map((f) => (
                <div
                  key={f.order_id}
                  onClick={() => setSelectedVehicle(f)}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                    selectedVehicle?.order_id === f.order_id
                      ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-200'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Truck size={16} className="text-sky-500" />
                    <div>
                      <p className="font-bold font-mono">{f.vehicle_matricula}</p>
                      <p className="text-[10px] text-slate-400">{f.client_nombre}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      ETA {f.eta_minutos}m
                    </span>
                    <p className="text-[10px] text-slate-400">{f.velocidad_kmh.toFixed(0)} km/h</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default LogisticsTrackingView;
