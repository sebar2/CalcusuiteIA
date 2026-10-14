import React, { useState, useEffect } from 'react';
import {
  Truck,
  Users,
  Plus,
  Search,
  X,
  Edit2,
  Calendar,
  Check,
} from 'lucide-react';
import { logisticsApi } from '../../services/logisticsApi';
import type { LogisticsDriverItem, LogisticsVehicleItem } from '../../services/logisticsApi';

interface DaySchedule {
  activo: boolean;
  turno: string;
}

const DIAS_SEMANA = [
  { key: 'lunes', label: 'Lunes' },
  { key: 'martes', label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves', label: 'Jueves' },
  { key: 'viernes', label: 'Viernes' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
];

const DEFAULT_SCHEDULE: Record<string, DaySchedule> = {
  lunes: { activo: true, turno: '08:00 - 18:00' },
  martes: { activo: true, turno: '08:00 - 18:00' },
  miercoles: { activo: true, turno: '08:00 - 18:00' },
  jueves: { activo: true, turno: '08:00 - 18:00' },
  viernes: { activo: true, turno: '08:00 - 18:00' },
  sabado: { activo: true, turno: '08:00 - 13:00' },
  domingo: { activo: false, turno: 'Descanso' },
};

const parseSchedule = (raw: any): Record<string, any> => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, any>;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

export const LogisticsFleetView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'vehicles' | 'drivers'>('vehicles');
  const [vehicles, setVehicles] = useState<LogisticsVehicleItem[]>([]);
  const [drivers, setDrivers] = useState<LogisticsDriverItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  // Modals
  const [isDriverModalOpen, setIsDriverModalOpen] = useState<boolean>(false);
  const [editingDriverId, setEditingDriverId] = useState<number | null>(null);

  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState<boolean>(false);
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);

  // Driver Form
  const [driverForm, setDriverForm] = useState({
    nombre: '',
    documento: '',
    telefono: '',
    tipo_licencia: 'CAT_B',
    tipo_relacion: 'FLETERO_TERCERIZADO',
    modalidad_pago: 'VIAJE_KM', // 'VIAJE_KM' | 'POR_HORA' | 'POR_JORNAL'
    tarifa_base_viaje: 35.0,
    tarifa_km: 0.85,
    tarifa_hora: 250.0,
    tarifa_jornal: 2000.0,
    activo: true,
  });

  const [weeklyAvailability, setWeeklyAvailability] = useState<Record<string, DaySchedule>>(DEFAULT_SCHEDULE);

  // Vehicle Form
  const [vehicleForm, setVehicleForm] = useState({
    matricula: '',
    tipo_vehiculo: 'FURGON',
    capacidad_kg: 1800.0,
    volumen_m3: 14.5,
    capacidad_pallets: 4,
    driver_id: '' as string | number,
    activo: true,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [vData, dData] = await Promise.all([
        logisticsApi.getVehicles(),
        logisticsApi.getDrivers(),
      ]);
      setVehicles(vData);
      setDrivers(dData);
    } catch (err) {
      console.error('Error al cargar datos de flota:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers Driver
  const handleOpenCreateDriver = () => {
    setEditingDriverId(null);
    setDriverForm({
      nombre: '',
      documento: '',
      telefono: '',
      tipo_licencia: 'CAT_B',
      tipo_relacion: 'FLETERO_TERCERIZADO',
      modalidad_pago: 'VIAJE_KM',
      tarifa_base_viaje: 35.0,
      tarifa_km: 0.85,
      tarifa_hora: 250.0,
      tarifa_jornal: 2000.0,
      activo: true,
    });
    setWeeklyAvailability(DEFAULT_SCHEDULE);
    setIsDriverModalOpen(true);
  };

  const handleOpenEditDriver = (d: LogisticsDriverItem) => {
    setEditingDriverId(d.id);
    setDriverForm({
      nombre: d.nombre,
      documento: d.documento,
      telefono: d.telefono,
      tipo_licencia: d.tipo_licencia,
      tipo_relacion: d.tipo_relacion,
      modalidad_pago: d.modalidad_pago || (d.tipo_relacion === 'OPERARIO_DEPOSITO' ? 'POR_HORA' : 'VIAJE_KM'),
      tarifa_base_viaje: d.tarifa_base_viaje,
      tarifa_km: d.tarifa_km,
      tarifa_hora: d.tarifa_hora ?? 250.0,
      tarifa_jornal: d.tarifa_jornal ?? 2000.0,
      activo: d.activo,
    });

    const parsedDisp = parseSchedule(d.disponibilidad_semanal);
    const merged: Record<string, DaySchedule> = { ...DEFAULT_SCHEDULE };
    for (const dia of DIAS_SEMANA) {
      if (parsedDisp[dia.key]) {
        merged[dia.key] = {
          activo: !!parsedDisp[dia.key].activo,
          turno: parsedDisp[dia.key].turno || '08:00 - 18:00',
        };
      }
    }
    setWeeklyAvailability(merged);
    setIsDriverModalOpen(true);
  };

  const handleToggleDay = (key: string) => {
    setWeeklyAvailability((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        activo: !prev[key]?.activo,
      },
    }));
  };

  const handleDayShiftChange = (key: string, turno: string) => {
    setWeeklyAvailability((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        turno,
      },
    }));
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const scheduleJson = JSON.stringify(weeklyAvailability);
      const payloadData = {
        nombre: driverForm.nombre,
        documento: driverForm.documento,
        telefono: driverForm.telefono,
        tipo_licencia: driverForm.tipo_licencia,
        tipo_relacion: driverForm.tipo_relacion,
        modalidad_pago: driverForm.modalidad_pago,
        tarifa_base_viaje: Number(driverForm.tarifa_base_viaje),
        tarifa_km: Number(driverForm.tarifa_km),
        tarifa_hora: Number(driverForm.tarifa_hora),
        tarifa_jornal: Number(driverForm.tarifa_jornal),
        disponibilidad_semanal: scheduleJson,
        activo: driverForm.activo,
      };

      if (editingDriverId) {
        await logisticsApi.updateDriver(editingDriverId, payloadData);
      } else {
        await logisticsApi.createDriver(payloadData);
      }
      setIsDriverModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Error al guardar conductor/operario: ${err.response?.data?.detail || err.message}`);
    }
  };

  // Handlers Vehicle
  const handleOpenCreateVehicle = () => {
    setEditingVehicleId(null);
    setVehicleForm({
      matricula: '',
      tipo_vehiculo: 'FURGON',
      capacidad_kg: 1800.0,
      volumen_m3: 14.5,
      capacidad_pallets: 4,
      driver_id: '',
      activo: true,
    });
    setIsVehicleModalOpen(true);
  };

  const handleOpenEditVehicle = (v: LogisticsVehicleItem) => {
    setEditingVehicleId(v.id);
    setVehicleForm({
      matricula: v.matricula,
      tipo_vehiculo: v.tipo_vehiculo,
      capacidad_kg: v.capacidad_kg,
      volumen_m3: v.volumen_m3,
      capacidad_pallets: v.capacidad_pallets,
      driver_id: v.driver_id || '',
      activo: v.activo,
    });
    setIsVehicleModalOpen(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingVehicleId) {
        await logisticsApi.updateVehicle(editingVehicleId, {
          matricula: vehicleForm.matricula,
          tipo_vehiculo: vehicleForm.tipo_vehiculo,
          capacidad_kg: Number(vehicleForm.capacidad_kg),
          volumen_m3: Number(vehicleForm.volumen_m3),
          capacidad_pallets: Number(vehicleForm.capacidad_pallets),
          driver_id: vehicleForm.driver_id ? Number(vehicleForm.driver_id) : undefined,
          activo: vehicleForm.activo,
        });
      } else {
        await logisticsApi.createVehicle({
          matricula: vehicleForm.matricula,
          tipo_vehiculo: vehicleForm.tipo_vehiculo,
          capacidad_kg: Number(vehicleForm.capacidad_kg),
          volumen_m3: Number(vehicleForm.volumen_m3),
          capacidad_pallets: Number(vehicleForm.capacidad_pallets),
          driver_id: vehicleForm.driver_id ? Number(vehicleForm.driver_id) : undefined,
        });
      }
      setIsVehicleModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Error al guardar vehículo: ${err.response?.data?.detail || err.message}`);
    }
  };

  const filteredVehicles = vehicles.filter(
    (v) =>
      v.matricula.toLowerCase().includes(search.toLowerCase()) ||
      v.tipo_vehiculo.toLowerCase().includes(search.toLowerCase()) ||
      (v.driver_nombre && v.driver_nombre.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredDrivers = drivers.filter(
    (d) =>
      d.nombre.toLowerCase().includes(search.toLowerCase()) ||
      d.documento.includes(search) ||
      d.telefono.includes(search)
  );

  const totalCapKg = vehicles.reduce((acc, v) => acc + v.capacidad_kg, 0);
  const totalCapM3 = vehicles.reduce((acc, v) => acc + v.volumen_m3, 0);
  const totalEnTransito = vehicles.filter((v) => v.en_transito).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400">
              <Truck size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Flota & Personal Tercerizado
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Capacidades volumétricas (m³), tara (kg), disponibilidad semanal y tarifas de choferes/cadetes
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleOpenCreateDriver}
            className="inline-flex items-center space-x-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Users size={15} />
            <span>+ Conductor / Operario</span>
          </button>
          <button
            onClick={handleOpenCreateVehicle}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-[#00a2e8] hover:bg-[#008ecb] text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Plus size={16} />
            <span>+ Nueva Unidad Vehicular</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Unidades Registradas
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {vehicles.length}
            </span>
            <span className="text-xs text-emerald-600 font-medium">{totalEnTransito} En Tránsito</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Capacidad Carga Flota
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {(totalCapKg / 1000).toFixed(1)} tn
            </span>
            <span className="text-xs text-slate-400">{totalCapKg.toLocaleString()} kg</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Cubicaje Total
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-sky-600 dark:text-sky-400">
              {totalCapM3.toFixed(1)} m³
            </span>
            <span className="text-xs text-slate-400">Volumen Flota</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Choferes Habilitados
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-violet-600 dark:text-violet-400">
              {drivers.length}
            </span>
            <span className="text-xs text-slate-400">Tercerizados & Cadetes</span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('vehicles')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'vehicles'
                ? 'bg-[#00a2e8] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            🚛 Unidades de Flota ({vehicles.length})
          </button>
          <button
            onClick={() => setActiveTab('drivers')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'drivers'
                ? 'bg-[#00a2e8] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            👤 Choferes & Fleteros ({drivers.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={activeTab === 'vehicles' ? 'Buscar por matrícula, modelo...' : 'Buscar chofer, documento...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Cargando flota...</div>
      ) : activeTab === 'vehicles' ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-3 px-4">Matrícula</th>
                  <th className="py-3 px-4">Tipo de Vehículo</th>
                  <th className="py-3 px-4">Capacidad Carga</th>
                  <th className="py-3 px-4">Cubicaje (m³)</th>
                  <th className="py-3 px-4">Pallets</th>
                  <th className="py-3 px-4">Conductor Asignado</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredVehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {v.matricula}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-sky-700 dark:text-sky-300">
                        {v.tipo_vehiculo.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {v.capacidad_kg.toLocaleString()} kg
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {v.volumen_m3.toFixed(2)} m³
                    </td>
                    <td className="py-3 px-4 font-medium">
                      {v.capacidad_pallets} pallets
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {v.driver_nombre || 'Sin conductor'}
                        </span>
                        {v.driver_telefono && (
                          <span className="text-[10px] text-slate-400">{v.driver_telefono}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {v.en_transito ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 animate-pulse">
                          En Tránsito ({v.orden_activa})
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                          Disponible
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenEditVehicle(v)}
                        className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Editar Vehículo"
                      >
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-3 px-4">Conductor / Operario</th>
                  <th className="py-3 px-4">Documento / Tel</th>
                  <th className="py-3 px-4">Libreta / Vínculo</th>
                  <th className="py-3 px-4">Disponibilidad Semanal</th>
                  <th className="py-3 px-4">Esquema de Pago & Tarifas</th>
                  <th className="py-3 px-4 text-center">Viajes</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredDrivers.map((d) => {
                  const disp = parseSchedule(d.disponibilidad_semanal);
                  const activeDays = DIAS_SEMANA.filter((dia) => disp[dia.key]?.activo);

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center space-x-2">
                          <span>{d.nombre}</span>
                          {!d.activo && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 font-bold">
                              Inactivo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-mono text-slate-700 dark:text-slate-300">{d.documento}</p>
                        <p className="text-[10px] text-slate-400">{d.telefono}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-slate-700 dark:text-slate-300 mr-1.5">
                          {d.tipo_licencia}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {d.tipo_relacion.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {activeDays.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {activeDays.map((dia) => (
                              <span
                                key={dia.key}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50"
                                title={disp[dia.key]?.turno || 'Disponible'}
                              >
                                {dia.label.slice(0, 3)}: {disp[dia.key]?.turno || 'Sí'}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Sin horario definido</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {d.tipo_relacion === 'OPERARIO_DEPOSITO' || d.modalidad_pago === 'POR_HORA' || d.modalidad_pago === 'POR_JORNAL' ? (
                          <div className="flex flex-col space-y-0.5">
                            <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 w-fit">
                              {d.modalidad_pago === 'POR_JORNAL' ? 'Por Jornal' : 'Por Hora'}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {d.modalidad_pago === 'POR_JORNAL'
                                ? `$${(d.tarifa_jornal || 0).toFixed(2)} / jornal`
                                : `$${(d.tarifa_hora || 0).toFixed(2)} / hora`}
                            </span>
                            {(d.tarifa_jornal || 0) > 0 && d.modalidad_pago !== 'POR_JORNAL' && (
                              <span className="text-[10px] text-slate-400">
                                Jornal: ${(d.tarifa_jornal || 0).toFixed(2)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              ${d.tarifa_base_viaje.toFixed(2)} base
                            </span>
                            <span className="text-[10px] text-slate-400">
                              + ${d.tarifa_km.toFixed(2)} / km
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300">
                          {d.viajes_hechos} entregas
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenEditDriver(d)}
                          className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Editar Chofer & Disponibilidad"
                        >
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Conductor / Disponibilidad */}
      {isDriverModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Users className="text-sky-500" size={18} />
                <span>{editingDriverId ? 'Editar Conductor / Operario' : 'Registrar Personal / Conductor'}</span>
              </h2>
              <button
                onClick={() => setIsDriverModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDriver} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Marcelo Fagúndez"
                  value={driverForm.nombre}
                  onChange={(e) => setDriverForm({ ...driverForm, nombre: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">C.I. / Documento</label>
                  <input
                    type="text"
                    required
                    placeholder="4.123.456-7"
                    value={driverForm.documento}
                    onChange={(e) => setDriverForm({ ...driverForm, documento: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Teléfono Móvil (WhatsApp)</label>
                  <input
                    type="text"
                    required
                    placeholder="+598 99 123 456"
                    value={driverForm.telefono}
                    onChange={(e) => setDriverForm({ ...driverForm, telefono: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Libreta / Licencia</label>
                  <select
                    value={driverForm.tipo_licencia}
                    onChange={(e) => setDriverForm({ ...driverForm, tipo_licencia: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="CAT_B">Cat. B (Hasta 4000 kg)</option>
                    <option value="CAT_C">Cat. C (Camiones sin acoplado)</option>
                    <option value="CAT_F">Cat. F (Pesado con acoplado)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Vínculo Laboral</label>
                  <select
                    value={driverForm.tipo_relacion}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDriverForm((prev) => ({
                        ...prev,
                        tipo_relacion: val,
                        modalidad_pago: val === 'OPERARIO_DEPOSITO' ? 'POR_HORA' : prev.modalidad_pago,
                      }));
                    }}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="FLETERO_TERCERIZADO">Fletero Tercerizado (Reparto)</option>
                    <option value="CADETE">Cadete / Delivery Urbano</option>
                    <option value="OPERARIO_DEPOSITO">Operario de Depósito / Picking</option>
                  </select>
                </div>
              </div>

              {/* Modalidad de Liquidación / Pago */}
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Modalidad de Liquidación / Pago</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setDriverForm({ ...driverForm, modalidad_pago: 'VIAJE_KM' })}
                    className={`py-1.5 px-2 text-xs font-semibold rounded-lg border text-center transition-all cursor-pointer ${
                      driverForm.modalidad_pago === 'VIAJE_KM'
                        ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    🚗 Por Viaje / Km
                  </button>
                  <button
                    type="button"
                    onClick={() => setDriverForm({ ...driverForm, modalidad_pago: 'POR_HORA' })}
                    className={`py-1.5 px-2 text-xs font-semibold rounded-lg border text-center transition-all cursor-pointer ${
                      driverForm.modalidad_pago === 'POR_HORA'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    ⏱️ Por Hora ($/h)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDriverForm({ ...driverForm, modalidad_pago: 'POR_JORNAL' })}
                    className={`py-1.5 px-2 text-xs font-semibold rounded-lg border text-center transition-all cursor-pointer ${
                      driverForm.modalidad_pago === 'POR_JORNAL'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    📅 Por Jornal ($/día)
                  </button>
                </div>
              </div>

              {/* Si es Operario de Depósito o pago por Hora / Jornal */}
              {(driverForm.tipo_relacion === 'OPERARIO_DEPOSITO' || driverForm.modalidad_pago === 'POR_HORA' || driverForm.modalidad_pago === 'POR_JORNAL') && (
                <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-200/70 dark:border-indigo-900/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                      Tarifas de Operario de Depósito / Personal Logístico
                    </span>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                      Liquidación activa: {driverForm.modalidad_pago === 'POR_JORNAL' ? 'Jornal' : 'Por Hora'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                        <span>Tarifa por Hora ($ / hr)</span>
                        {driverForm.modalidad_pago === 'POR_HORA' && (
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">Activo</span>
                        )}
                      </label>
                      <input
                        type="number"
                        step="5"
                        placeholder="250"
                        value={driverForm.tarifa_hora}
                        onChange={(e) => setDriverForm({ ...driverForm, tarifa_hora: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                        <span>Tarifa por Jornal ($ / día)</span>
                        {driverForm.modalidad_pago === 'POR_JORNAL' && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Activo</span>
                        )}
                      </label>
                      <input
                        type="number"
                        step="50"
                        placeholder="2000"
                        value={driverForm.tarifa_jornal}
                        onChange={(e) => setDriverForm({ ...driverForm, tarifa_jornal: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Si es Fletero o pago por Viaje/Km */}
              {(driverForm.tipo_relacion !== 'OPERARIO_DEPOSITO' || driverForm.modalidad_pago === 'VIAJE_KM') && (
                <div className="p-3 bg-sky-50/50 dark:bg-sky-950/30 rounded-xl border border-sky-200/70 dark:border-sky-900/50 space-y-2">
                  <span className="text-xs font-bold text-sky-900 dark:text-sky-200">
                    Tarifas de Distribución / Fletero Tercerizado
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Tarifa Base ($ / Viaje)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={driverForm.tarifa_base_viaje}
                        onChange={(e) => setDriverForm({ ...driverForm, tarifa_base_viaje: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Tarifa ($ / km)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={driverForm.tarifa_km}
                        onChange={(e) => setDriverForm({ ...driverForm, tarifa_km: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Matriz de Disponibilidad Semanal */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                    <Calendar size={14} className="text-sky-500" />
                    <span>Disponibilidad Semanal (Lunes a Domingo)</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Tildar días habilitados y turno</span>
                </div>

                <div className="space-y-1.5 pt-1">
                  {DIAS_SEMANA.map((dia) => {
                    const sched = weeklyAvailability[dia.key] || { activo: false, turno: '' };
                    return (
                      <div
                        key={dia.key}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs transition-colors border ${
                          sched.activo
                            ? 'bg-white dark:bg-slate-900 border-sky-200 dark:border-sky-800/60 shadow-2xs'
                            : 'bg-slate-100/50 dark:bg-slate-800/30 border-transparent opacity-60'
                        }`}
                      >
                        <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={sched.activo}
                            onChange={() => handleToggleDay(dia.key)}
                            className="rounded text-sky-600 focus:ring-sky-500"
                          />
                          <span className={`font-semibold ${sched.activo ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'}`}>
                            {dia.label}
                          </span>
                        </label>

                        {sched.activo ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={sched.turno}
                              placeholder="Ej: 08:00 - 18:00 o Turno Tarde"
                              onChange={(e) => handleDayShiftChange(dia.key, e.target.value)}
                              className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 w-44"
                            />
                            <Check size={14} className="text-emerald-500" />
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No disponible</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {editingDriverId && (
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="driver_activo"
                    checked={driverForm.activo}
                    onChange={(e) => setDriverForm({ ...driverForm, activo: e.target.checked })}
                    className="rounded text-sky-600"
                  />
                  <label htmlFor="driver_activo" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Conductor Activo en Operaciones
                  </label>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsDriverModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#00a2e8] hover:bg-[#008ecb] rounded-xl cursor-pointer shadow-sm"
                >
                  {editingDriverId ? 'Actualizar Conductor' : 'Guardar Conductor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Vehículo */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Truck className="text-amber-500" size={18} />
                <span>{editingVehicleId ? 'Editar Unidad Vehicular' : 'Registrar Unidad Vehicular'}</span>
              </h2>
              <button
                onClick={() => setIsVehicleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Matrícula</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: STP-1842"
                    value={vehicleForm.matricula}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, matricula: e.target.value.toUpperCase() })}
                    className="w-full mt-1 px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Tipo de Vehículo</label>
                  <select
                    value={vehicleForm.tipo_vehiculo}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, tipo_vehiculo: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="UTILITARIO">Utilitario Liviano (Fiorino, Kangoo)</option>
                    <option value="FURGON">Furgón Alto (Master, Sprinter)</option>
                    <option value="CAMION_PLATAFORMA">Camión Chasis / Plataforma</option>
                    <option value="SEMI_REMOLQUE">Semi-Remolque Pesado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Capacidad (kg)</label>
                  <input
                    type="number"
                    step="50"
                    required
                    value={vehicleForm.capacidad_kg}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, capacidad_kg: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Volumen (m³)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={vehicleForm.volumen_m3}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, volumen_m3: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Pallets</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={vehicleForm.capacidad_pallets}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, capacidad_pallets: parseInt(e.target.value, 10) || 0 })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Conductor Habitual</label>
                <select
                  value={vehicleForm.driver_id}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, driver_id: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="">-- Sin conductor asignado --</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre} ({d.tipo_licencia})
                    </option>
                  ))}
                </select>
              </div>

              {editingVehicleId && (
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="vehicle_activo"
                    checked={vehicleForm.activo}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, activo: e.target.checked })}
                    className="rounded text-amber-600"
                  />
                  <label htmlFor="vehicle_activo" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Vehículo Activo / Operativo
                  </label>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsVehicleModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer shadow-sm"
                >
                  {editingVehicleId ? 'Actualizar Vehículo' : 'Guardar Vehículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default LogisticsFleetView;
