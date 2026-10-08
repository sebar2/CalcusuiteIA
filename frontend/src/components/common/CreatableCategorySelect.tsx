import React, { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown, Check, Loader2, Search } from 'lucide-react';
import { apiService } from '../../services/api';

interface CreatableCategorySelectProps {
  value: string;
  onChange: (categoryName: string) => void;
  categories: string[];
  onCategoryCreated?: (newCategoryName: string) => void;
  className?: string;
  placeholder?: string;
}

export const CreatableCategorySelect: React.FC<CreatableCategorySelectProps> = ({
  value,
  onChange,
  categories,
  onCategoryCreated,
  className = '',
  placeholder = 'Seleccionar o escribir categoría...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [localCategories, setLocalCategories] = useState<string[]>(categories);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCategories = localCategories.filter((cat) =>
    cat.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  const exactMatch = localCategories.some(
    (cat) => cat.toLowerCase() === searchTerm.toLowerCase().trim()
  );

  const handleSelect = (cat: string) => {
    onChange(cat);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleCreate = async () => {
    const cleanName = searchTerm.trim();
    if (!cleanName || isCreating) return;

    setIsCreating(true);
    try {
      const created = await apiService.createCategory({
        nombre: cleanName,
        margen_target_pct: 30.0,
      });

      const newName = created.nombre;
      if (!localCategories.includes(newName)) {
        const updated = [...localCategories, newName];
        setLocalCategories(updated);
      }

      if (onCategoryCreated) {
        onCategoryCreated(newName);
      }

      onChange(newName);
      setSearchTerm('');
      setIsOpen(false);
    } catch (err) {
      console.error('Error creating category:', err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Botón selector principal */}
      <div
        onClick={() => {
          setIsOpen(!isOpen);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-[#333333] dark:text-slate-100 flex items-center justify-between cursor-pointer hover:border-[#00a2e8] transition-colors"
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown size={14} className="text-slate-400 shrink-0 ml-1.5" />
      </div>

      {/* Menú desplegable */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Buscador interno */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center space-x-1.5 bg-[#f8fafc] dark:bg-slate-800/50">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (!exactMatch && searchTerm.trim()) {
                    handleCreate();
                  } else if (filteredCategories.length > 0) {
                    handleSelect(filteredCategories[0]);
                  }
                }
              }}
              placeholder="Buscar o crear categoría..."
              className="w-full bg-transparent text-xs text-[#333333] dark:text-slate-100 focus:outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Lista de categorías filtradas */}
          <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
            {filteredCategories.map((cat) => (
              <div
                key={cat}
                onClick={() => handleSelect(cat)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  value === cat
                    ? 'bg-sky-50 dark:bg-sky-950/40 text-[#00a2e8] font-bold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{cat}</span>
                {value === cat && <Check size={13} className="text-[#00a2e8]" />}
              </div>
            ))}

            {filteredCategories.length === 0 && !searchTerm.trim() && (
              <div className="p-3 text-center text-[11px] text-slate-400">
                No hay categorías disponibles
              </div>
            )}

            {/* Opción de creación al vuelo si no hay match exacto */}
            {searchTerm.trim() && !exactMatch && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={isCreating}
                className="w-full mt-1 p-2 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-[#00a2e8]/30 text-[#00a2e8] dark:text-sky-300 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer transition-all disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Creando categoría...</span>
                  </>
                ) : (
                  <>
                    <Plus size={13} />
                    <span>Crear categoría "{searchTerm.trim()}"</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
