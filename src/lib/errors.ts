// Shared humanization for backend error payloads.  Used by ConfigPage (preview
// validation), ExecutePage (execute failures), and the run-history pages.

const FIELD_LABELS: Record<string, string> = {
  indeed_publisher_name: "Publisher Name",
  comparison_entity_id: "Comparison Entity",
  indeed_metric: "Metric",
  match_pct: "Match %",
  entity_id: "Entity",
  client_id: "Client ID",
  value: "Value",
  start_date: "Start Date",
  end_date: "End Date",
  label: "Label",
  config: "Config",
};

export function humanizeFieldName(name: string): string {
  return FIELD_LABELS[name] ?? name.replace(/_/g, " ");
}

export function humanizeError(e: any): string {
  const detail = e?.detail;

  if (Array.isArray(detail)) {
    const lines = detail.map((err: any) => {
      const rawMsg: string = err?.msg ?? "Validation error";
      const loc: any[] = Array.isArray(err?.loc) ? err.loc : [];

      const cleaned = rawMsg.replace(/^(Value error|Assertion error),\s*/i, "");

      const missingMatch = cleaned.match(/^INDEED goal requires (.+?) to be set$/i);
      if (missingMatch) {
        const fields = missingMatch[1]
          .split(",")
          .map((s: string) => humanizeFieldName(s.trim()))
          .join(", ");
        return `Add ${fields} for the INDEED goal.`;
      }

      if (/comparison_entity_id must differ from/i.test(cleaned)) {
        return "INDEED Comparison Entity must be a different client id than your Client ID.";
      }

      if (/looks truncated/i.test(cleaned)) {
        return "INDEED Comparison Entity looks truncated — paste the full 36-character UUID.";
      }

      const fieldPath = loc.filter((p) => typeof p === "string" && p !== "body");
      const field = fieldPath.length
        ? humanizeFieldName(String(fieldPath[fieldPath.length - 1]))
        : null;
      return field ? `${field}: ${cleaned}` : cleaned;
    });
    return Array.from(new Set(lines)).join("\n");
  }

  if (typeof detail === "string") return detail;
  if (typeof e?.message === "string") return e.message;
  return JSON.stringify(detail ?? e, null, 2);
}

/** Humanize an error from /dm/execute, including the extreme-markup gate. */
export function humanizeExecuteError(e: any): string {
  const detail = e?.detail;
  if (
    detail &&
    typeof detail === "object" &&
    !Array.isArray(detail) &&
    typeof (detail as any).message === "string" &&
    Array.isArray((detail as any).cells_requiring_confirmation)
  ) {
    const cells = (detail as any).cells_requiring_confirmation as Array<{
      publisher_id: string;
      date: string;
      entity_id: string;
      markup_new: number;
    }>;
    const first = cells
      .slice(0, 3)
      .map((c) => `${c.entity_id}/${c.publisher_id} on ${c.date} (markup ${c.markup_new})`)
      .join("; ");
    const more = cells.length > 3 ? `, +${cells.length - 3} more` : "";
    return `Extreme negative markup detected on ${cells.length} cell(s): ${first}${more}. Re-run with "Confirm extreme markup" enabled if you intend to proceed.`;
  }
  return humanizeError(e);
}
