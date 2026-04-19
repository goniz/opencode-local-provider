export function trimURL(url: string) {
  return url.trim().replace(/\/+$/, "")
}

export function baseURL(url: string) {
  const next = trimURL(url)
  if (!next) return ""
  return next.endsWith("/v1") ? next : `${next}/v1`
}

export function rootURL(url: string) {
  const next = trimURL(url)
  if (!next) return ""
  return next.endsWith("/v1") ? next.slice(0, -3) : next
}
