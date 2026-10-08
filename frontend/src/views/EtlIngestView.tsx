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
  const [selectedTemplate, setSelectedTemplate] = useState<'inventario' | 'opex' | 'crm'>('inventario');
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
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-sky-50 text-[#00a2e8] rounded-xl">
            <UploadCloud size={22} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[#333333]">
              Centro de Ingesta Inteligente de Datos (ETL Service)
            </h3>
            <p className="text-xs text-[#535c69] mt-0.5">
              Carga transacciones históricas de venta, presupuestos comerciales o inventarios multidepósito
            </p>
          </div>
        </div>

        {/* Descarga de Plantillas Guía / Modelo (.xlsx) */}
        <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <FileSpreadsheet size={18} className="text-emerald-600 shrink-0" />
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                Plantillas Modelo Guía (.xlsx)
              </span>
              <span className="text-[11px] text-slate-500">
                Descarga el archivo estructurado con formato corporativo y columnas oficiales
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value as any)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="inventario">📦 Inventario Maestro</option>
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
              ? 'border-[#00a2e8] bg-sky-50/50 scale-[1.005]'
              : selectedFile
              ? 'border-emerald-300 bg-emerald-50/20'
              : 'border-slate-300 hover:border-[#00a2e8] hover:bg-slate-50'
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
                selectedFile ? 'bg-emerald-100 text-[#2ecc71]' : 'bg-sky-50 text-[#00a2e8]'
              }`}
            >
              {selectedFile ? <FileSpreadsheet size={28} /> : <UploadCloud size={28} />}
            </div>

            {selectedFile ? (
              <div>
                <span className="font-bold text-xs text-[#333333] block">
                  {selectedFile.name}
                </span>
                <span className="text-[11px] text-slate-400">
                  {(selectedFile.size / 1024).toFixed(1)} KB • Listo para procesar
                </span>
              </div>
            ) : (
              <div>
                <span className="font-bold text-xs text-[#333333] block">
                  Arrastra tu archivo aquí o haz clic para explorar
                </span>
                <span className="text-[11px] text-[#535c69]">
                  Formatos soportados: Microsoft Excel (.xlsx, .xls) o CSV con coma/punto y coma
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
                <div className="flex justify-between text-xs text-[#535c69]">
                  <span>Procesando registros en base de datos...</span>
                  <span className="font-bold font-mono">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
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
                className="px-4 py-2 text-xs font-semibold text-[#535c69] hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="inline-flex items-center space-x-2 px-5 py-2 text-xs font-bold text-white bg-[#00a2e8] hover:bg-[#008ecb] rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                <RefreshCw size={14} className={isUploading ? 'animate-spin' : ''} />
                <span>{isUploading ? 'Ingestando...' : 'Iniciar Procesamiento ETL'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-xs text-[#e74c3c]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Result Summary */}
        {result && (
          <div className="mt-5 p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center space-x-2 text-xs font-bold text-[#2ecc71]">
              <CheckCircle2 size={16} />
              <span>{result.message}</span>
            </div>
            <div className="text-xs text-slate-600 pl-6 space-y-1">
              <div>
                Registros procesados exitosamente:{' '}
                <strong className="text-[#333333] font-mono">{result.records_processed}</strong>
              </div>
              {result.errors?.length > 0 && (
                <div className="mt-2 text-amber-700">
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
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-3">
        <h4 className="font-bold text-xs text-[#333333] uppercase tracking-wider">
          Columnas Reconocidas Automáticamente por el Motor ETL:
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#535c69]">
          <div className="p-3 bg-[#f5f7f8] rounded-xl border border-slate-200/60">
            <span className="font-bold text-[#333333] block mb-1">📦 Inventario / Stock</span>
            <code className="text-[10px] text-[#00a2e8] block">SKU, Producto, Categoria</code>
            <code className="text-[10px] text-slate-500 block">Stock, Deposito, Transito</code>
            <code className="text-[10px] text-slate-500 block">Lead_Time, Demanda_Diaria</code>
          </div>

          <div className="p-3 bg-[#f5f7f8] rounded-xl border border-slate-200/60">
            <span className="font-bold text-[#333333] block mb-1">💰 Ventas / Transacciones</span>
            <code className="text-[10px] text-[#00a2e8] block">Transaction_ID, SKU</code>
            <code className="text-[10px] text-slate-500 block">Cantidad, Precio_Unitario</code>
            <code className="text-[10px] text-slate-500 block">Costo_Unitario, Fecha</code>
          </div>

          <div className="p-3 bg-[#f5f7f8] rounded-xl border border-slate-200/60">
            <span className="font-bold text-[#333333] block mb-1">📊 Presupuestos (Budgets)</span>
            <code className="text-[10px] text-[#00a2e8] block">Periodo, Tipo (VENTAS/GASTOS)</code>
            <code className="text-[10px] text-slate-500 block">Monto_Presupuestado</code>
            <code className="text-[10px] text-slate-500 block">Monto_Real, Categoria</code>
          </div>
        </div>
      </div>
    </div>
  );
};
