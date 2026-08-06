import {
	createInitialPresentationSnapshot,
	createPresenterTimer,
	mergePresentationSnapshot,
	presenterElapsed,
	resetPresenterTimer,
	stepPresenterZoom,
	togglePresenterTimer,
} from 'pptx-viewer-shared';
import type { PresentationSnapshot } from 'pptx-viewer-shared';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UsePresenterConsoleResult {
	snapshot: PresentationSnapshot;
	applyAudienceSnapshot: (snapshot: PresentationSnapshot) => void;
	setBlackout: (blackout: PresentationSnapshot['blackout']) => void;
	toggleTimer: () => void;
	resetTimer: () => void;
	stepZoom: (direction: 1 | -1) => void;
	resetZoom: () => void;
	setCaption: (caption: string) => void;
	setSubtitlesVisible: (visible: boolean) => void;
	updateSnapshot: (patch: Partial<PresentationSnapshot>) => void;
}

/**
 * @param active - Whether a slide show is running. This hook is mounted by the
 *   root viewer for the whole session, so the clock MUST be gated on it: an
 *   ungated interval ticked once a second during ordinary editing, and because
 *   `mergePresentationSnapshot` always allocates a fresh object and bumps
 *   `sequence`, React could never bail out of the resulting render. That
 *   re-rendered the entire editor tree at 1 Hz forever (issue #145).
 */
export function usePresenterConsole(
	slideIndex: number,
	active: boolean,
): UsePresenterConsoleResult {
	const timerRef = useRef(createPresenterTimer());
	const [snapshot, setSnapshot] = useState(() => createInitialPresentationSnapshot(slideIndex));
	const patch = useCallback((value: Partial<PresentationSnapshot>) => {
		setSnapshot((current) => mergePresentationSnapshot(current, value));
	}, []);

	useEffect(() => patch({ slideIndex }), [patch, slideIndex]);
	useEffect(() => {
		if (!active) {
			return;
		}
		// The elapsed reading is "time since this show started", so the clock is
		// re-based on entry rather than left running from mount. It used to be
		// seeded at mount, and since `createInitialPresentationSnapshot` always
		// sets a numeric `elapsedMs` the `presentationStartTime` fallback in
		// `PresenterView` was dead code - so a deck presented half an hour into an
		// editing session opened its console reading 30:00 instead of 00:00.
		timerRef.current = resetPresenterTimer();
		patch({ paused: false, elapsedMs: 0 });
		const timer = window.setInterval(() => {
			patch({
				paused: timerRef.current.paused,
				elapsedMs: presenterElapsed(timerRef.current),
			});
		}, 1000);
		return () => window.clearInterval(timer);
	}, [active, patch]);

	return {
		snapshot,
		applyAudienceSnapshot: setSnapshot,
		setBlackout: (blackout) => patch({ blackout }),
		toggleTimer: () => {
			timerRef.current = togglePresenterTimer(timerRef.current);
			patch({
				paused: timerRef.current.paused,
				elapsedMs: presenterElapsed(timerRef.current),
			});
		},
		resetTimer: () => {
			timerRef.current = resetPresenterTimer();
			patch({ paused: false, elapsedMs: 0 });
		},
		stepZoom: (direction) =>
			setSnapshot((current) =>
				mergePresentationSnapshot(current, {
					zoom: stepPresenterZoom(
						current.zoom ?? { scale: 1, originX: 0.5, originY: 0.5 },
						direction,
					),
				}),
			),
		resetZoom: () => patch({ zoom: { scale: 1, originX: 0.5, originY: 0.5 } }),
		setCaption: (caption) => patch({ caption }),
		setSubtitlesVisible: (subtitlesVisible) => patch({ subtitlesVisible }),
		updateSnapshot: patch,
	};
}
