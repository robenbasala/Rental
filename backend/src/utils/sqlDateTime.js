/**
 * HTML time inputs often send "HH:mm". Tedious sql.Time rejects "" and some formats.
 * Returns "HH:mm:ss" or null if invalid / empty.
 */
export function normalizeSqlTime(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hh = String(Number(m[1])).padStart(2, "0");
  const mm = String(Number(m[2])).padStart(2, "0");
  const ss = m[3] != null ? String(Number(m[3])).padStart(2, "0") : "00";
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] != null ? Number(m[3]) : 0;
  if (h < 0 || h > 23 || min < 0 || min > 59 || sec < 0 || sec > 59) return null;
  return `${hh}:${mm}:${ss}`;
}

/** Expect YYYY-MM-DD from date input */
export function normalizeSqlDate(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return s;
}
