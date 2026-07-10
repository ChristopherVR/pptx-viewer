/**
 * Collaboration demo helpers, ported from demos/demo-vue/src/collab.ts (the
 * pure, framework-agnostic subset). The Svelte demo joins rooms peer-to-peer
 * over serverless WebRTC (y-webrtc + BroadcastChannel), so it needs no relay
 * server: two tabs on the same `?room=` URL sync directly. The trusted-host /
 * websocket-URL machinery from the Vue demo is therefore omitted here.
 */

/**
 * Cryptographically strong base-36 token of `length` characters, a drop-in
 * replacement for the insecure `Math.random().toString(36)` idiom.
 */
function secureRandomToken(length: number): string {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	let out = '';
	for (const b of bytes) {
		out += (b % 36).toString(36);
	}
	return out;
}

/** Generate (and persist, per browser session) a stable room id. */
export function resolveAutoRoomId(): string {
	const stored = sessionStorage.getItem('pptx-demo-room-id');
	if (stored) {
		return stored;
	}
	const id = `session-${secureRandomToken(8)}`;
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
	return `${platform}-${secureRandomToken(4)}`;
}

/** Random hex colour for a collaboration user's presence indicator. */
export function randomUserColor(): string {
	const bytes = new Uint8Array(3);
	crypto.getRandomValues(bytes);
	return `#${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
