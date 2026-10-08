/**
 * Common frontend utility functions
 */

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(dateStr: string | number | Date): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatMetricValue(val: any): string {
  if (typeof val === "number") {
    return Number.isInteger(val) ? val.toString() : val.toFixed(2);
  }
  if (typeof val === "boolean") {
    return val ? "TRUE" : "FALSE";
  }
  return String(val ?? "-");
}
