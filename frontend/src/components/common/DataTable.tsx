import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
}

interface Props<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  loading?: boolean;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (column: string) => void;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No hay registros disponibles.",
  loading,
  sortColumn,
  sortDirection,
  onSort,
}: Props<T>) {
  if (loading) {
    return (
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={columns.length} style={{ textAlign: "center", padding: "24px" }}>
                Cargando...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="empty-state">
        <strong>Sin resultados</strong>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const handleSort = (col: DataTableColumn<T>) => {
    if (col.sortable && onSort) {
      onSort(col.key);
    }
  };

  const sortIndicator = (col: DataTableColumn<T>) => {
    if (!col.sortable || col.key !== sortColumn) return null;
    return <span style={{ marginLeft: 4 }}>{sortDirection === "asc" ? "\u25B2" : "\u25BC"}</span>;
  };

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col)}
                style={col.sortable ? { cursor: "pointer", userSelect: "none" } : undefined}
              >
                {col.label}
                {sortIndicator(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={keyExtractor(row)}>
              {columns.map((col) => (
                <td key={col.key}>
                  {col.render ? col.render(row) : String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
