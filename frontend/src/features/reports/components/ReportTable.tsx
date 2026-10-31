import React, { ReactNode } from 'react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
  render?: (row: T, index: number) => ReactNode;
}

export interface ReportTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  /** Optional row key extractor (default: index) */
  rowKey?: (row: T, index: number) => string | number;
  /** Custom row renderer; if not provided, columns render/row[key] is used */
  renderRow?: (row: T, index: number) => ReactNode;
  /** Optional summary/totals row at footer */
  renderTotals?: () => ReactNode;
  /** Optional extra classes on table container */
  className?: string;
}

export function ReportTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No records match the selected filter criteria.',
  rowKey,
  renderRow,
  renderTotals,
  className = '',
}: ReportTableProps<T>) {
  return (
    <div className={`w-full rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] overflow-hidden ${className}`}>
      {/* 
        ── Horizontal Scroller (Landscape Layout Container) ──
        Ensures wide report tables never squash or wrap contents awkwardly vertically.
      */}
      <div className="w-full overflow-x-auto min-w-full">
        <table className="report-records w-full text-xs text-left text-slate-700 whitespace-nowrap border-collapse">
          {/* Header row with frosted soft background */}
          <thead className="bg-[#FAF8F9]/80 text-slate-700 font-semibold border-b border-slate-100 text-[11px] tracking-wide uppercase">
            <tr>
              {/* Sequential Row Index Column (#) */}
              <th className="py-3 px-3 text-center border-r border-slate-100/80 w-12 text-slate-500">
                #
              </th>
              {columns.map((col) => {
                const alignClass =
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                    ? 'text-center'
                    : 'text-left';

                return (
                  <th
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    className={`py-3 px-3 border-r border-slate-100/80 last:border-r-0 ${alignClass} ${col.className || ''}`}
                  >
                    {col.header}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="py-16 text-center text-slate-400 font-medium"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-8 h-8 rounded-full border-3 border-[#F1DEE3] border-t-[#B82E69] animate-spin mb-1" />
                    <span>Loading report records…</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="py-16 text-center text-slate-400 font-medium italic"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : renderRow ? (
              data.map((row, idx) => (
                <React.Fragment key={rowKey ? rowKey(row, idx) : idx}>
                  {renderRow(row, idx)}
                </React.Fragment>
              ))
            ) : (
              data.map((row, idx) => (
                <tr
                  key={rowKey ? rowKey(row, idx) : idx}
                  className="hover:bg-[#FDF2F5]/30 transition-colors border-b border-slate-100/80 last:border-b-0"
                >
                  {/* Row index (#) */}
                  <td className="py-3 px-3 text-center text-slate-400 font-medium border-r border-slate-100/80 w-12 font-mono">
                    {idx + 1}
                  </td>
                  {columns.map((col) => {
                    const alignClass =
                      col.align === 'right'
                        ? 'text-right font-mono tabular-nums'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left';

                    const val = (row as any)[col.key];

                    return (
                      <td
                        key={col.key}
                        className={`py-3 px-3 border-r border-slate-100/60 last:border-r-0 ${alignClass} ${col.className || ''}`}
                      >
                        {col.render ? col.render(row, idx) : val !== undefined && val !== null ? String(val) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>

          {/* Footer Totals Row (Optional) */}
          {renderTotals && (
            <tfoot className="bg-[#FAF8F9]/90 font-bold text-slate-900 border-t-2 border-slate-200">
              {renderTotals()}
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
