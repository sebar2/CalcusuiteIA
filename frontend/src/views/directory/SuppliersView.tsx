import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Phone,
  Mail,
  MapPin,
  Plus,
  Search,
  Clock,
  Package,
  Edit2,
  X,
  ExternalLink
} from 'lucide-react';
import api from '../../services/api';
import type { SupplierItem, SupplierProductItem } from '../../types';

export const SuppliersView: React.FC = () => {
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Drawer de SKUs / Catálogo
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierItem | null>(null);

  // Modal Alta / Edición
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierItem | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    rut: '',
    logo_url: '',
    email: '',
    phone: '',
    address: ''
  });
  const [saving, setSaving] = useState<boolean>(false);

  const fetchSuppliers = async (query?: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getSuppliers(query);
      setSuppliers(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al cargar proveedores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSuppliers(search);
  };

  const openCreateModal = () => {
    setEditingSupplier(null);
    setFormData({
      nombre: '',
      rut: '',
      logo_url: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=120&auto=format&fit=crop&q=80',
      email: '',
      phone: '',
      address: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (s: SupplierItem) => {
    setEditingSupplier(s);
    setFormData({
      nombre: s.nombre,
      rut: s.rut || '',
      logo_url: s.logo_url || '',
      email: s.email || '',
      phone: s.phone || '',
      address: s.address || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return;

    try {
      setSaving(true);
      if (editingSupplier) {
        await api.updateSupplier(editingSupplier.id, formData);
      } else {
        await api.createSupplier(formData);
      }
      setIsModalOpen(false);
      await fetchSuppliers(search);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Error al guardar proveedor.');
    } finally {
      setSaving(false);
    }
  };

  // KPIs
  const totalSkus = useMemo(() => {
    return suppliers.reduce((acc, s) => acc + (s.total_skus || 0), 0);
  }, [suppliers]);

  const avgLeadTime = useMemo(() => {
    let allTimes: number[] = [];
    suppliers.forEach((s) => {
      s.productos?.forEach((p) => {
        if (p.lead_time_dias) allTimes.push(p.lead_time_dias);
      });
    });
    if (allTimes.length === 0) return 7;
    return Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length);
  }, [suppliers]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Encabezado y Toolbar Modern SaaS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-900/40 rounded-xl text-amber-600 dark:text-amber-400">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Directorio B2B | Proveedores & Abastecimiento
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Fichas de proveedores estratégicos, lead times de entrega y catálogo de SKUs suministrados.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <form onSubmit={handleSearch} className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o RUT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 w-56 md:w-64"
            />
          </form>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all shadow-amber-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Proveedor</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Proveedores Homologados</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{suppliers.length}</p>
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SKUs en Catálogo</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{totalSkus}</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lead Time Promedio</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{avgLeadTime} días</p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Grid de Proveedores */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-t-transparent mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Cargando directorio de proveedores...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm">
          {error}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400">
          <Truck className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-base font-semibold text-slate-800 dark:text-slate-200">No se encontraron proveedores</p>
          <p className="text-xs mt-1">Registra un nuevo proveedor o asigna proveedores a tus productos de inventario.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {suppliers.map((s) => (
            <div
              key={s.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Cabecera */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={s.logo_url || 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=80&auto=format&fit=crop&q=80'}
                      alt={s.nombre}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=80&auto=format&fit=crop&q=80';
                      }}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm bg-slate-50"
                    />
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-snug group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {s.nombre}
                      </h3>
                      {s.rut && (
                        <span className="inline-block px-2 py-0.5 mt-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          RUT: {s.rut}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => openEditModal(s)}
                    title="Editar proveedor"
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Datos de contacto */}
                <div className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  {s.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <a href={`mailto:${s.email}`} className="truncate hover:text-amber-600 dark:hover:text-amber-400">
                        {s.email}
                      </a>
                    </div>
                  )}
                  {s.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <a href={`tel:${s.phone}`} className="hover:text-amber-600 dark:hover:text-amber-400">
                        {s.phone}
                      </a>
                    </div>
                  )}
                  {s.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{s.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Catálogo y Acción */}
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Líneas Suministradas</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {s.total_skus} {s.total_skus === 1 ? 'producto' : 'productos'}
                  </span>
                </div>

                <button
                  onClick={() => setSelectedSupplier(s)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                >
                  <span>Ver Catálogo</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer Lateral de Catálogo de SKUs */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl p-6 flex flex-col justify-between border-l border-slate-200 dark:border-slate-800 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedSupplier.logo_url || 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=80&auto=format&fit=crop&q=80'}
                    alt={selectedSupplier.nombre}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base">{selectedSupplier.nombre}</h2>
                    <p className="text-xs text-slate-500">Catálogo: {selectedSupplier.total_skus} SKUs</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSupplier(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  Productos Vinculados ({selectedSupplier.productos?.length || 0})
                </h4>

                {(!selectedSupplier.productos || selectedSupplier.productos.length === 0) ? (
                  <p className="text-xs text-slate-500 italic py-4">No hay productos en catálogo asignados a este proveedor.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedSupplier.productos.map((p: SupplierProductItem) => (
                      <div
                        key={p.product_id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={p.imagen_url || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=80&auto=format&fit=crop&q=80'}
                            alt={p.nombre}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=80&auto=format&fit=crop&q=80';
                            }}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 block">
                              {p.sku}
                            </span>
                            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{p.nombre}</p>
                            <span className="text-[11px] text-slate-500">Lead time: {p.lead_time_dias}d</span>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="text-[10px] text-slate-500 block">Costo Ref.</span>
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            ${(p.costo_unitario || 0).toLocaleString('es-CL')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedSupplier(null)}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
              >
                Cerrar Catálogo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Proveedor */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">
                {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre Comercial *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Distribuidora Mayorista SA"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">RUT Proveedor</label>
                <input
                  type="text"
                  placeholder="Ej: 77.102.304-5"
                  value={formData.rut}
                  onChange={(e) => setFormData({ ...formData, rut: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">URL Logo Corporativo</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email de Pedidos</label>
                  <input
                    type="email"
                    placeholder="ventas@proveedor.cl"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    placeholder="+56 2 2345 6789"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Dirección Centro Logístico</label>
                <input
                  type="text"
                  placeholder="Parque Industrial ENEA, Pudahuel"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-sm shadow-amber-500/20 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : editingSupplier ? 'Actualizar Proveedor' : 'Crear Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersView;
