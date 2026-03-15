export function formatRelativeTime(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)

  if (diffMin < 1) return "Práve vygenerované"
  if (diffMin === 1) return "Pred 1 minútou"
  if (diffMin < 60) return `Pred ${diffMin} minútami`
  if (diffHr === 1) return "Pred 1 hodinou"
  return `Pred ${diffHr} hodinami`
}
