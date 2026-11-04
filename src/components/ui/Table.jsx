export default function Table({ columns, rows, keyField = "id", empty = "No data." }) {
  if (!rows || rows.length === 0) {
    return <div className="empty-state">{empty}</div>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--wb-color-border)", color: "var(--wb-color-muted)" }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[keyField]}>
              {columns.map((c) => (
                <td key={c.key} style={{ padding: "0.5rem", borderBottom: "1px solid var(--wb-color-border)" }}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
