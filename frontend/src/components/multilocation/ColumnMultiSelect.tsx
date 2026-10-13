import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Filter } from 'lucide-react';

export interface MultiSelectOption {
  id: string;
  label: string;
  subLabel?: string;
}

interface ColumnMultiSelectProps {
  label: string;
  allLabel: string;
  options: MultiSelectOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  accentClass?: string;
}

export const ColumnMultiSelect: React.FC<ColumnMultiSelectProps> = ({
  allLabel,
  options,
  selectedIds,
  onChange,
  accentClass = 'text-blue-600 dark:text-blue-400',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const isAllSelected = selectedIds.length === 0 || selectedIds.includes('ALL');

  const handleToggleAll = () => {
    if (isAllSelected) {
      // Unselect all (empty array)
      onChange([]);
    } else {
      // Select all ('ALL')
      onChange(['ALL']);
    }
  };

  const handleToggleItem = (id: string) => {
    if (isAllSelected) {
      // If currently all are selected, selecting one toggles only that one
      onChange([id]);
      return;
    }

    if (selectedIds.includes(id)) {
      const next = selectedIds.filter((item) => item !== id);
      onChange(next.length === 0 ? ['ALL'] : next);
    } else {
      const next = [...selectedIds, id];
      if (next.length === options.length) {
        onChange(['ALL']);
      } else {
        onChange(next);
      }
    }
  };

  // Button title summary
  let displayText = allLabel;
  if (!isAllSelected) {
    if (selectedIds.length === 1) {
      const found = options.find((o) => o.id === selectedIds[0]);
      displayText = found ? found.label : '1 seleccionado';
    } else {
      displayText = `${selectedIds.length} seleccionados`;
    }
  }

  return (
    <div className="relative flex-1" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 dark:text-slate-200 transition-colors shadow-2xs"
        title="Filtrar por uno, varios o todos"
      >
        <span className="truncate pr-1 flex items-center gap-1">
          <Filter size={11} className={`shrink-0 ${accentClass}`} />
          <span className="truncate">{displayText}</span>
        </span>
        <ChevronDown size={12} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 max-h-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col text-xs animate-in fade-in duration-100">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Filtrar Elementos</span>
            <button
              type="button"
              onClick={handleToggleAll}
              className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              {isAllSelected ? 'Desmarcar Todos' : 'Marcar Todos'}
            </button>
          </div>

          <div className="p-1.5 overflow-y-auto max-h-48 space-y-0.5">
            {/* Opción Todas */}
            <label
              className="flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-[11px] font-semibold text-slate-900 dark:text-slate-100"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleAll();
              }}
            >
              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                isAllSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'
              }`}>
                {isAllSelected && <Check size={10} strokeWidth={3} />}
              </div>
              <span>{allLabel}</span>
            </label>

            {/* Opciones individuales */}
            {options.map((opt) => {
              const checked = !isAllSelected && selectedIds.includes(opt.id);
              return (
                <label
                  key={opt.id}
                  className="flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-[11px] text-slate-700 dark:text-slate-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleItem(opt.id);
                  }}
                >
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                    checked || isAllSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'
                  }`}>
                    {(checked || isAllSelected) && <Check size={10} strokeWidth={3} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{opt.label}</div>
                    {opt.subLabel && <div className="text-[9px] text-slate-400 truncate">{opt.subLabel}</div>}
                  </div>
                </label>
              );
            })}
          </div>

          <div className="p-1.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 text-[10px] font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-md transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
