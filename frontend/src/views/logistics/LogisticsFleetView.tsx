import React, { useState, useEffect } from 'react';
import {
  Truck,
  Users,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { logisticsApi } from '../../services/logisticsApi';
import type { LogisticsDriverItem, LogisticsVehicleItem } from '../../services/logisticsApi';

export const LogisticsFleetView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'vehicles' | 'drivers'>('vehicles');
  const [vehicles, setVehicles] = useState<LogisticsVehicleItem[]>([]);
  const [drivers, setDrivers] = useState<LogisticsDriverItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  // Modals
  const [isDriverModalOpen, setIsDriverModalOpen] = useState<boolean>(false);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState<boolean>(false);

  // Driver Form
  const [driverForm, setDriverForm] = useState({
    nombre: '',
    documento: '',
    telefono: '',
    tipo_licencia: 'CAT_B',
    tipo_relacion: 'FLETERO_TERCERIZADO',
    tarifa_base_viaje: 35.0,
    tarifa_km: 0.85,
  });

  // Vehicle Form
  const [vehicleForm, setVehicleForm] = useState({
    matricula: '',
    tipo_vehiculo: 'FURGON',
    capacidad_kg: 1800.0,
    volumen_m3: 14.5,
    capacidad_pallets: 4,
    driver_id: '' as string | number,
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

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await logisticsApi.createDriver({
        nombre: driverForm.nombre,
        documento: driverForm.documento,
        telefono: driverForm.telefono,
        tipo_licencia: driverForm.tipo_licencia,
        tipo_relacion: driverForm.tipo_relacion,
        tarifa_base_viaje: Number(driverForm.tarifa_base_viaje),
        tarifa_km: Number(driverForm.tarifa_km),
      });
      setIsDriverModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Error al registrar conductor: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await logisticsApi.createVehicle({
        matricula: vehicleForm.matricula,
        tipo_vehiculo: vehicleForm.tipo_vehiculo,
        capacidad_kg: Number(vehicleForm.capacidad_kg),
        volumen_m3: Number(vehicleForm.volumen_m3),
        capacidad_pallets: Number(vehicleForm.capacidad_pallets),
        driver_id: vehicleForm.driver_id ? Number(vehicleForm.driver_id) : undefined,
      });
      setIsVehicleModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Error al registrar vehículo: ${err.response?.data?.detail || err.message}`);
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
                Capacidades volumétricas ($m^3$), tara ($kg$) y gestión de fleteros/cadetes
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsDriverModalOpen(true)}
            className="inline-flex items-center space-x-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Users size={15} />
            <span>+ Conductor / Operario</span>
          </button>
          <button
            onClick={() => setIsVehicleModalOpen(true)}
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
                  <th className="py-3 px-4">Capacidad Carga (kg)</th>
                  <th className="py-3 px-4">Cubicaje (m³)</th>
                  <th className="py-3 px-4">Pallets</th>
                  <th className="py-3 px-4">Conductor Asignado</th>
                  <th className="py-3 px-4 text-center">Estado</th>
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
                          {v.driver_nombre}
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
                  <th className="py-3 px-4">Documento (C.I.)</th>
                  <th className="py-3 px-4">Teléfono</th>
                  <th className="py-3 px-4">Libreta / Licencia</th>
                  <th className="py-3 px-4">Relación Laboral</th>
                  <th className="py-3 px-4">Tarifa Base ($)</th>
                  <th className="py-3 px-4">Tarifa / km ($)</th>
                  <th className="py-3 px-4 text-center">Viajes Hechos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredDrivers.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                      {d.nombre}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                      {d.documento}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {d.telefono}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {d.tipo_licencia}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {d.tipo_relacion.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      ${d.tarifa_base_viaje.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      ${d.tarifa_km.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300">
                        {d.viajes_hechos} entregas
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Alta Conductor */}
      {isDriverModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Users className="text-sky-500" size={18} />
                <span>Registrar Personal / Conductor</span>
              </h2>
              <button
                onClick={() => setIsDriverModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDriver} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Nombre Completo</label>
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
                  <label className="text-xs font-semibold text-slate-600">C.I. / Documento</label>
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
                  <label className="text-xs font-semibold text-slate-600">Teléfono Móvil</label>
                  <input
                    type="text"
                    required
                    placeholder="+598 99 ..."
                    value={driverForm.telefono}
                    onChange={(e) => setDriverForm({ ...driverForm, telefono: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Libreta Licencia</label>
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
                  <label className="text-xs font-semibold text-slate-600">Vínculo</label>
                  <select
                    value={driverForm.tipo_relacion}
                    onChange={(e) => setDriverForm({ ...driverForm, tipo_relacion: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="FLETERO_TERCERIZADO">Fletero Tercerizado</option>
                    <option value="CADETE">Cadete / Delivery</option>
                    <option value="OPERARIO_DEPOSITO">Operario de Depósito</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Tarifa Base ($ / Viaje)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={driverForm.tarifa_base_viaje}
                    onChange={(e) => setDriverForm({ ...driverForm, tarifa_base_viaje: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Tarifa ($ / km)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={driverForm.tarifa_km}
                    onChange={(e) => setDriverForm({ ...driverForm, tarifa_km: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

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
                  className="px-5 py-2 text-xs font-bold text-white bg-[#00a2e8] hover:bg-[#008ecb] rounded-xl cursor-pointer"
                >
                  Guardar Conductor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Alta Vehículo */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Truck className="text-amber-500" size={18} />
                <span>Registrar Unidad Vehicular</span>
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
                  <label className="text-xs font-semibold text-slate-600">Matrícula</label>
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
                  <label className="text-xs font-semibold text-slate-600">Tipo de Vehículo</label>
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
                  <label className="text-xs font-semibold text-slate-600">Capacidad (kg)</label>
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
                  <label className="text-xs font-semibold text-slate-600">Volumen (m³)</label>
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
                  <label className="text-xs font-semibold text-slate-600">Pallets</label>
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
                <label className="text-xs font-semibold text-slate-600">Conductor Habitual</label>
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
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer"
                >
                  Guardar Vehículo
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
