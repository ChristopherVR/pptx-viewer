/**
 * FollowModeBar: presentational control that lists the active remote peers and
 * lets the local user follow one of them (mirroring that peer's active slide)
 * or stop following.
 *
 * Owns no Yjs/network logic: the integrator supplies the remote presence list
 * and the currently-followed clientId (from `useFollowMode`) and handles the
 * `onFollow` callback to drive `followUser(clientId | null)`. Each peer chip
 * shows an initials avatar in the peer's colour; the followed peer is
 * highlighted with a "Stop" affordance. Ported from the Vue `FollowModeBar`.
 *
 * @module collaboration/FollowModeBar
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { UserPresence } from '../../hooks/collaboration/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** First-letter / two-char initials for the avatar chip. */
function getInitials(name: string): string {
	const parts = name.trim().split(/\s+/u);
	if (parts.length >= 2 && parts[0] && parts[parts.length - 1]) {
		return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	}
	return name.slice(0, 2).toUpperCase() || '?';
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FollowModeBarProps {
	/** Active remote collaborators (excludes self). */
	presences: UserPresence[];
	/** The clientId currently being followed, or null. */
	followedClientId: number | null;
	/** Follow the given peer, or `null` to stop following. */
	onFollow: (clientId: number | null) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FollowModeBar({
	presences,
	followedClientId,
	onFollow,
}: FollowModeBarProps): React.ReactElement | null {
	const { t } = useTranslation();

	if (presences.length === 0) {
		return null;
	}

	const followedPeer =
		followedClientId === null
			? null
			: (presences.find((p) => p.clientId === followedClientId) ?? null);

	return (
		<div
			data-testid='follow-mode-bar'
			data-export-ignore='true'
			className='flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/95 px-2.5 py-1.5 text-xs text-foreground shadow-lg'
		>
			<span
				data-testid='follow-status'
				className='inline-flex items-center gap-1.5 whitespace-nowrap text-muted-foreground'
			>
				{followedPeer ? (
					<>
						{t('pptx.followMode.following')}
						<strong className='text-foreground'>{followedPeer.userName}</strong>
						<button
							type='button'
							data-testid='follow-stop'
							onClick={() => onFollow(null)}
							title={t('pptx.followMode.stopFollowing')}
							className='cursor-pointer rounded-md border border-border bg-transparent px-2 py-0.5 text-[11px] text-foreground hover:bg-muted'
						>
							{t('pptx.followMode.stop')}
						</button>
					</>
				) : (
					t('pptx.followMode.followCollaborator')
				)}
			</span>
			<ul className='m-0 flex list-none items-center gap-1.5 p-0'>
				{presences.map((peer) => {
					const isFollowing = peer.clientId === followedClientId;
					return (
						<li key={peer.clientId}>
							<button
								type='button'
								data-testid='follow-peer'
								data-client-id={peer.clientId}
								aria-pressed={isFollowing}
								title={
									isFollowing
										? t('pptx.followMode.stopFollowingUser', { name: peer.userName })
										: t('pptx.followMode.followUser', { name: peer.userName })
								}
								onClick={() => onFollow(isFollowing ? null : peer.clientId)}
								className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-foreground hover:bg-muted ${
									isFollowing ? 'border-primary bg-primary/30' : 'border-transparent bg-muted/60'
								}`}
							>
								<span
									data-testid='follow-avatar'
									className='inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-[10px] font-semibold leading-none text-white'
									style={{ backgroundColor: peer.userColor }}
								>
									{getInitials(peer.userName)}
								</span>
								<span className='max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap'>
									{peer.userName}
								</span>
							</button>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
