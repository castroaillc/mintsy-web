/** A same-origin path from ?next=, or the fallback (never an absolute or protocol-relative URL). */
export function safeNext(value: string | string[] | undefined | null, fallback = "/") {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return fallback;
  return v;
}

export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
