/**
 * usePresentationActionExtras: the wave-4 `PresentationActionRunner` verbs
 * (`lastViewed`, `customShow`, `openFile`, `openPresentation`, `playMedia`,
 * `oleVerb`) an on-slide Action Setting can trigger, alongside `goToSlide` /
 * `move` / `endShow`. Split out of `PresentationMode.vue` (already well past
 * the repo's ~300 LOC convention) so the show controller stays composable
 * plumbing rather than growing further.
 *
 * `customShow` needs to temporarily steer the SHOW ORDER itself (the running
 * show is not necessarily the one selected in the Custom Shows dialog any
 * more), so the caller's `activeShowOverride` ref is read by
 * `usePresentationShowOrder`'s `activeCustomShow` getter in `PresentationMode.vue`
 * instead of the `activeCustomShow` prop directly; this composable is what
 * writes to it.
 */
import type { PptxCustomShow, PptxElement, PptxSlide } from 'pptx-viewer-core';
import { findPresentationActionTarget, openUrlInNewTab, safeOpenUrl } from 'pptx-viewer-shared';
import { ref, watch } from 'vue';
import type { Ref } from 'vue';

/** A custom show's membership, the shape `usePresentationShowOrder` reads. */
export type ActiveCustomShow = { slideRIds: string[] } | null | undefined;

export interface UsePresentationActionExtrasInput {
	customShows: () => readonly PptxCustomShow[];
	currentIndex: Ref<number>;
	activeSlide: () => PptxSlide | undefined;
	/**
	 * `undefined` follows the dialog-selected show (`activeCustomShow` prop);
	 * a set value (including explicit `null`, "no show") overrides it while an
	 * on-slide custom-show action is running.
	 */
	activeShowOverride: Ref<ActiveCustomShow>;
	/** `showOrder.first`; called AFTER `activeShowOverride` changes, so it resolves against the new show. */
	firstShowSlide: (fallback: number) => number;
	goTo: (index: number) => void;
	/** The show frame's root element, so a media lookup cannot match a stray same-id node elsewhere on the page. */
	frameRoot: () => HTMLElement | null;
}

export interface UsePresentationActionExtrasResult {
	lastViewed: () => void;
	customShow: (customShowId: string, returnAfter: boolean) => void;
	/** Wire into `usePresentationNavigation`'s `onShowEnd`. */
	handleShowEnd: () => boolean;
	openFile: (target: string) => void;
	openPresentation: (target: string) => void;
	playMedia: (elementId: string | undefined) => void;
	oleVerb: (verb: number) => void;
	/** Call from the stage's click handler, before `handlePresentationStageClick`, so `oleVerb` knows its target. */
	noteActionClickTarget: (rawTarget: unknown) => void;
}

/** Depth-first search for an element by id, group children included. */
function findElementById(
	elements: readonly PptxElement[] | undefined,
	id: string,
): PptxElement | undefined {
	for (const element of elements ?? []) {
		if (element.id === id) {
			return element;
		}
		if (element.type === 'group' && element.children) {
			const found = findElementById(element.children, id);
			if (found) {
				return found;
			}
		}
	}
	return undefined;
}

/** The `<video>`/`<audio>` node for `elementId`, within `root`, or `undefined`. */
function findMediaElement(root: HTMLElement, elementId: string): HTMLMediaElement | undefined {
	for (const node of root.querySelectorAll<HTMLElement>('[data-element-id]')) {
		if (node.getAttribute('data-element-id') === elementId) {
			return node.querySelector<HTMLMediaElement>('video, audio') ?? undefined;
		}
	}
	return undefined;
}

export function usePresentationActionExtras(
	input: UsePresentationActionExtrasInput,
): UsePresentationActionExtrasResult {
	// "Last slide viewed": the index one step behind whatever `currentIndex` is
	// now, tracked as the show navigates (a plain jump, not a navigation stack,
	// matching PowerPoint's own single-level "last viewed" memory).
	const previousIndex = ref<number | null>(null);
	let trackedIndex = input.currentIndex.value;
	// `flush: 'sync'` on purpose: Vue's default (batched) flush would collapse
	// two navigations that happen before a render (e.g. a script-driven jump
	// followed immediately by another) into one callback that only sees the
	// FIRST old value and the LAST new one, silently dropping the slide in
	// between - exactly the value "last viewed" needs to remember.
	watch(
		input.currentIndex,
		(index) => {
			previousIndex.value = trackedIndex;
			trackedIndex = index;
		},
		{ flush: 'sync' },
	);

	/** The element an on-slide action click landed on, for `oleVerb` (its callback carries no elementId). */
	const lastClickElementId = ref<string | undefined>(undefined);

	function lastViewed(): void {
		if (previousIndex.value !== null) {
			input.goTo(previousIndex.value);
		}
	}

	/** Set only while a "resume last slide viewed" sub-show is running. */
	const pendingReturn = ref<{ index: number; previousOverride: ActiveCustomShow } | null>(null);

	function customShow(customShowId: string, returnAfter: boolean): void {
		const target = input.customShows().find((show) => show.id === customShowId);
		if (!target) {
			return;
		}
		pendingReturn.value = returnAfter
			? { index: input.currentIndex.value, previousOverride: input.activeShowOverride.value }
			: null;
		input.activeShowOverride.value = target;
		input.goTo(input.firstShowSlide(input.currentIndex.value));
	}

	function handleShowEnd(): boolean {
		const pending = pendingReturn.value;
		if (!pending) {
			return false;
		}
		pendingReturn.value = null;
		input.activeShowOverride.value = pending.previousOverride;
		input.goTo(pending.index);
		return true;
	}

	function openFile(target: string): void {
		safeOpenUrl(target);
	}

	function openPresentation(target: string): void {
		safeOpenUrl(target);
	}

	function playMedia(elementId: string | undefined): void {
		const id = elementId ?? lastClickElementId.value;
		const root = input.frameRoot();
		if (!id || !root) {
			return;
		}
		const media = findMediaElement(root, id);
		if (!media) {
			return;
		}
		if (media.paused) {
			void media.play();
		} else {
			media.pause();
		}
	}

	function oleVerb(_verb: number): void {
		const id = lastClickElementId.value;
		if (!id) {
			return;
		}
		const element = findElementById(input.activeSlide()?.elements, id);
		if (!element || element.type !== 'ole' || !element.oleEmbeddedData) {
			return;
		}
		openUrlInNewTab(element.oleEmbeddedData);
	}

	function noteActionClickTarget(rawTarget: unknown): void {
		lastClickElementId.value = findPresentationActionTarget(
			rawTarget,
			input.activeSlide(),
		)?.elementId;
	}

	return {
		lastViewed,
		customShow,
		handleShowEnd,
		openFile,
		openPresentation,
		playMedia,
		oleVerb,
		noteActionClickTarget,
	};
}
