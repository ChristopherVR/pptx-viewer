/**
 * follow-mode-bar.component.ts: Angular port of the Vue `FollowModeBar.vue`.
 *
 * Selector: `pptx-follow-mode-bar`
 *
 * Lists the active remote peers and lets the local user follow one of them
 * (mirroring that peer's active slide) or stop following. Purely presentational:
 * the host supplies the reactive presence list and the currently-followed
 * clientId (from `CollaborationService`) and reacts to the `follow` event to
 * drive `followUser(clientId | null)`. Each peer chip shows an initials avatar
 * in the peer's colour; the followed peer is highlighted with a "Stop" affordance.
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { RemotePresence } from './collaboration-helpers';

/** A peer chip view-model. */
interface PeerChip {
	clientId: number;
	userName: string;
	color: string;
	initials: string;
	following: boolean;
}

@Component({
	selector: 'pptx-follow-mode-bar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	styles: `
		:host {
			display: block;
		}

		.pptx-ng-follow-bar {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.75rem;
			border-radius: 0.5rem;
			background: var(--pptx-card, rgba(17, 24, 39, 0.95));
			padding: 0.375rem 0.625rem;
			font-size: 0.75rem;
			color: var(--pptx-foreground, #f3f4f6);
		}

		.pptx-ng-follow-status {
			display: inline-flex;
			align-items: center;
			gap: 0.375rem;
			white-space: nowrap;
			color: var(--pptx-muted-foreground, #9ca3af);
		}

		.pptx-ng-follow-stop {
			cursor: pointer;
			border-radius: 0.375rem;
			border: 1px solid var(--pptx-border, #374151);
			background: transparent;
			padding: 0.125rem 0.5rem;
			font-size: 11px;
			color: var(--pptx-foreground, #f3f4f6);
		}

		.pptx-ng-follow-list {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		.pptx-ng-follow-peer {
			display: inline-flex;
			cursor: pointer;
			align-items: center;
			gap: 0.375rem;
			border-radius: 9999px;
			border: 1px solid transparent;
			background: var(--pptx-muted, rgba(55, 65, 81, 0.6));
			padding: 0.125rem 0.5rem 0.125rem 0.125rem;
			color: var(--pptx-foreground, #f3f4f6);
		}

		.pptx-ng-follow-peer.is-following {
			border-color: var(--pptx-primary, #6366f1);
			background: color-mix(in srgb, var(--pptx-primary, #6366f1) 30%, transparent);
		}

		.pptx-ng-follow-avatar {
			display: inline-flex;
			height: 22px;
			width: 22px;
			align-items: center;
			justify-content: center;
			border-radius: 9999px;
			font-size: 10px;
			font-weight: 600;
			line-height: 1;
			color: #ffffff;
		}

		.pptx-ng-follow-name {
			max-width: 120px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	`,
	template: `
		@if (chips().length > 0) {
			<div class="pptx-ng-follow-bar" data-export-ignore="true">
				<span class="pptx-ng-follow-status">
					@if (followedName(); as name) {
						{{ 'pptx.followMode.following' | translate }}
						<strong>{{ name }}</strong>
						<button
							type="button"
							class="pptx-ng-follow-stop"
							[title]="'pptx.followMode.stopFollowing' | translate"
							(click)="follow.emit(null)"
						>
							{{ 'pptx.followMode.stop' | translate }}
						</button>
					} @else {
						<ng-container>{{ 'pptx.followMode.followCollaborator' | translate }}</ng-container>
					}
				</span>
				<ul class="pptx-ng-follow-list">
					@for (peer of chips(); track peer.clientId) {
						<li>
							<button
								type="button"
								class="pptx-ng-follow-peer"
								[class.is-following]="peer.following"
								[attr.data-client-id]="peer.clientId"
								[attr.aria-pressed]="peer.following"
								(click)="toggle(peer.clientId)"
							>
								<span class="pptx-ng-follow-avatar" [style.background-color]="peer.color">
									{{ peer.initials }}
								</span>
								<span class="pptx-ng-follow-name">{{ peer.userName }}</span>
							</button>
						</li>
					}
				</ul>
			</div>
		}
	`,
})
export class FollowModeBarComponent {
	/** Active remote collaborators (excludes self). */
	readonly presences = input<RemotePresence[]>([]);
	/** The clientId currently being followed, or null. */
	readonly followedClientId = input<number | null>(null);

	/** Follow the given peer, or `null` to stop following. */
	readonly follow = output<number | null>();

	protected readonly chips = computed<PeerChip[]>(() => {
		const followed = this.followedClientId();
		return this.presences().map((peer) => ({
			clientId: peer.clientId,
			userName: peer.userName,
			color: peer.userColor,
			initials: initialsOf(peer.userName),
			following: peer.clientId === followed,
		}));
	});

	protected readonly followedName = computed<string | null>(() => {
		const id = this.followedClientId();
		if (id === null) {
			return null;
		}
		return this.presences().find((p) => p.clientId === id)?.userName ?? null;
	});

	protected toggle(clientId: number): void {
		this.follow.emit(this.followedClientId() === clientId ? null : clientId);
	}
}

/** First-letter / two-char initials for the avatar chip. */
function initialsOf(name: string): string {
	const parts = name.trim().split(/\s+/u);
	if (parts.length >= 2 && parts[0] && parts[parts.length - 1]) {
		return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	}
	return name.slice(0, 2).toUpperCase() || '?';
}
