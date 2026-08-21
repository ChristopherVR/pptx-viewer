import type { PptxSlideTransition } from 'pptx-viewer-core';
import { getSlideTransitionAnimations } from 'pptx-viewer-shared';

import { ensurePresentationKeyframes } from '../../animation/animation-dom';
import type { Translator } from '../../i18n';
import { createEl } from '../../render';

export interface TransitionPreview {
	el: HTMLElement;
	update(transition: PptxSlideTransition | undefined): void;
}

/**
 * Click-to-play thumbnail of the configured transition, matching React's
 * `inspector/TransitionPreview.tsx`. The two stacked layers ("A" outgoing,
 * "B" incoming) are driven by the same shared `getSlideTransitionAnimations`
 * resolver the real presentation overlay uses, so what the author previews is
 * what plays.
 */
export function createTransitionPreview(doc: Document, t: Translator): TransitionPreview {
	ensurePresentationKeyframes(doc);

	const el = createEl(doc, 'div', 'pptxv-transition-preview');
	const label = createEl(doc, 'span', 'pptxv-transition-preview-label');
	label.textContent = t('pptx.transition.preview');
	const stage = createEl(doc, 'button', 'pptxv-transition-preview-stage');
	stage.type = 'button';
	stage.title = t('pptx.transition.preview');
	stage.setAttribute('aria-label', t('pptx.transition.preview'));
	const incoming = createEl(doc, 'span', 'pptxv-transition-preview-layer is-incoming');
	incoming.textContent = 'B';
	const outgoing = createEl(doc, 'span', 'pptxv-transition-preview-layer is-outgoing');
	outgoing.textContent = 'A';
	stage.append(incoming, outgoing);
	el.append(label, stage);

	let current: PptxSlideTransition | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const reset = (): void => {
		incoming.style.animation = '';
		outgoing.style.animation = '';
	};

	const play = (): void => {
		if (!current) {
			return;
		}
		const durationMs = current.durationMs ?? 500;
		const animations = getSlideTransitionAnimations(
			current.type,
			durationMs,
			current.direction,
			current.orient,
			current.spokes,
		);
		outgoing.style.zIndex = animations.outgoingOnTop ? '2' : '0';
		// Recreate the elements' animation from scratch (setting the same string
		// twice is a no-op) so clicking twice while already playing restarts it.
		reset();
		// eslint-disable-next-line no-void -- force a reflow so the cleared
		// animation above is committed before the new one is assigned
		void stage.offsetWidth;
		incoming.style.animation = animations.incoming !== 'none' ? animations.incoming : '';
		outgoing.style.animation =
			animations.outgoing !== 'none'
				? animations.outgoing
				: `pptx-tr-fade-out ${durationMs}ms ease-in-out forwards`;
		clearTimeout(timer);
		timer = setTimeout(reset, durationMs + 100);
	};
	stage.addEventListener('click', play);

	return {
		el,
		update(transition) {
			current = transition;
			const previewable =
				Boolean(transition) && transition?.type !== 'none' && transition?.type !== 'cut';
			el.hidden = !previewable;
			if (!previewable) {
				clearTimeout(timer);
				reset();
			}
		},
	};
}
