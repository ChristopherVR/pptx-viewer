import type { PptxSlide } from 'pptx-viewer-core';
import { openUrlInNewTab, resolveOleVerbTarget, safeOpenUrl } from 'pptx-viewer-shared';
import type { PresentationActionRunner } from 'pptx-viewer-shared';

import type { CustomShowRunner } from './presenter/presentation-custom-show-runner';

/**
 * B7: the vanilla `PresentationActionRunner` (an on-slide Action Setting's
 * navigation target), assembled once per chrome mount rather than rebuilt
 * inline on every click. `customShow` delegates to
 * `presentation-custom-show-runner.ts` (its `returnAfter` bookkeeping needs a
 * store subscription of its own); every other callback here is a one-liner.
 *
 * @module viewer/presentation-action-runner
 */
export interface PresentationActionRunnerDeps {
	goToSlide(index: number): void;
	next(): void;
	prev(): void;
	exitPresentation(): void;
	/** Trust Center > "Confirm before opening external hyperlinks". */
	confirmExternalHyperlink?(url: string): boolean;
	/** The live stage host, for `playMedia`'s element lookup. */
	getStageRoot(): HTMLElement;
	/** The deck index the show was on immediately before the current one. */
	getPreviousPresentedSlide(): number | null;
	/** The slide on stage, for `oleVerb`'s embedded-object lookup. */
	getCurrentSlide(): PptxSlide | undefined;
	customShowRunner: CustomShowRunner;
}

export function buildPresentationActionRunner(
	deps: PresentationActionRunnerDeps,
): PresentationActionRunner {
	return {
		goToSlide: (index) => deps.goToSlide(index),
		move: (direction) => (direction > 0 ? deps.next() : deps.prev()),
		endShow: () => deps.exitPresentation(),
		// An on-slide Action Setting's own "Hyperlink to a URL" must clear the
		// same Trust Center gate a text hyperlink click does.
		confirmUrl: (url) => deps.confirmExternalHyperlink?.(url) ?? true,
		lastViewed: () => {
			const previous = deps.getPreviousPresentedSlide();
			if (previous !== null) {
				deps.goToSlide(previous);
			}
		},
		customShow: (customShowId, returnAfter) =>
			deps.customShowRunner.customShow(customShowId, returnAfter),
		// `safeOpenUrl` is the same Trust Center + `noopener` gate every external
		// hyperlink click in this binding already goes through; a `javascript:`
		// or otherwise unsafe target is silently dropped, not opened.
		openFile: (target) => {
			safeOpenUrl(target);
		},
		openPresentation: (target) => {
			safeOpenUrl(target);
		},
		playMedia: (elementId) => {
			if (!elementId) {
				return;
			}
			const media = deps
				.getStageRoot()
				.querySelector<HTMLMediaElement>(
					`[data-element-id="${elementId}"] video, [data-element-id="${elementId}"] audio`,
				);
			if (!media) {
				return;
			}
			if (media.paused) {
				void media.play();
			} else {
				media.pause();
			}
		},
		// A browser cannot run the verb in the owning application: open the
		// recovered embedding, as the inspector's OLE "Open" button does.
		oleVerb: (verb, elementId) => {
			const target = resolveOleVerbTarget(deps.getCurrentSlide(), elementId, verb);
			if (target) {
				openUrlInNewTab(target.url);
			}
		},
	};
}
