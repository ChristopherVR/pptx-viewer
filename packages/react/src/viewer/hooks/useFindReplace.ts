import type { PptxSlide } from 'pptx-viewer-core';
import { applyFindReplacements, findInSlides } from 'pptx-viewer-shared';
import type { FindResult } from 'pptx-viewer-shared';
import { useState, useCallback, useEffect } from 'react';

// The match descriptor and the search / replace implementations are shared with
// the other bindings; this hook is the React state around them.
export type { FindResult } from 'pptx-viewer-shared';
interface UseFindReplaceInput {
	slides: PptxSlide[];
	mode: string;
	onSetActiveSlideIndex: (index: number) => void;
	onSetSelectedElementId: (id: string | null) => void;
	onUpdateSlides: (updater: (slides: PptxSlide[]) => PptxSlide[]) => void;
	onMarkDirty: () => void;
}

interface UseFindReplaceResult {
	findReplaceOpen: boolean;
	setFindReplaceOpen: (open: boolean) => void;
	findQuery: string;
	setFindQuery: (query: string) => void;
	replaceQuery: string;
	setReplaceQuery: (query: string) => void;
	findMatchCase: boolean;
	setFindMatchCase: (matchCase: boolean) => void;
	findResults: FindResult[];
	findResultIndex: number;
	performFind: () => void;
	navigateFindResult: (direction: 1 | -1) => void;
	handleReplace: () => void;
	handleReplaceAll: () => void;
}

// ---------------------------------------------------------------------------
// Pure helper functions (exported for testing)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFindReplace({
	slides,
	mode,
	onSetActiveSlideIndex,
	onSetSelectedElementId,
	onUpdateSlides,
	onMarkDirty,
}: UseFindReplaceInput): UseFindReplaceResult {
	const [findReplaceOpen, setFindReplaceOpen] = useState(false);
	const [findQuery, setFindQuery] = useState('');
	const [replaceQuery, setReplaceQuery] = useState('');
	const [findMatchCase, setFindMatchCase] = useState(false);
	const [findResults, setFindResults] = useState<FindResult[]>([]);
	const [findResultIndex, setFindResultIndex] = useState(-1);

	// ── Search ────────────────────────────────────────────────────────────
	const performFind = useCallback(() => {
		const results = findInSlides(slides, findQuery, { matchCase: findMatchCase });

		if (!findQuery) {
			setFindResults([]);
			setFindResultIndex(-1);
			return;
		}

		setFindResults(results);
		setFindResultIndex(results.length > 0 ? 0 : -1);

		// Navigate to first match
		if (results.length > 0) {
			onSetActiveSlideIndex(results[0].slideIndex);
			onSetSelectedElementId(results[0].elementId);
		}
	}, [slides, findQuery, findMatchCase, onSetActiveSlideIndex, onSetSelectedElementId]);

	// ── Navigate results ──────────────────────────────────────────────────
	const navigateFindResult = useCallback(
		(direction: 1 | -1) => {
			if (findResults.length === 0) {
				return;
			}
			const nextIdx = (findResultIndex + direction + findResults.length) % findResults.length;
			setFindResultIndex(nextIdx);
			const match = findResults[nextIdx];
			if (match) {
				onSetActiveSlideIndex(match.slideIndex);
				onSetSelectedElementId(match.elementId);
			}
		},
		[findResults, findResultIndex, onSetActiveSlideIndex, onSetSelectedElementId],
	);

	// ── Replace helpers ───────────────────────────────────────────────────
	const applyReplacements = useCallback(
		(toReplace: FindResult[]) => {
			if (toReplace.length === 0) {
				return;
			}

			onUpdateSlides(
				(prevSlides) =>
					applyFindReplacements(prevSlides, toReplace, replaceQuery).slides as PptxSlide[],
			);

			onMarkDirty();
		},
		[replaceQuery, onUpdateSlides, onMarkDirty],
	);

	// ── Replace current match ─────────────────────────────────────────────
	const handleReplace = useCallback(() => {
		if (findResults.length === 0 || findResultIndex < 0) {
			return;
		}
		applyReplacements([findResults[findResultIndex]]);
		// Re-run search after replace to refresh results
		setTimeout(performFind, 0);
	}, [findResults, findResultIndex, applyReplacements, performFind]);

	// ── Replace all ───────────────────────────────────────────────────────
	const handleReplaceAll = useCallback(() => {
		if (findResults.length === 0) {
			return;
		}
		applyReplacements(findResults);
		// Re-run search after replace to refresh results
		setTimeout(performFind, 0);
	}, [findResults, applyReplacements, performFind]);

	// ── Keyboard shortcut: Ctrl/Cmd+F toggles find bar (edit mode only) ──
	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
				if (mode !== 'edit') {
					return;
				}
				event.preventDefault();
				setFindReplaceOpen((prev) => !prev);
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [mode]);

	return {
		findReplaceOpen,
		setFindReplaceOpen,
		findQuery,
		setFindQuery,
		replaceQuery,
		setReplaceQuery,
		findMatchCase,
		setFindMatchCase,
		findResults,
		findResultIndex,
		performFind,
		navigateFindResult,
		handleReplace,
		handleReplaceAll,
	};
}
