export function safeDecodeURIComponent(value) {
  try { return decodeURIComponent(String(value || '')); }
  catch { return String(value || ''); }
}
