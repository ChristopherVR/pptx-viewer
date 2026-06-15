import type { PptxCustomShow, PptxSlide } from 'pptx-viewer-core';
import { computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';

/**
 * `useCustomShows` — list/create/rename/delete custom slide shows plus editing
 * the ordered slide-id list of a show.
 *
 * Vue port of the React `useDialogCustomShows` hook (`packages/react/src/
 * viewer/hooks/useDialogCustomShows.ts`). A {@link PptxCustomShow} names an
 * ordered subset of slides (by relationship id) that can be presented
 * independently of the full deck.
 *
 * The composable is DOM-free and unit-testable: it never prompts. Names are
 * supplied by the caller (the React hook used `window.prompt`; in Vue that
 * lives in the component). Each mutating operation snapshots undo/redo history
 * *first* (via `pushHistory`) and reassigns `customShows.value` with a fresh
 * array so `shallowRef`-backed state stays reactive.
 */

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

export interface UseCustomShowsInput {
	/** Reactive custom-show list (typically a `shallowRef<PptxCustomShow[]>`). */
	customShows: Ref<PptxCustomShow[]>;
	/** Reactive slide list, used to resolve slide relationship ids. */
	slides: Ref<PptxSlide[]>;
	/** Index of the currently focused slide. */
	activeSlideIndex: Ref<number>;
	/** Snapshot current state onto the undo stack before mutating. */
	pushHistory: () => void;
}

export interface UseCustomShowsResult {
	/**
	 * Create a new custom show. When `seedWithActiveSlide` (default `true`) and
	 * the active slide carries an `rId`, that slide seeds the show. Returns the
	 * id of the created show.
	 */
	createCustomShow: (name: string, seedWithActiveSlide?: boolean) => string;
	/** Rename the custom show with id `showId`. No-op when the show is missing. */
	renameCustomShow: (showId: string, newName: string) => void;
	/** Delete the custom show with id `showId`. */
	deleteCustomShow: (showId: string) => void;
	/** Toggle whether the slide (by relationship id) is in the show. */
	toggleSlideInShow: (showId: string, slideRId: string) => void;
	/** Replace a show's ordered slide-relationship-id list wholesale. */
	setShowSlides: (showId: string, slideRIds: string[]) => void;
	/** Move a slide within a show's order from `from` to `to`. */
	moveSlideInShow: (showId: string, from: number, to: number) => void;
	/** Whether the active slide is currently part of the given show. */
	isActiveSlideInShow: (showId: string) => boolean;
	/** The relationship id of the active slide, if any. */
	activeSlideRId: ComputedRef<string | undefined>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a collision-resistant custom-show id. */
function makeCustomShowId(): string {
	return `custShow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useCustomShows(input: UseCustomShowsInput): UseCustomShowsResult {
	const { customShows, slides, activeSlideIndex, pushHistory } = input;

	const activeSlideRId = computed<string | undefined>(() => {
		const slide = slides.value[activeSlideIndex.value];
		return slide?.rId && slide.rId.length > 0 ? slide.rId : undefined;
	});

	const createCustomShow = (name: string, seedWithActiveSlide = true): string => {
		pushHistory();
		const id = makeCustomShowId();
		const safeName = name.trim() || `Custom Show ${customShows.value.length + 1}`;
		const seedRId = activeSlideRId.value;
		const slideRIds = seedWithActiveSlide && seedRId !== undefined ? [seedRId] : [];
		customShows.value = [...customShows.value, { id, name: safeName, slideRIds }];
		return id;
	};

	const renameCustomShow = (showId: string, newName: string): void => {
		const nextName = newName.trim();
		if (nextName.length === 0) {
			return;
		}
		if (!customShows.value.some((s) => s.id === showId)) {
			return;
		}
		pushHistory();
		customShows.value = customShows.value.map((s) =>
			s.id === showId ? { ...s, name: nextName } : s,
		);
	};

	const deleteCustomShow = (showId: string): void => {
		if (!customShows.value.some((s) => s.id === showId)) {
			return;
		}
		pushHistory();
		customShows.value = customShows.value.filter((s) => s.id !== showId);
	};

	const toggleSlideInShow = (showId: string, slideRId: string): void => {
		if (!showId || !slideRId) {
			return;
		}
		if (!customShows.value.some((s) => s.id === showId)) {
			return;
		}
		pushHistory();
		customShows.value = customShows.value.map((s) => {
			if (s.id !== showId) {
				return s;
			}
			const hasSlide = s.slideRIds.includes(slideRId);
			return {
				...s,
				slideRIds: hasSlide
					? s.slideRIds.filter((rid) => rid !== slideRId)
					: [...s.slideRIds, slideRId],
			};
		});
	};

	const setShowSlides = (showId: string, slideRIds: string[]): void => {
		if (!customShows.value.some((s) => s.id === showId)) {
			return;
		}
		pushHistory();
		customShows.value = customShows.value.map((s) =>
			s.id === showId ? { ...s, slideRIds: [...slideRIds] } : s,
		);
	};

	const moveSlideInShow = (showId: string, from: number, to: number): void => {
		const show = customShows.value.find((s) => s.id === showId);
		if (!show) {
			return;
		}
		const length = show.slideRIds.length;
		if (from === to || from < 0 || from >= length || to < 0 || to >= length) {
			return;
		}
		pushHistory();
		customShows.value = customShows.value.map((s) => {
			if (s.id !== showId) {
				return s;
			}
			const reordered = [...s.slideRIds];
			const [moved] = reordered.splice(from, 1);
			reordered.splice(to, 0, moved);
			return { ...s, slideRIds: reordered };
		});
	};

	const isActiveSlideInShow = (showId: string): boolean => {
		const rId = activeSlideRId.value;
		if (rId === undefined) {
			return false;
		}
		const show = customShows.value.find((s) => s.id === showId);
		return show ? show.slideRIds.includes(rId) : false;
	};

	return {
		createCustomShow,
		renameCustomShow,
		deleteCustomShow,
		toggleSlideInShow,
		setShowSlides,
		moveSlideInShow,
		isActiveSlideInShow,
		activeSlideRId,
	};
}
