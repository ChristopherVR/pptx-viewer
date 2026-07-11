import type { SanitizedPresence } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';

/**
 * follow-mode-bar.ts: lists active remote peers as clickable avatar-initial
 * chips; clicking follows (or un-follows) that peer's active slide. Vanilla
 * port of the Vue `FollowModeBar.vue`. Hidden entirely while no remote peers
 * are present. Docked near the bottom of the stage wrap by the caller's CSS.
 */

export interface FollowModeBarHandlers {
	/** Follow the given peer, or `null` to stop following. */
	onFollow(clientId: number | null): void;
}

export interface FollowModeBar {
	el: HTMLElement;
	update(presences: readonly SanitizedPresence[], followedClientId: number | null): void;
	destroy(): void;
}

const MAX_INITIALS = 2;

function initials(name: string): string {
	const parts = name.trim().split(/\s+/u);
	if (parts.length >= 2 && parts[0] && parts[parts.length - 1]) {
		return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	}
	return name.slice(0, MAX_INITIALS).toUpperCase() || '?';
}

export function createFollowModeBar(
	doc: Document,
	t: Translator,
	handlers: FollowModeBarHandlers,
): FollowModeBar {
	const el = createEl(doc, 'div', 'pptxv-follow-bar');
	el.dataset.exportIgnore = 'true';
	el.hidden = true;

	const status = createEl(doc, 'span', 'pptxv-follow-status');
	el.appendChild(status);
	const list = createEl(doc, 'ul', 'pptxv-follow-list');
	el.appendChild(list);

	const chips = new Map<number, HTMLButtonElement>();

	function renderStatus(followed: SanitizedPresence | null): void {
		status.replaceChildren();
		if (!followed) {
			status.textContent = t('pptx.followMode.followCollaborator');
			return;
		}
		status.append(`${t('pptx.followMode.following')} `);
		const strong = createEl(doc, 'strong');
		strong.textContent = followed.userName;
		status.appendChild(strong);
		status.append(' ');
		const stopBtn = createEl(doc, 'button', 'pptxv-follow-stop');
		stopBtn.type = 'button';
		stopBtn.textContent = t('pptx.followMode.stop');
		stopBtn.title = t('pptx.followMode.stopFollowing');
		stopBtn.addEventListener('click', () => handlers.onFollow(null));
		status.appendChild(stopBtn);
	}

	function chipFor(peer: SanitizedPresence): HTMLButtonElement {
		const existing = chips.get(peer.clientId);
		if (existing) {
			return existing;
		}
		const chip = createEl(doc, 'button', 'pptxv-follow-peer');
		chip.type = 'button';
		chip.appendChild(createEl(doc, 'span', 'pptxv-follow-avatar'));
		chip.appendChild(createEl(doc, 'span', 'pptxv-follow-name'));
		const item = createEl(doc, 'li');
		item.appendChild(chip);
		list.appendChild(item);
		chips.set(peer.clientId, chip);
		return chip;
	}

	return {
		el,
		update(presences, followedClientId) {
			el.hidden = presences.length === 0;
			if (el.hidden) {
				return;
			}
			const followed = presences.find((p) => p.clientId === followedClientId) ?? null;
			renderStatus(followed);

			const seen = new Set<number>();
			for (const peer of presences) {
				seen.add(peer.clientId);
				const chip = chipFor(peer);
				const avatar = chip.firstElementChild as HTMLElement;
				const name = chip.lastElementChild as HTMLElement;
				avatar.textContent = initials(peer.userName);
				avatar.style.backgroundColor = peer.userColor;
				name.textContent = peer.userName;
				const isFollowing = peer.clientId === followedClientId;
				chip.classList.toggle('is-following', isFollowing);
				chip.setAttribute('aria-pressed', String(isFollowing));
				chip.title = isFollowing
					? t('pptx.followMode.stopFollowingUser', { name: peer.userName })
					: t('pptx.followMode.followUser', { name: peer.userName });
				chip.onclick = () => handlers.onFollow(isFollowing ? null : peer.clientId);
			}
			for (const [clientId, chip] of chips) {
				if (!seen.has(clientId)) {
					chip.closest('li')?.remove();
					chips.delete(clientId);
				}
			}
		},
		destroy() {
			el.remove();
		},
	};
}
