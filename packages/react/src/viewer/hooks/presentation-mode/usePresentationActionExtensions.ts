import type { PptxSlide } from 'pptx-viewer-core';
import { openUrlInNewTab, resolveOleVerbTarget, safeOpenUrl } from 'pptx-viewer-shared';
import { useCallback, useEffect, useRef } from 'react';

import type { ViewerMode } from '../../types';
import type { CustomShowDescriptor } from './useCustomShowRunner';
import { useCustomShowRunner } from './useCustomShowRunner';

/**
 * usePresentationActionExtensions: the wave-4 `PresentationActionRunner`
 * callbacks (`lastViewed`, `customShow`, `openFile`, `openPresentation`,
 * `playMedia`) plus the "end of show" hook that lets a `returnAfter` custom
 * show resume its origin instead of ending the presentation.
 *
 * Split out of `usePresentationMode` (extraction trigger: new logic that
 * hook did not need to own directly) to keep that orchestrator from growing
 * further. `customShow` and `lastViewed` both navigate, but the navigator
 * (`useSlideNavigation`'s `navigateToSlide`) is built AFTER this hook runs
 * (it needs the `onCustomShow`/`onLastViewed` callbacks this hook produces),
 * so a ref bridges the cycle: the caller wires the real navigator in via
 * {@link UsePresentationActionExtensionsResult.bindNavigateToSlide} once it
 * exists, and every handler here calls through the ref.
 *
 * @module presentation-mode/usePresentationActionExtensions
 */

export interface UsePresentationActionExtensionsInput {
	slides: PptxSlide[];
	customShows: CustomShowDescriptor[];
	activeCustomShowId: string | null;
	onSetActiveCustomShowId?: (id: string | null) => void;
	presentationSlideIndex: number;
	containerRef: React.RefObject<HTMLElement | null>;
	endWithBlackSlide: boolean;
	onSetMode: (mode: ViewerMode) => void;
	setEndOfShowVisible: (visible: boolean) => void;
}

export interface UsePresentationActionExtensionsResult {
	onLastViewed: () => void;
	onCustomShow: (customShowId: string, returnAfter: boolean) => void;
	onOpenFile: (target: string) => void;
	onOpenPresentation: (target: string) => void;
	onPlayMedia: (elementId: string | undefined) => void;
	/** `ppaction://ole?verb=<n>`: open the clicked element's recovered embedding. */
	onOleVerb: (verb: number, elementId: string | undefined) => void;
	/**
	 * Advancing past the last slide either restores a pending `returnAfter`
	 * custom-show origin, shows the black end-of-show screen, or exits
	 * directly. Pass as `useSlideNavigation`'s `onAdvancePastLastSlide`.
	 */
	handleAdvancePastLastSlide: () => void;
	/** Wire the real navigator in once `useSlideNavigation` has built it. */
	bindNavigateToSlide: (navigateToSlide: (index: number) => void) => void;
}

export function usePresentationActionExtensions(
	input: UsePresentationActionExtensionsInput,
): UsePresentationActionExtensionsResult {
	const {
		slides,
		customShows,
		activeCustomShowId,
		onSetActiveCustomShowId,
		presentationSlideIndex,
		containerRef,
		endWithBlackSlide,
		onSetMode,
		setEndOfShowVisible,
	} = input;

	const navigateToSlideRef = useRef<((index: number) => void) | null>(null);
	const navigateToSlideViaRef = useCallback((index: number) => {
		navigateToSlideRef.current?.(index);
	}, []);

	const customShowRunner = useCustomShowRunner({
		getSlides: () => slides,
		getCustomShows: () => customShows,
		getActiveCustomShowId: () => activeCustomShowId,
		setActiveCustomShowId: (id) => onSetActiveCustomShowId?.(id),
		navigateToSlide: navigateToSlideViaRef,
		getPresentationSlideIndex: () => presentationSlideIndex,
	});

	// The slide the audience saw immediately before the CURRENT one, tracked
	// across every navigation path (sequential move, jump, custom-show entry)
	// since they all funnel through `presentationSlideIndex`.
	const previousSlideRef = useRef(presentationSlideIndex);
	const lastViewedSlideRef = useRef<number | null>(null);
	useEffect(() => {
		lastViewedSlideRef.current = previousSlideRef.current;
		previousSlideRef.current = presentationSlideIndex;
	}, [presentationSlideIndex]);

	const onCustomShow = useCallback(
		(customShowId: string, returnAfter: boolean) => {
			customShowRunner.runCustomShow(customShowId, returnAfter);
		},
		[customShowRunner],
	);

	const onLastViewed = useCallback(() => {
		const previous = lastViewedSlideRef.current;
		if (previous !== null) {
			navigateToSlideViaRef(previous);
		}
	}, [navigateToSlideViaRef]);

	const onOpenFile = useCallback((target: string) => {
		safeOpenUrl(target);
	}, []);
	const onOpenPresentation = useCallback((target: string) => {
		safeOpenUrl(target);
	}, []);

	// `ppaction://media`: toggle the acting element's own <video>/<audio>, the
	// same DOM node a direct click on it plays/pauses.
	const onPlayMedia = useCallback(
		(elementId: string | undefined) => {
			if (!elementId) {
				return;
			}
			const root = containerRef.current;
			if (!root) {
				return;
			}
			const selector =
				typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
					? CSS.escape(elementId)
					: elementId;
			const media = root.querySelector<HTMLMediaElement>(
				`[data-element-id="${selector}"] video, [data-element-id="${selector}"] audio`,
			);
			if (!media) {
				return;
			}
			if (media.paused) {
				void media.play().catch(() => {
					/* ignore */
				});
			} else {
				media.pause();
			}
		},
		[containerRef],
	);

	// A browser cannot run the verb in the owning application: open the
	// recovered embedding, as the OLE renderer's own "Open" does.
	const onOleVerb = useCallback(
		(verb: number, elementId: string | undefined) => {
			const target = resolveOleVerbTarget(slides[presentationSlideIndex], elementId, verb);
			if (target) {
				openUrlInNewTab(target.url);
			}
		},
		[slides, presentationSlideIndex],
	);

	const handleAdvancePastLastSlide = useCallback(() => {
		if (customShowRunner.tryReturnFromCustomShow()) {
			return;
		}
		if (endWithBlackSlide) {
			setEndOfShowVisible(true);
		} else {
			onSetMode('edit');
		}
	}, [customShowRunner, endWithBlackSlide, onSetMode, setEndOfShowVisible]);

	const bindNavigateToSlide = useCallback((navigateToSlide: (index: number) => void) => {
		navigateToSlideRef.current = navigateToSlide;
	}, []);

	return {
		onLastViewed,
		onCustomShow,
		onOpenFile,
		onOpenPresentation,
		onPlayMedia,
		onOleVerb,
		handleAdvancePastLastSlide,
		bindNavigateToSlide,
	};
}
