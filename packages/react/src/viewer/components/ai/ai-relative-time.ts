/** Compact relative-time formatting for chat history rows ("2m", "3h", "5d"). */
export function relativeTime(from: number, now: number = Date.now()): string {
	const seconds = Math.max(0, Math.round((now - from) / 1000));
	if (seconds < 45) {
		return 'just now';
	}
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) {
		return `${minutes}m ago`;
	}
	const hours = Math.round(minutes / 60);
	if (hours < 24) {
		return `${hours}h ago`;
	}
	const days = Math.round(hours / 24);
	if (days < 7) {
		return `${days}d ago`;
	}
	const weeks = Math.round(days / 7);
	return `${weeks}w ago`;
}
