/**
 * Collaboration server-URL safety helpers, ported from the React demo.
 *
 * Only trusted hosts may be auto-connected / auto-uploaded to when the session
 * is driven from URL params. Untrusted servers can still be used via the
 * explicit Share dialog, but a crafted `?server=...` must never silently fetch
 * or POST a presentation.
 */
const TRUSTED_COLLAB_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/**
 * A build-time `VITE_COLLAB_SERVER_URL` names the relay this deploy trusts, so
 * its host joins the allowlist: auto-connect / auto-upload to it is safe even
 * though it is not a loopback host.
 */
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
		const configured = configuredServerHost();
		return TRUSTED_COLLAB_HOSTS.includes(u.hostname) || u.hostname === configured;
	} catch {
		return false;
	}
}

// The demo ships without a public relay, so the default server URL must adapt
// to where the demo is running:
//
//   - Local dev (localhost/127.0.0.1): default to `ws://localhost:1234`, the
//     URL printed by `bun run collab`.
//   - Deployed static host (e.g. GitHub Pages): there is NO server to talk to,
//     and an https:// page cannot open a ws:// (insecure) socket without a
//     mixed-content failure. So we never hard-default to ws://localhost there.
//     Instead we honour a build-time `VITE_COLLAB_SERVER_URL` (a wss:// relay
//     the deploy can configure) and otherwise leave the field blank so the
//     user is prompted to paste their own wss:// server.
const CONFIGURED_SERVER_URL = import.meta.env.VITE_COLLAB_SERVER_URL?.trim() ?? '';

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
 * with no relay configured.
 */
export function resolveDefaultServerUrl(): string {
	if (CONFIGURED_SERVER_URL) {
		return CONFIGURED_SERVER_URL;
	}
	return isLocalhostOrigin() ? 'ws://localhost:1234' : '';
}

/** Generate a stable per-session room id, persisted in sessionStorage. */
export function resolveAutoRoomId(): string {
	const stored = sessionStorage.getItem('pptx-demo-room-id');
	if (stored) {
		return stored;
	}
	const id = `session-${Math.random().toString(36).slice(2, 10)}`;
	sessionStorage.setItem('pptx-demo-room-id', id);
	return id;
}

/** Generate a friendly display name from the platform plus a random suffix. */
export function resolveAutoName(): string {
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

/** Random hex color for a collaboration user cursor. */
export function randomUserColor(): string {
	return `#${Math.floor(Math.random() * 0xffffff)
		.toString(16)
		.padStart(6, '0')}`;
}
