import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * The one admin table.
 *
 * TanStack Table is headless — it owns sorting, filtering, and pagination, and
 * nothing else. The markup below is still the project's own `data-table`, so
 * the admin screens keep the same paper-and-ink surface as everywhere else.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  globalFilter = "",
  pageSize = 12,
  rowClassName,
  emptyMessage = "Nothing to show.",
}: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Search text, owned by the page so it can share one SearchBar. */
  globalFilter?: string;
  pageSize?: number;
  rowClassName?: (row: TData) => string;
  emptyMessage?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const rows = table.getRowModel().rows;
  const pageCount = table.getPageCount();

  return (
    <>
      <div className="table-wrap raised">
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const sortable = header.column.getCanSort();
                  const direction = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        !sortable || !direction
                          ? undefined
                          : direction === "asc"
                            ? "ascending"
                            : "descending"
                      }
                    >
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          className="table-sort"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {direction === "asc" ? (
                            <ArrowUp size={12} />
                          ) : direction === "desc" ? (
                            <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={12} className="table-sort-idle" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="table-empty">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={row.id} className={rowClassName?.(row.original) ?? ""}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Only worth showing once there is more than one page to move between. */}
      {pageCount > 1 && (
        <div className="table-pagination raised">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft size={14} /> Previous
          </button>

          <span className="mono-label">
            PAGE {table.getState().pagination.pageIndex + 1} OF {pageCount}
          </span>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </>
  );
}
