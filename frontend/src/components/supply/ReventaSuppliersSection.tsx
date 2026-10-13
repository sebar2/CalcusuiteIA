import React, { useState, useRef } from 'react';
import {
  Store,
  Download,
  Upload,
  Plus,
  CheckCircle2,
  AlertCircle,
  Edit2,
  X,
} from 'lucide-react';
import { apiService, getStoredUser } from '../../services/api';
import type { SupplierItem, UserRole } from '../../types';
import { ReventaBatchModal } from '../multilocation/ReventaBatchModal';

interface ReventaSuppliersSectionProps {
  uySuppliers: SupplierItem[];
  onDataChanged?: () => void;
  currentRole?: UserRole;
}

export const ReventaSuppliersSection: React.FC<ReventaSuppliersSectionProps> = ({
  uySuppliers,
  onDataChanged,
  currentRole,
}) => {
  const effectiveRole = currentRole || (getStoredUser()?.role as UserRole) || 'controller_admin';
  const canManageCost = effectiveRole === 'controller_admin' || effectiveRole === 'analista_comercial';

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    uySuppliers.length > 0 ? String(uySuppliers[0].id) : ''
  );
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Supplier Modal State
  const [editingSupplier, setEditingSupplier] = useState<SupplierItem | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editRazonSocial, setEditRazonSocial] = useState('');
  const [editRut, setEditRut] = useState('');
  const [editContacto, setEditContacto] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  const selectedSupplier = uySuppliers.find((s) => String(s.id) === selectedSupplierId);

  const handleDownloadTemplate = () => {
    window.location.href = apiService.getReventaTemplateDownloadUrl();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    if (selectedSupplierId) {
      formData.append('supplier_id', selectedSupplierId);
    }

    setIsUploading(true);
    setUploadSuccess(null);
    setUploadErrors([]);

    try {
      const res = await apiService.importReventaExcel(formData);
      setUploadSuccess(`Se importaron ${res.records_imported} lotes de reventa exitosamente.`);
      if (res.errors && res.errors.length > 0) {
        setUploadErrors(res.errors);
      }
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      console.error('Error al importar Excel de reventa:', err);
      setUploadErrors([err.response?.data?.detail || 'Error al procesar el archivo Excel.']);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleOpenEditSupplier = (s: SupplierItem) => {
    setEditingSupplier(s);
    setEditNombre(s.nombre);
    setEditRazonSocial(s.razon_social || '');
    setEditRut(s.rut || '');
    setEditContacto(s.contacto_nombre || '');
    setEditEmail(s.email || '');
    setEditPhone(s.phone || '');
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier) return;
    setIsSavingSupplier(true);
    try {
      await apiService.updateSupplier(editingSupplier.id, {
        nombre: editNombre.trim(),
        razon_social: editRazonSocial.trim() || undefined,
        rut: editRut.trim() || undefined,
        contacto_nombre: editContacto.trim() || undefined,
        email: editEmail.trim() || undefined,
        phone: editPhone.trim() || undefined,
      });
      setEditingSupplier(null);
      if (onDataChanged) onDataChanged();
    } catch (err) {
      console.error('Error al actualizar proveedor:', err);
      alert('No se pudo actualizar el proveedor.');
    } finally {
      setIsSavingSupplier(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <Store size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Proveedores Reventa & Carga Masiva de Catálogo</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                {uySuppliers.length} proveedores plaza
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Selección, edición de proveedores locales y carga de inventario manual o con planilla modelo Excel (.xlsx/.csv).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Botón Descargar Plantilla Modelo */}
          <button
            onClick={handleDownloadTemplate}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all border border-slate-200 dark:border-slate-700 shadow-2xs"
            title="Descargar archivo Excel con columnas y ejemplos de inventario reventa"
          >
            <Download size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span>📥 Plantilla Excel (.xlsx)</span>
          </button>

          {/* Botón Importar Excel / CSV */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm disabled:opacity-50"
          >
            <Upload size={14} />
            <span>{isUploading ? 'Importando...' : 'Subir Excel / CSV'}</span>
          </button>

          {/* Botón Carga Manual */}
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm"
          >
            <Plus size={14} />
            <span>+ Carga Manual Lote</span>
          </button>
        </div>
      </div>

      {/* Alertas de Ingesta Excel */}
      {uploadSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <span>{uploadSuccess}</span>
        </div>
      )}

      {uploadErrors.length > 0 && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs space-y-1">
          <div className="flex items-center space-x-2 font-bold">
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
            <span>Observaciones en la carga:</span>
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {uploadErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Selector y Ficha Rápida del Proveedor de Reventa */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Seleccionar Proveedor de Plaza / Reventa:
          </label>
          <select
            value={selectedSupplierId}
            onChange={(e) => setSelectedSupplierId(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            {uySuppliers.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.nombre} - RUT: {s.rut || 'N/A'} ({s.pais || 'Uruguay'})
              </option>
            ))}
          </select>
        </div>

        {selectedSupplier && (
          <div className="md:col-span-2 flex items-center justify-between bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                  {selectedSupplier.nombre}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                  RUT: {selectedSupplier.rut || 'N/A'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Contacto: <strong>{selectedSupplier.contacto_nombre || 'N/D'}</strong> | Email: {selectedSupplier.email || 'N/D'} | Tel: {selectedSupplier.phone || 'N/D'}
              </p>
            </div>

            <button
              onClick={() => handleOpenEditSupplier(selectedSupplier)}
              className="p-2 text-slate-500 hover:text-purple-600 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
              title="Editar datos del proveedor de reventa"
            >
              <Edit2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Modal Manual Intake */}
      <ReventaBatchModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSuccess={() => {
          if (onDataChanged) onDataChanged();
        }}
        uySuppliers={uySuppliers}
        canManageCost={canManageCost}
      />

      {/* Modal Editar Proveedor */}
      {editingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Editar Proveedor de Reventa
              </h3>
              <button onClick={() => setEditingSupplier(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">RUT</label>
                  <input
                    type="text"
                    value={editRut}
                    onChange={(e) => setEditRut(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Razón Social</label>
                  <input
                    type="text"
                    value={editRazonSocial}
                    onChange={(e) => setEditRazonSocial(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Contacto</label>
                <input
                  type="text"
                  value={editContacto}
                  onChange={(e) => setEditContacto(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingSupplier(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingSupplier}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                >
                  {isSavingSupplier ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
