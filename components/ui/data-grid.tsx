"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Inbox, Loader2 } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  // Render the cell content for a row.
  render?: (row: T) => ReactNode;
  // Primitive accessor used for sorting when no render/sortValue is provided.
  accessor?: (row: T) => string | number;
  sortValue?: (row: T) => string | number;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
  width?: string;
}

export interface DataGridProps<T> {
  columns: Column<T>[];
  rows: T[];
  // Stable key per row (id by default).
  getRowId?: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  emptyIcon?: ReactNode;
  onRowClick?: (row: T) => void;
  // Per-row action renderer (rendered in a trailing column).
  rowActions?: (row: T) => ReactNode;
  pageSize?: number;
  className?: string;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  // Optional checkbox row-selection (for bulk actions / exporting selected rows).
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: string[]) => void;
}

function defaultRowId<T>(row: T, idx: number): string {
  const id = (row as { id?: unknown }).id;
  return typeof id === "string" && id ? id : String(idx);
}

function getSortValue<T>(col: Column<T>, row: T): string | number {
  if (col.sortValue) return col.sortValue(row);
  if (col.accessor) return col.accessor(row);
  return "";
}

export function DataGrid<T>({
  columns,
  rows,
  getRowId,
  loading = false,
  emptyTitle = "No records found",
  emptyHint,
  emptyIcon,
  onRowClick,
  rowActions,
  pageSize = 0,
  className = "",
  defaultSort,
  selectable = false,
  selectedIds,
  onSelectionChange,
}: DataGridProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(
    defaultSort ?? null,
  );
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const mul = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = getSortValue(col, a);
      const bv = getSortValue(col, b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * mul;
      return String(av).localeCompare(String(bv)) * mul;
    });
  }, [rows, sort, columns]);

  const view = useMemo(() => {
    if (!pageSize) return sorted;
    const start = page * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, pageSize, page]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;

  function toggleSort(col: Column<T>) {
    if (!col.sortable) return;
    setSort((prev) => {
      if (prev?.key === col.key) {
        return { key: col.key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key: col.key, dir: "asc" };
    });
  }

  const colCount = columns.length + (rowActions ? 1 : 0) + (selectable ? 1 : 0);

  const rowKey = (row: T, idx: number) => (getRowId ? getRowId(row) : defaultRowId(row, idx));
  const selection = selectedIds ?? new Set<string>();
  const pageIds = selectable ? view.map((row, idx) => rowKey(row, idx)) : [];
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selection.has(id));

  function toggleRow(id: string) {
    if (!onSelectionChange) return;
    const next = new Set(selection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange([...next]);
  }

  function togglePage() {
    if (!onSelectionChange) return;
    const next = new Set(selection);
    if (allPageSelected) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    onSelectionChange([...next]);
  }

  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur border-b border-slate-200">
              {selectable && (
                <th className="w-10 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    aria-label="Select all on page"
                    checked={allPageSelected}
                    onChange={togglePage}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-navy-900"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                        ? "text-center"
                        : "text-left"
                  } ${col.headerClassName ?? ""}`}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col)}
                      className="inline-flex items-center gap-1 hover:text-navy-900 transition-colors"
                    >
                      {col.header}
                      {sort?.key === col.key ? (
                        sort.dir === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
              {rowActions && (
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100">
                  {Array.from({ length: colCount }).map((__, j) => (
                    <td key={j} className="px-4 py-4">
                      <div className="h-4 w-full max-w-[80%] animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : view.length === 0 ? (
              <tr>
                <td colSpan={colCount}>
                  <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      {emptyIcon ?? <Inbox className="h-6 w-6" />}
                    </div>
                    <p className="text-sm font-medium text-navy-900">{emptyTitle}</p>
                    {emptyHint && <p className="max-w-sm text-xs text-slate-500">{emptyHint}</p>}
                  </div>
                </td>
              </tr>
            ) : (
              view.map((row, idx) => (
                <tr
                  key={rowKey(row, idx)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-slate-100 transition-colors last:border-0 ${
                    selection.has(rowKey(row, idx)) ? "bg-amber-50/60" : ""
                  } ${
                    onRowClick ? "cursor-pointer hover:bg-slate-50" : "hover:bg-slate-50/60"
                  }`}
                >
                  {selectable && (
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label="Select row"
                        checked={selection.has(rowKey(row, idx))}
                        onChange={() => toggleRow(rowKey(row, idx))}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-navy-900"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3.5 text-navy-800 ${
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                            ? "text-center"
                            : "text-left"
                      } ${col.className ?? ""}`}
                    >
                      {col.render ? col.render(row) : (col.accessor?.(row) as ReactNode)}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        {rowActions(row)}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageSize > 0 && !loading && view.length > 0 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="hidden" />
            Page {page + 1} of {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-navy-800 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-navy-800 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
