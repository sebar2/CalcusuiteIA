import { useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronsUpDown, 
  ChevronLeft, 
  ChevronRight,
  Search
} from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSizeDefault?: number;
  emptyMessage?: string;
  searchPlaceholder?: string;
  keyExtractor: (row: T) => string | number;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  pageSizeDefault = 10,
  emptyMessage = 'No se encontraron registros',
  searchPlaceholder = 'Buscar en tabla...',
  keyExtractor,
  onRowClick,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeDefault);

  // Filtrado local en base al término de búsqueda
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some((val) =>
        String(val ?? '').toLowerCase().includes(term)
      )
    );
  }, [data, searchTerm]);

  // Ordenamiento
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortOrder === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredData, sortKey, sortOrder]);

  // Paginación
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else {
        setSortKey(null);
        setSortOrder('asc');
      }
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
      {/* Table Toolbar */}
      <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#f5f7f8] dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 rounded-lg text-[#333333] dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#00a2e8] transition-all"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs text-[#535c69] dark:text-slate-400">
          <span>Mostrar:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-[#f5f7f8] dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 rounded-md px-2 py-1 text-xs text-[#333333] dark:text-slate-200 focus:outline-none focus:border-[#00a2e8]"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span>de {sortedData.length} registros</span>
        </div>
      </div>

      {/* Table Responsive View */}
      <div className="overflow-x-auto max-h-[520px]">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 bg-[#f5f7f8] dark:bg-slate-950 text-[#535c69] dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 z-10">
            <tr>
              {columns.map((col, colIdx) => (
                <th
                  key={col.key ? `th-${col.key}-${colIdx}` : `th-col-${colIdx}`}
                  style={{ width: col.width }}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={`px-4 py-3 select-none ${
                    col.sortable !== false ? 'cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-800/60' : ''
                  }`}
                >
                  <div className="flex items-center space-x-1">
                    <span>{col.header}</span>
                    {col.sortable !== false && (
                      <span className="text-slate-400 dark:text-slate-500">
                        {sortKey === col.key ? (
                          sortOrder === 'asc' ? (
                            <ChevronUp size={13} className="text-[#00a2e8]" />
                          ) : (
                            <ChevronDown size={13} className="text-[#00a2e8]" />
                          )
                        ) : (
                          <ChevronsUpDown size={12} />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 italic"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIdx) => {
                const rowKey = keyExtractor ? keyExtractor(row) : (row.id ?? row.sku ?? `row-${rowIdx}`);
                return (
                  <tr
                    key={`tr-${rowKey}-${rowIdx}`}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`hover:bg-sky-50/40 dark:hover:bg-slate-800/40 transition-colors ${
                      onRowClick ? 'cursor-pointer' : ''
                    }`}
                  >
                    {columns.map((col, colIdx) => (
                      <td key={`td-${rowKey}-${col.key}-${colIdx}`} className="px-4 py-2.5 text-[#333333] dark:text-slate-200">
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer / Pagination */}
      <div className="px-4 py-3 bg-[#f5f7f8] dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-[#535c69] dark:text-slate-400">
        <span>
          Página {currentPage} de {totalPages}
        </span>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
