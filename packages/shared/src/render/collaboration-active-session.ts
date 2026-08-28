/**
 * collaboration-active-session.ts: pure view-model assembly for the Share
 * dialog's "active session" view (the connected-users list PowerPoint-style
 * dialogs show while a collaboration room is live).
 *
 * Every binding already projects raw Yjs awareness into `SanitizedPresence[]`
 * before this point (`derivePresenceList` / `createPresenceProjector` in
 * `collaboration-presence.ts` / `collaboration-presence-projector.ts`), so the
 * only thing left to decide is how to turn that plus the local user's own
 * name/colour into an ordered, initials-resolved list. This was previously a
 * React-only helper (`ShareDialogActiveView.tsx`'s local `getInitials`), while
 * Vue/Angular/Svelte/Vanilla had no connected-users list at all - the feature
 * had only ever been built in one of the five bindings.
 *
 * `remoteUsers` takes a minimal structural shape rather than the full
 * `SanitizedPresence`, so a binding whose local presence view-model renames or
 * drops fields (Vue's `RemotePresence` uses `color`/`activeSlide` and carries
 * no `cursorX`/`cursorY`/`lastUpdated`) can pass a small adapter array without
 * a needless intermediate `SanitizedPresence[]` copy; `SanitizedPresence[]`
 * itself still satisfies this shape structurally, so bindings that already
 * carry it (Angular, Svelte, Vanilla) pass it straight through.
 */
/** The fields `buildActiveSessionUsers` needs from a remote collaborator. */
export interface ActiveSessionRemoteUserInput {
	clientId: number | string;
	userName: string;
	userColor: string;
	userAvatar?: string;
	activeSlideIndex: number;
}

/** One row of the active-session connected-users list. */
export interface ActiveSessionUserDescriptor {
	/** `'local'` for the current user, otherwise `String(clientId)`. */
	id: string;
	name: string;
	/** Up to 2 uppercase characters, for the avatar-circle fallback. */
	initials: string;
	color: string;
	avatarUrl?: string;
	isLocal: boolean;
	/** 1-based slide number the remote user is viewing; unset for the local entry. */
	slideNumber?: number;
}

const DEFAULT_LOCAL_COLOR = '#6366f1';

/**
 * Two-letter initials for an avatar-circle fallback: first+last initial for a
 * multi-word name, otherwise the first two characters.
 */
export function getUserInitials(name: string): string {
	const trimmed = name.trim(),
		parts = trimmed.split(/\s+/u).filter(Boolean),
		first = parts[0],
		last = parts[parts.length - 1];
	if (parts.length >= 2 && first && last) {
		return (first[0] + last[0]).toUpperCase();
	}
	return trimmed.slice(0, 2).toUpperCase();
}

export interface BuildActiveSessionUsersParams {
	localUserName: string;
	/**
	 * Explicit override from Options > General > "Initials" (PowerPoint lets a
	 * user type custom initials independent of their display name). Falls back
	 * to `getUserInitials(localUserName)` when unset or blank.
	 */
	localUserInitials?: string;
	/** Falls back to the same default colour React's dialog has always used. */
	localUserColor?: string;
	remoteUsers: readonly ActiveSessionRemoteUserInput[];
}

/**
 * Local user first, then remote users in their existing order - the order
 * every binding's connected-users list has rendered since React's original.
 */
export function buildActiveSessionUsers(
	params: BuildActiveSessionUsersParams,
): ActiveSessionUserDescriptor[] {
	const local: ActiveSessionUserDescriptor = {
			id: 'local',
			name: params.localUserName,
			initials: params.localUserInitials?.trim()
				? params.localUserInitials.trim().slice(0, 2).toUpperCase()
				: getUserInitials(params.localUserName),
			color: params.localUserColor ?? DEFAULT_LOCAL_COLOR,
			isLocal: true,
		},
		remote: ActiveSessionUserDescriptor[] = params.remoteUsers.map((user) => ({
			id: String(user.clientId),
			name: user.userName,
			initials: getUserInitials(user.userName),
			color: user.userColor,
			avatarUrl: user.userAvatar,
			isLocal: false,
			slideNumber: user.activeSlideIndex + 1,
		}));
	return [local, ...remote];
}
