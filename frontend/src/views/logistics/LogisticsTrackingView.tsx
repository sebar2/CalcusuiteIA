import React, { useState, useEffect, useRef } from 'react';
import {
  Truck,
  Navigation,
  Clock,
  BatteryCharging,
  Phone,
  RotateCw,
  AlertCircle,
  ExternalLink,
  Smartphone,
  MapPin,
  CheckCircle2,
  FileSignature,
  Eraser,
  Radio,
  Gauge,
} from 'lucide-react';
import { logisticsApi } from '../../services/logisticsApi';
import type { LiveFleetMarker, DriverDeliverySheetResponse, LogisticsOrderItem } from '../../services/logisticsApi';

export const LogisticsTrackingView: React.FC = () => {
  const [viewMode, setViewMode] = useState<'dispatcher' | 'driver_app'>('dispatcher');

  // Dispatcher State
  const [fleet, setFleet] = useState<LiveFleetMarker[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<LiveFleetMarker | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Driver App State
  const [activeOrders, setActiveOrders] = useState<LogisticsOrderItem[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [driverSheet, setDriverSheet] = useState<DriverDeliverySheetResponse | null>(null);
  const [loadingSheet, setLoadingSheet] = useState<boolean>(false);

  // Real-time GPS Watch from Driver Mobile
  const [isGpsTransmitting, setIsGpsTransmitting] = useState<boolean>(false);
  const [currentGpsCoord, setCurrentGpsCoord] = useState<{ lat: number; lng: number; speed: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Digital Signature Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [hasSignature, setHasSignature] = useState<boolean>(false);
  const [signerName, setSignerName] = useState<string>('');
  const [isSubmittingSignature, setIsSubmittingSignature] = useState<boolean>(false);
  const [deliveryConfirmed, setDeliveryConfirmed] = useState<boolean>(false);

  // Load Dispatcher tracking
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

  // Load active orders for Driver App
  const loadActiveOrders = async () => {
    try {
      const allOrders = await logisticsApi.getOrders();
      const inRoute = allOrders.filter(
        (o) => o.etapa_kanban === 'EN_DISTRIBUCION' || o.etapa_kanban === 'LISTO_DESPACHO'
      );
      setActiveOrders(inRoute);
      if (inRoute.length > 0 && !selectedOrderId) {
        setSelectedOrderId(inRoute[0].id);
      }
    } catch (err) {
      console.error('Error al cargar órdenes de ruta:', err);
    }
  };

  useEffect(() => {
    loadTracking();
    loadActiveOrders();
    const interval = setInterval(() => {
      logisticsApi.getLiveTracking().then(setFleet).catch(() => {});
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // When selected order changes in Driver App, fetch sheet
  useEffect(() => {
    if (!selectedOrderId) {
      setDriverSheet(null);
      return;
    }
    const fetchSheet = async () => {
      try {
        setLoadingSheet(true);
        setDeliveryConfirmed(false);
        const sheet = await logisticsApi.getDriverSheet(selectedOrderId);
        setDriverSheet(sheet);
        setSignerName(sheet.contacto_receptor_nombre || '');
      } catch (err) {
        console.error('Error al cargar hoja de ruta del conductor:', err);
      } finally {
        setLoadingSheet(false);
      }
    };
    fetchSheet();
  }, [selectedOrderId]);

  // Clean up GPS watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Real Mobile GPS Transmission Handlers
  const toggleGpsTransmission = () => {
    if (isGpsTransmitting) {
      // Stop watch
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsGpsTransmitting(false);
      setGpsError(null);
    } else {
      if (!navigator.geolocation) {
        setGpsError('La geolocalización no está soportada en este navegador/dispositivo.');
        return;
      }
      if (!selectedOrderId) {
        alert('Seleccione una orden para transmitir telemetría');
        return;
      }

      setGpsError(null);
      setIsGpsTransmitting(true);

      watchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude, speed } = position.coords;
          const speedKmh = speed ? speed * 3.6 : 35.0;
          setCurrentGpsCoord({ lat: latitude, lng: longitude, speed: speedKmh });

          try {
            // Get device battery if supported
            let batPct = 85;
            if ('getBattery' in navigator) {
              const battery: any = await (navigator as any).getBattery();
              batPct = Math.round(battery.level * 100);
            }

            await logisticsApi.sendTelemetryPing(selectedOrderId, {
              lat: latitude,
              lng: longitude,
              velocidad_kmh: speedKmh,
              bateria_pct: batPct,
            });
            // Refresh dispatcher view
            loadTracking();
          } catch (err) {
            console.error('Error al enviar telemetría móvil:', err);
          }
        },
        (error) => {
          console.warn('Error de GPS:', error.message);
          setGpsError(`Error GPS: ${error.message}. Verifique permisos de ubicación.`);
          setIsGpsTransmitting(false);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 10000,
        }
      );
    }
  };

  // Canvas Signature Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasSignature(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleConfirmDelivery = async () => {
    if (!selectedOrderId) return;
    if (!hasSignature) {
      alert('El receptor debe estampar su firma táctil para dar conformidad de entrega.');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      setIsSubmittingSignature(true);
      const signatureBase64 = canvas.toDataURL('image/png');
      await logisticsApi.signDelivery(selectedOrderId, {
        firma_digital_base64: signatureBase64,
        aclaracion: signerName || 'Receptor Conforme',
      });

      // Stop GPS watch if active
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        setIsGpsTransmitting(false);
      }

      setDeliveryConfirmed(true);
      loadActiveOrders();
      loadTracking();
      alert('✅ ¡Entrega confirmada con éxito!\nFirma digital archivada y orden movida a "Entregado con Conformidad".');
    } catch (err: any) {
      alert(`Error al registrar firma: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsSubmittingSignature(false);
    }
  };

  // Coordenadas bounds para mapa centrado en Montevideo Metropolitano
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
      {/* Header with View Mode Switcher */}
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
                Telemetría en tiempo real desde el móvil del chofer, Google Maps Turn-by-Turn y firma digital
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setViewMode('dispatcher')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'dispatcher'
                ? 'bg-white dark:bg-slate-900 text-[#00a2e8] shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            🖥️ Mapa Central (Despachante)
          </button>
          <button
            onClick={() => setViewMode('driver_app')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              viewMode === 'driver_app'
                ? 'bg-white dark:bg-slate-900 text-purple-600 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Smartphone size={14} />
            <span>📱 Modo Conductor (Móvil / PWA)</span>
          </button>
        </div>
      </div>

      {viewMode === 'driver_app' ? (
        /* ========================================================================= */
        /*                           MODO CONDUCTOR (PWA MÓVIL)                      */
        /* ========================================================================= */
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Active Order Selector */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase block mb-1.5">
              Seleccionar Despacho Asignado
            </label>
            {activeOrders.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No hay órdenes activas en ruta en este momento.</p>
            ) : (
              <select
                value={selectedOrderId || ''}
                onChange={(e) => setSelectedOrderId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {activeOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.numero_orden} - {o.client_nombre} ({o.total_bultos} bultos) - {o.destino_direccion}
                  </option>
                ))}
              </select>
            )}
          </div>

          {loadingSheet ? (
            <div className="p-12 text-center text-xs text-slate-400">Cargando hoja de ruta móvil...</div>
          ) : driverSheet ? (
            <div className="space-y-4">
              {/* Order Info Card */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
                <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/70 px-2 py-0.5 rounded-full uppercase">
                      Hoja de Entrega Digital
                    </span>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                      {driverSheet.numero_orden}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">{driverSheet.client_nombre}</p>
                  </div>
                  {driverSheet.codigo_qr && (
                    <div className="text-right">
                      <span className="font-mono text-[10px] text-slate-400 block">QR de Remito:</span>
                      <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                        {driverSheet.codigo_qr}
                      </span>
                    </div>
                  )}
                </div>

                {/* Destination & Recipient Phone */}
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Punto de Descarga:</span>
                    <p className="font-bold text-slate-800 dark:text-slate-200 flex items-start space-x-1.5 mt-0.5">
                      <MapPin size={15} className="text-purple-500 shrink-0 mt-0.5" />
                      <span>{driverSheet.direccion_completa}</span>
                    </p>
                    {driverSheet.branch_nombre && (
                      <p className="text-[11px] text-purple-600 dark:text-purple-400 pl-5 font-semibold">
                        Sucursal: {driverSheet.branch_nombre}
                      </p>
                    )}
                  </div>

                  {driverSheet.contacto_receptor_telefono && (
                    <div className="pt-1">
                      <a
                        href={`tel:${driverSheet.contacto_receptor_telefono}`}
                        className="inline-flex items-center space-x-2 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl font-bold text-xs transition-colors cursor-pointer w-full justify-center"
                      >
                        <Phone size={14} />
                        <span>
                          Llamar Receptor: {driverSheet.contacto_receptor_nombre || 'Contacto'} ({driverSheet.contacto_receptor_telefono})
                        </span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Package Metrics */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                    <span className="text-[10px] text-slate-400 block uppercase">Bultos</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {driverSheet.total_bultos}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                    <span className="text-[10px] text-slate-400 block uppercase">Peso Total</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {driverSheet.total_kg} kg
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                    <span className="text-[10px] text-slate-400 block uppercase">Volumen</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {driverSheet.total_m3.toFixed(2)} m³
                    </span>
                  </div>
                </div>

                {/* Navigation Button (Native Google Maps App Deep-Link) */}
                <div className="pt-2">
                  <a
                    href={driverSheet.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-2 w-full py-3 bg-[#00a2e8] hover:bg-[#008ecb] text-white rounded-xl text-xs font-bold shadow-md transition-transform active:scale-98 cursor-pointer"
                  >
                    <ExternalLink size={16} />
                    <span>Abrir Navegación Turn-by-Turn en Google Maps</span>
                  </a>
                  <p className="text-[10px] text-slate-400 text-center mt-1">
                    Abre la aplicación nativa de Google Maps con la mejor ruta en tiempo real (100% gratuito)
                  </p>
                </div>
              </div>

              {/* Real Mobile GPS Transmitter Box */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Radio className={isGpsTransmitting ? 'text-emerald-500 animate-pulse' : 'text-slate-400'} size={20} />
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Transmisor GPS Celular en Vivo
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Envía la ubicación GPS del móvil directamente a la central
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={toggleGpsTransmission}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                      isGpsTransmitting
                        ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950/70 dark:text-rose-300'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {isGpsTransmitting ? 'Detener GPS' : 'Iniciar GPS en Vivo'}
                  </button>
                </div>

                {isGpsTransmitting && currentGpsCoord && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                    <p className="font-bold flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping mr-1"></span>
                      <span>Transmitiendo señal GPS cada 3 segundos</span>
                    </p>
                    <p className="font-mono text-[11px]">
                      Latitud: {currentGpsCoord.lat.toFixed(6)} | Longitud: {currentGpsCoord.lng.toFixed(6)}
                    </p>
                    <p className="text-[11px]">
                      Velocidad estimada: <b>{currentGpsCoord.speed.toFixed(0)} km/h</b>
                    </p>
                  </div>
                )}

                {gpsError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300">
                    {gpsError}
                  </div>
                )}
              </div>

              {/* Digital Signature on Touch Screen */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
                <div className="flex items-center space-x-2">
                  <FileSignature size={18} className="text-purple-600" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Conformidad y Firma del Receptor
                  </h3>
                </div>

                {deliveryConfirmed ? (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-600" />
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                      ¡Entrega Finalizada y Firmada!
                    </p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      La orden ha sido actualizada a "Entregado con Conformidad".
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Nombre / Aclaración de quien recibe:
                      </label>
                      <input
                        type="text"
                        required
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        placeholder="Ej: Marcelo García (Encargado)"
                        className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          Firme en el recuadro con el dedo:
                        </label>
                        <button
                          type="button"
                          onClick={clearSignature}
                          className="text-[10px] text-rose-600 hover:underline flex items-center space-x-1 cursor-pointer"
                        >
                          <Eraser size={11} />
                          <span>Borrar firma</span>
                        </button>
                      </div>

                      <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950">
                        <canvas
                          ref={canvasRef}
                          width={480}
                          height={160}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                          className="w-full h-36 touch-none cursor-crosshair bg-white dark:bg-slate-950"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isSubmittingSignature || !hasSignature}
                      onClick={handleConfirmDelivery}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                    >
                      {isSubmittingSignature ? 'Registrando Entrega...' : 'Confirmar Entrega y Registrar Firma'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs text-slate-400">
              Seleccione una orden para ver la hoja de ruta
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /*                       MONITOR CENTRAL (DESPACHANTE)                       */
        /* ========================================================================= */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map canvas */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Mapa de Flota en Movimiento (Montevideo & Canelones)
                  </h3>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={loadTracking}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Actualizar pines GPS"
                  >
                    <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Map surface visual */}
              <div className="relative mt-4 w-full h-[460px] bg-slate-900 rounded-xl overflow-hidden border border-slate-800 select-none shadow-inner">
                {/* SVG Grid lines representing city avenues */}
                <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#38bdf8" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>

                {/* Base Depot Icon */}
                <div
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none z-10"
                  style={{ left: '50%', top: '55%' }}
                >
                  <div className="w-8 h-8 rounded-full bg-sky-500/20 border-2 border-sky-400 flex items-center justify-center mx-auto text-xs shadow-lg">
                    🏢
                  </div>
                  <span className="text-[10px] font-bold text-sky-300 bg-slate-900/90 px-1.5 py-0.5 rounded shadow mt-1 inline-block">
                    Centro Distribución Calcu 3PL
                  </span>
                </div>

                {/* Live Vehicle Pins */}
                {fleet.map((marker) => {
                  const pos = projectToMap(marker.lat, marker.lng);
                  const isSelected = selectedVehicle?.order_id === marker.order_id;

                  return (
                    <div
                      key={marker.order_id}
                      onClick={() => setSelectedVehicle(marker)}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-700 z-20 group"
                      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    >
                      {/* Pulse circle */}
                      <span className="absolute -inset-1 rounded-full bg-emerald-400 opacity-60 animate-ping"></span>

                      {/* Pin body */}
                      <div
                        className={`relative w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-transform ${
                          isSelected
                            ? 'bg-[#00a2e8] text-white scale-125 ring-4 ring-sky-300/60'
                            : 'bg-emerald-600 text-white hover:scale-110'
                        }`}
                      >
                        <Truck size={15} />
                      </div>

                      {/* Floating tooltip */}
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-9 hidden group-hover:block bg-slate-900 text-white text-[10px] rounded-lg px-2 py-1 whitespace-nowrap border border-slate-700 shadow-xl z-30">
                        <p className="font-bold">{marker.vehicle_matricula} ({marker.driver_nombre})</p>
                        <p className="text-slate-400">{marker.client_nombre} | ETA: {marker.eta_minutos}m</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Frecuencia de telemetría: 6s | Enlace a Google Maps activo</span>
              </span>
              <span>{fleet.length} móviles en distribución</span>
            </div>
          </div>

          {/* Telemetry sidebar */}
          <div className="space-y-4">
            {selectedVehicle ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
                <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-sky-600 bg-sky-50 dark:bg-sky-950/70 px-2 py-0.5 rounded-full uppercase">
                      Despacho en Tránsito
                    </span>
                    <h3 className="text-base font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
                      {selectedVehicle.vehicle_matricula}
                    </h3>
                    <p className="text-xs text-slate-500">{selectedVehicle.driver_nombre}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#00a2e8] block">
                      {selectedVehicle.numero_orden}
                    </span>
                    <span className="text-[10px] text-slate-400">{selectedVehicle.client_nombre}</span>
                  </div>
                </div>

                {/* Live indicators */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                    <Gauge className="mx-auto text-sky-500 mb-1" size={18} />
                    <span className="text-[10px] text-slate-400 uppercase block">Velocidad</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {selectedVehicle.velocidad_kmh.toFixed(0)} km/h
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                    <Clock className="mx-auto text-amber-500 mb-1" size={18} />
                    <span className="text-[10px] text-slate-400 uppercase block">ETA Destino</span>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                      {selectedVehicle.eta_minutos} min
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                    <BatteryCharging className="mx-auto text-emerald-500 mb-1" size={18} />
                    <span className="text-[10px] text-slate-400 uppercase block">Batería</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {selectedVehicle.bateria_pct}%
                    </span>
                  </div>
                </div>

                {/* Destination address */}
                <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 text-xs">
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

                {/* Google Maps External Link */}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${selectedVehicle.lat},${selectedVehicle.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-1.5 w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <ExternalLink size={14} />
                  <span>Ver Coordenadas en Google Maps</span>
                </a>
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
      )}
    </div>
  );
};
export default LogisticsTrackingView;
