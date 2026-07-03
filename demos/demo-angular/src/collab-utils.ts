/**
 * Collaboration / broadcast helpers for the Angular demo.
 *
 * Ports the server-safety and default-resolution logic from the React demo
 * (demos/demo-react/main.tsx) verbatim so the two demos behave identically.
 */

// ── Server URL safety ──────────────────────────────────────────────────────
// Only allow auto-connect / auto-upload to trusted hosts when driven from URL
// params. Untrusted servers can still be used via the explicit Share dialog,
// but a crafted ?server=... must never silently fetch or POST a presentation.
const TRUSTED_COLLAB_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

// A deploy can always override the default by setting VITE_COLLAB_SERVER_URL.
const CONFIGURED_SERVER_URL = import.meta.env.VITE_COLLAB_SERVER_URL?.trim() ?? '';

/** Host of the configured relay (if any), so it is trusted for auto-connect. */
function configuredServerHost(): string | null {
	if (!CONFIGURED_SERVER_URL) {
		return null;
	}
	try {
		return new URL(CONFIGURED_SERVER_URL).hostname;
	} catch {
		return null;
	}
}

export function isTrustedServerUrl(url: string): boolean {
	try {
		const u = new URL(url);
		if (u.protocol !== 'ws:' && u.protocol !== 'wss:') {
			return false;
		}
		return TRUSTED_COLLAB_HOSTS.includes(u.hostname) || u.hostname === configuredServerHost();
	} catch {
		return false;
	}
}

function isLocalhostOrigin(): boolean {
	if (typeof window === 'undefined') {
		return true;
	}
	return TRUSTED_COLLAB_HOSTS.includes(window.location.hostname);
}

/**
 * Resolve the default collaboration server URL for the current origin.
 *
 * Returns a configured wss:// relay if one was provided at build time,
 * `ws://localhost:1234` in local dev, or an empty string on a deployed origin
 * with no relay configured (so the Share dialog asks the user for a URL rather
 * than silently pointing at an unreachable / mixed-content socket).
 */
export function resolveDefaultServerUrl(): string {
	if (CONFIGURED_SERVER_URL) {
		return CONFIGURED_SERVER_URL;
	}
	return isLocalhostOrigin() ? 'ws://localhost:1234' : '';
}

/** Stable per-session room id for the Share dialog defaults (sessionStorage-backed). */
export function ensureAutoRoomId(): string {
	const stored = sessionStorage.getItem('pptx-demo-room-id');
	if (stored) {
		return stored;
	}
	const id = `session-${Math.random().toString(36).slice(2, 10)}`;
	sessionStorage.setItem('pptx-demo-room-id', id);
	return id;
}

/** Generate a friendly default display name (platform + random suffix). */
export function generateAutoName(): string {
	const ua = navigator.userAgent;
	let platform = 'User';
	if (ua.includes('Win')) {
		platform = 'Windows';
	} else if (ua.includes('Mac')) {
		platform = 'Mac';
	} else if (ua.includes('Linux')) {
		platform = 'Linux';
	}
	const id = Math.random().toString(36).slice(2, 6);
	return `${platform}-${id}`;
}

/** Random hex colour for a collaboration cursor. */
export function randomCursorColor(): string {
	return `#${Math.floor(Math.random() * 0xffffff)
		.toString(16)
		.padStart(6, '0')}`;
}
