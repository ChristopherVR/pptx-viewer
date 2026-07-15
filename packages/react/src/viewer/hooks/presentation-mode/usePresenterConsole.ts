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

export function usePresenterConsole(slideIndex: number): UsePresenterConsoleResult {
	const timerRef = useRef(createPresenterTimer());
	const [snapshot, setSnapshot] = useState(() => createInitialPresentationSnapshot(slideIndex));
	const patch = useCallback((value: Partial<PresentationSnapshot>) => {
		setSnapshot((current) => mergePresentationSnapshot(current, value));
	}, []);

	useEffect(() => patch({ slideIndex }), [patch, slideIndex]);
	useEffect(() => {
		const timer = window.setInterval(() => {
			patch({
				paused: timerRef.current.paused,
				elapsedMs: presenterElapsed(timerRef.current),
			});
		}, 1000);
		return () => window.clearInterval(timer);
	}, [patch]);

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
