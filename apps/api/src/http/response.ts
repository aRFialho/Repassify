export function ok<T>(data: T, meta: Record<string, unknown> = {}) {
  return { data, meta };
}

export function accepted<T>(data: T, meta: Record<string, unknown> = {}) {
  return { data, meta: { accepted: true, ...meta } };
}
