/**
 * collaboration-broadcast-follow.ts: the single, framework-agnostic rule for
 * whether the local user should auto-follow a broadcaster's active slide.
 *
 * A "broadcast" session has one presenter that joins with `role: 'owner'`.
 * Auto-follow is one-way: only a local `viewer` is pulled along to the
 * owner's slide. A `collaborator` (two-way editing peer) and the `owner`
 * itself navigate freely and are never yanked.
 *
 * Every binding (React/Vue/Angular/Svelte/Vanilla) must consult this helper
 * instead of hand-rolling the guard, so the policy cannot drift per binding
 * (previously React/Angular gated on `localRole === 'viewer'` while Vue
 * followed the owner regardless of the local role).
 */

import type { CollaborationRole } from '../types';

export interface ShouldAutoFollowBroadcasterInput {
	/** The local user's role in the session (undefined when not in a session). */
	localRole: CollaborationRole | undefined;
	/**
	 * The role of the peer being considered as the broadcaster. Auto-follow
	 * only applies to the session `owner`; pass the candidate peer's role.
	 */
	broadcasterRole: CollaborationRole | undefined;
}

/**
 * True when the local user should auto-follow the given broadcaster's active
 * slide: the local user is a `viewer` and the broadcaster is the `owner`.
 */
export function shouldAutoFollowBroadcaster(input: ShouldAutoFollowBroadcasterInput): boolean {
	return input.localRole === 'viewer' && input.broadcasterRole === 'owner';
}
