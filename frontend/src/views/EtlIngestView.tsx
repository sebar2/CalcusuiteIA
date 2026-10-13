import { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Download,
} from 'lucide-react';
import type { ETLUploadResponse } from '../types';
import { apiService } from '../services/api';

interface EtlIngestViewProps {
  onUploadSuccess: () => void;
}

export const EtlIngestView = ({ onUploadSuccess }: EtlIngestViewProps) => {
  const [selectedTemplate, setSelectedTemplate] = useState<'inventario' | 'ordenes_compra' | 'ordenes_venta' | 'opex' | 'crm'>('inventario');
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<ETLUploadResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.csv') && !ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      setErrorMessage('Formato no admitido. Sube únicamente planillas .csv, .xlsx o .xls');
      setSelectedFile(null);
      return;
    }
    const MAX_SIZE = 15 * 1024 * 1024; // 15 MB
    if (file.size > MAX_SIZE) {
      setErrorMessage(`El archivo supera el límite estricto de 15 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB). Por favor comprime o divide la planilla.`);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setErrorMessage(null);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setErrorMessage(null);
    setUploadProgress(20);

    const progressTimer = setInterval(() => {
      setUploadProgress((p) => (p < 85 ? p + 15 : p));
    }, 150);

    try {
      const res = await apiService.uploadSpreadsheet(selectedFile);
      clearInterval(progressTimer);
      setUploadProgress(100);
      setResult(res);
      onUploadSuccess();
    } catch (err: any) {
      clearInterval(progressTimer);
      setUploadProgress(0);
      setErrorMessage(
        err.response?.data?.detail || 'Error al procesar el archivo en el motor ETL'
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Info */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-sky-50 dark:bg-sky-950/50 text-[#00a2e8] rounded-xl">
            <UploadCloud size={22} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Centro de Ingesta Inteligente de Datos (ETL Service)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Carga transacciones de venta, órdenes de compra FOB/CIF, catálogos con fotos o presupuestos corporativos
            </p>
          </div>
        </div>

        {/* Descarga de Plantillas Guía / Modelo (.xlsx) */}
        <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <FileSpreadsheet size={18} className="text-emerald-600 shrink-0" />
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                Plantillas Oficiales Modelo (.xlsx) con Soporte Multimedia
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Archivos estructurados listos para importar con imágenes (.png, .jpg), Incoterms y almacenes
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value as any)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="inventario">📦 Inventario &amp; Catálogo (con Fotos)</option>
              <option value="ordenes_compra">🚢 Órdenes de Compra (FOB/CIF)</option>
              <option value="ordenes_venta">📈 Órdenes de Venta (OV)</option>
              <option value="opex">📊 Presupuestos OPEX</option>
              <option value="crm">🏢 Pipeline CRM / Deals</option>
            </select>

            <a
              href={apiService.getEtlTemplateDownloadUrl(selectedTemplate)}
              download={`plantilla_${selectedTemplate}.xlsx`}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Download size={14} />
              <span>Descargar .xlsx</span>
            </a>
          </div>
        </div>

        {/* Drag and Drop Box */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-6 border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-[#00a2e8] bg-sky-50/50 dark:bg-sky-950/20 scale-[1.005]'
              : selectedFile
              ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/20 dark:bg-emerald-950/20'
              : 'border-slate-300 dark:border-slate-700 hover:border-[#00a2e8] dark:hover:border-[#00a2e8] hover:bg-slate-50 dark:hover:bg-slate-800/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={handleFileInput}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-3">
            <div
              className={`p-3 rounded-full ${
                selectedFile ? 'bg-emerald-100 dark:bg-emerald-950/50 text-[#2ecc71]' : 'bg-sky-50 dark:bg-sky-950/50 text-[#00a2e8]'
              }`}
            >
              {selectedFile ? <FileSpreadsheet size={28} /> : <UploadCloud size={28} />}
            </div>

            {selectedFile ? (
              <div>
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block">
                  {selectedFile.name}
                </span>
                <span className="text-[11px] text-slate-400">
                  {(selectedFile.size / 1024).toFixed(1)} KB • Listo para procesar
                </span>
              </div>
            ) : (
              <div>
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block">
                  Arrastra tu archivo aquí o haz clic para explorar
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Formatos soportados: Microsoft Excel (.xlsx, .xls) o CSV con soporte de imágenes (.png, .jpg)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Upload Button & Progress */}
        {selectedFile && (
          <div className="mt-5 space-y-3">
            {isUploading && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Procesando registros en base de datos...</span>
                  <span className="font-bold font-mono text-slate-900 dark:text-slate-100">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00a2e8] to-[#2fc6f6] transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setResult(null);
                  setErrorMessage(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="inline-flex items-center space-x-2 px-5 py-2 text-xs font-bold text-white bg-[#00a2e8] hover:bg-[#008ecb] rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={14} className={isUploading ? 'animate-spin' : ''} />
                <span>{isUploading ? 'Ingestando...' : 'Iniciar Procesamiento ETL'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start space-x-2 text-xs text-[#e74c3c]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Result Summary */}
        {result && (
          <div className="mt-5 p-4 bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center space-x-2 text-xs font-bold text-[#2ecc71]">
              <CheckCircle2 size={16} />
              <span>{result.message}</span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 pl-6 space-y-1">
              <div>
                Registros procesados exitosamente:{' '}
                <strong className="text-slate-900 dark:text-white font-mono">{result.records_processed}</strong>
              </div>
              {result.errors?.length > 0 && (
                <div className="mt-2 text-amber-700 dark:text-amber-400">
                  <span className="font-semibold">Advertencias / Omitidos:</span>
                  <ul className="list-disc list-inside mt-1 text-[11px]">
                    {result.errors.slice(0, 3).map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Guía de Estructura de Planillas */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-3">
        <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wider">
          Columnas Reconocidas Automáticamente por el Motor ETL:
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">📦 Inventario &amp; Catálogo</span>
            <code className="text-[10px] text-[#00a2e8] block">SKU, Nombre, Categoria</code>
            <code className="text-[10px] text-emerald-600 dark:text-emerald-400 block">Imagen_URL (.png, .jpg)</code>
            <code className="text-[10px] text-slate-500 block">Costo, Precio, Deposito</code>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">🚢 Órdenes Compra (OC)</span>
            <code className="text-[10px] text-[#00a2e8] block">Numero_PO, Proveedor</code>
            <code className="text-[10px] text-amber-600 dark:text-amber-400 block">Incoterm (FOB/CIF)</code>
            <code className="text-[10px] text-slate-500 block">SKU, Cantidad, Costo_Pactado</code>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">📈 Órdenes Venta (OV)</span>
            <code className="text-[10px] text-[#00a2e8] block">Numero_OV, Cliente, RUT</code>
            <code className="text-[10px] text-indigo-500 dark:text-indigo-400 block">Almacen_Despacho, Moneda</code>
            <code className="text-[10px] text-slate-500 block">SKU, Cantidad, Precio_Unitario</code>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">📊 Presupuestos (OPEX)</span>
            <code className="text-[10px] text-[#00a2e8] block">Periodo (2026-Q1)</code>
            <code className="text-[10px] text-slate-500 block">Codigo_Centro_Costo</code>
            <code className="text-[10px] text-slate-500 block">Monto_Presupuestado, Real</code>
          </div>
        </div>
      </div>
    </div>
  );
};
