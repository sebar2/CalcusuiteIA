import { useState } from 'react';
import { X, Check, Save, Moon, Sun, Sliders, Cpu, Zap, Activity } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { UserPreferences, EngineMode } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onSave: (updated: Partial<UserPreferences>) => Promise<void>;
}

export const SettingsModal = ({
  isOpen,
  onClose,
  preferences,
  onSave,
}: SettingsModalProps) => {
  const { setTheme: setAppTheme } = useTheme();
  const [theme, setTheme] = useState(preferences.active_theme || 'light_bitrix');
  const [engineMode, setEngineMode] = useState<EngineMode>(preferences.default_engine_mode || 'auto');
  const [userId, setUserId] = useState(preferences.user_id || 'default_user');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSelectTheme = (selected: string) => {
    setTheme(selected);
    setAppTheme(selected === 'dark' ? 'dark' : 'light');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        user_id: userId,
        active_theme: theme,
        default_engine_mode: engineMode,
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 800);
    } catch (err) {
      console.error('Error saving settings', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-[#f5f7f8] dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders size={18} className="text-[#00a2e8]" />
            <h3 className="font-bold text-sm text-[#333333] dark:text-slate-100">Preferencias del Sistema</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs">
          {/* User ID */}
          <div>
            <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1">
              Usuario de Sesión / Perfil
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
            />
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Las preferencias y filtros guardados se sincronizarán con este identificador.
            </p>
          </div>

          {/* Selector de Modo de Inferencia Predeterminado */}
          <div>
            <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1">
              Motor de Inferencia Predeterminado
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setEngineMode('auto')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  engineMode === 'auto'
                    ? 'border-[#00a2e8] bg-sky-50/50 dark:bg-sky-950/40 text-[#00a2e8] font-bold ring-1 ring-[#00a2e8]'
                    : 'border-slate-200 dark:border-slate-700 bg-[#f5f7f8] dark:bg-slate-800 text-[#535c69] dark:text-slate-400'
                }`}
              >
                <Activity size={14} className="mx-auto mb-1 text-[#00a2e8]" />
                <span className="text-[10px] block">Automático</span>
              </button>
              <button
                type="button"
                onClick={() => setEngineMode('heuristic')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  engineMode === 'heuristic'
                    ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold ring-1 ring-amber-400'
                    : 'border-slate-200 dark:border-slate-700 bg-[#f5f7f8] dark:bg-slate-800 text-[#535c69] dark:text-slate-400'
                }`}
              >
                <Zap size={14} className="mx-auto mb-1 text-amber-500" />
                <span className="text-[10px] block">Heurístico</span>
              </button>
              <button
                type="button"
                onClick={() => setEngineMode('force_llm')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  engineMode === 'force_llm'
                    ? 'border-purple-400 bg-purple-50/50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold ring-1 ring-purple-400'
                    : 'border-slate-200 dark:border-slate-700 bg-[#f5f7f8] dark:bg-slate-800 text-[#535c69] dark:text-slate-400'
                }`}
              >
                <Cpu size={14} className="mx-auto mb-1 text-purple-500" />
                <span className="text-[10px] block">IA Local</span>
              </button>
            </div>
          </div>

          {/* Theme Selector */}
          <div>
            <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-2">
              Tema Visual Bitrix24
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSelectTheme('light_bitrix')}
                className={`flex items-center space-x-2 p-3 rounded-xl border text-left transition-all ${
                  theme === 'light_bitrix'
                    ? 'border-[#00a2e8] bg-sky-50/50 dark:bg-sky-950/40 text-[#00a2e8] ring-1 ring-[#00a2e8]'
                    : 'border-slate-200 dark:border-slate-700 bg-[#f5f7f8] dark:bg-slate-800 text-[#535c69] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Sun size={18} className={theme === 'light_bitrix' ? 'text-[#00a2e8]' : 'text-slate-400'} />
                <div>
                  <div className="font-semibold text-xs text-[#333333] dark:text-slate-100">Bitrix Light</div>
                  <div className="text-[10px] text-slate-400">Cyan & Canvas Clean</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTheme('dark')}
                className={`flex items-center space-x-2 p-3 rounded-xl border text-left transition-all ${
                  theme === 'dark'
                    ? 'border-[#00a2e8] bg-sky-50/50 dark:bg-sky-950/40 text-[#00a2e8] ring-1 ring-[#00a2e8]'
                    : 'border-slate-200 dark:border-slate-700 bg-[#f5f7f8] dark:bg-slate-800 text-[#535c69] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Moon size={18} className={theme === 'dark' ? 'text-[#00a2e8]' : 'text-slate-400'} />
                <div>
                  <div className="font-semibold text-xs text-[#333333] dark:text-slate-100">Bitrix Dark</div>
                  <div className="text-[10px] text-slate-400">Carbono Empresarial</div>
                </div>
              </button>
            </div>
          </div>

          {/* Información de sincronización */}
          <div className="p-3 bg-sky-50/60 dark:bg-sky-950/30 rounded-xl border border-sky-100 dark:border-sky-900 text-[11px] text-[#00a2e8] dark:text-sky-300 leading-relaxed">
            💡 <strong>Persistencia Activa</strong>: Las vistas seleccionadas, motor predeterminado y filtros favoritos se almacenan automáticamente en la base de datos relacional vía FastAPI.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#f5f7f8] dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#535c69] dark:text-slate-300 hover:text-[#333333] hover:bg-slate-200/50 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#00a2e8] hover:bg-[#008ecb] rounded-lg shadow-sm transition-all"
          >
            {saveSuccess ? (
              <>
                <Check size={14} />
                <span>¡Guardado!</span>
              </>
            ) : (
              <>
                <Save size={14} />
                <span>{isSaving ? 'Guardando...' : 'Guardar Preferencias'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
