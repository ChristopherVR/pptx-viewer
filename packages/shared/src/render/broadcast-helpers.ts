/**
 * broadcast-helpers.ts: framework-agnostic helpers for the Broadcast dialog,
 * shared by the React, Vue and Angular bindings.
 *
 * A broadcast is a one-way collaboration session: the presenter drives slide
 * navigation and viewers follow along via a shareable link. These helpers
 * cover the testable, framework-agnostic parts of each binding's broadcast
 * dialog: room-id generation, form validation, and the viewer-link builder.
 *
 * No `any`; all regexes use the `/u` flag; no `String.prototype.replaceAll`,
 * no regex named-capture-groups (Angular vendors this source under its
 * ng-packagr lib target). `Math.random` is read inside the generator at call
 * time, never at module eval.
 */

/** Default y-websocket server URL used when no default is supplied. */
export const DEFAULT_BROADCAST_SERVER_URL = 'ws://localhost:1234';

/** Optional seed values for the broadcast start form. */
export interface BroadcastDefaults {
	roomId?: string;
	serverUrl?: string;
}

/** The configuration emitted when a broadcast starts. */
export interface BroadcastConfig {
	roomId: string;
	serverUrl: string;
}

/** Generate a fresh, broadcast-scoped room id (`broadcast-<suffix>`). */
export function generateBroadcastRoomId(): string {
	const suffix = Math.random().toString(36).slice(2, 10);
	return `broadcast-${suffix}`;
}

/**
 * Seed the start form from the (optional) defaults, generating a fresh room id
 * when none is supplied and falling back to the default server URL.
 */
export function seedBroadcastFields(defaults?: BroadcastDefaults): BroadcastConfig {
	return {
		roomId: defaults?.roomId ?? generateBroadcastRoomId(),
		serverUrl: defaults?.serverUrl ?? DEFAULT_BROADCAST_SERVER_URL,
	};
}

/** Whether both required fields are non-blank (after trimming). */
export function canStartBroadcast(fields: BroadcastConfig): boolean {
	return fields.roomId.trim().length > 0 && fields.serverUrl.trim().length > 0;
}

/**
 * Assemble a {@link BroadcastConfig} from the (trimmed) form fields, or `null`
 * when incomplete.
 */
export function buildBroadcastConfig(fields: BroadcastConfig): BroadcastConfig | null {
	if (!canStartBroadcast(fields)) {
		return null;
	}
	return { roomId: fields.roomId.trim(), serverUrl: fields.serverUrl.trim() };
}

/**
 * Build the shareable viewer follow-link for a broadcast. Returns just the
 * room id when no `origin`/`pathname` are available (non-browser environments).
 */
export function buildBroadcastViewerUrl(
	roomId: string,
	serverUrl: string,
	location?: { origin: string; pathname: string },
): string {
	if (!location) {
		return roomId;
	}
	const room = encodeURIComponent(roomId);
	const server = encodeURIComponent(serverUrl);
	return `${location.origin}${location.pathname}?broadcast=${room}&server=${server}`;
}

/** Whether the runtime exposes a usable async clipboard write API. */
export function canUseClipboard(nav: Navigator | undefined): boolean {
	return (
		typeof nav !== 'undefined' &&
		nav.clipboard !== undefined &&
		typeof nav.clipboard.writeText === 'function'
	);
}
