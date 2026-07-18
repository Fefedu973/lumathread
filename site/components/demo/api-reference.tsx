import { API_REFERENCE } from "@site/data/api-reference";

export function ApiReference() {
  return (
    <div className="space-y-8">
      {API_REFERENCE.map((group) => (
        <div key={group.id} id={`api-${group.id}`} className="scroll-mt-24">
          <h3 className="mb-1 text-sm font-semibold tracking-tight">
            {group.title}
          </h3>
          {group.description ? (
            <p className="mb-3 text-xs text-muted-foreground">
              {group.description}
            </p>
          ) : (
            <div className="mb-3" />
          )}
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Prop</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Default</th>
                  <th className="px-4 py-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.name} className="border-b last:border-b-0">
                    <td className="px-4 py-2.5 align-top font-mono text-xs whitespace-nowrap">
                      {row.name}
                    </td>
                    <td className="max-w-72 px-4 py-2.5 align-top font-mono text-xs text-muted-foreground">
                      {row.type}
                    </td>
                    <td className="px-4 py-2.5 align-top font-mono text-xs text-muted-foreground whitespace-pre-line">
                      {row.defaultValue ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 align-top text-xs text-muted-foreground">
                      {row.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
