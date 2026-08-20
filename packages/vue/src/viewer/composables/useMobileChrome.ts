import type { MobileSheetKey } from 'pptx-viewer-shared';
import { toggleSheet } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

export type MobileSheetKind = 'slides' | 'format' | 'comments' | 'notes';

/**
 * `MobileSheetKind` values by the shared `MobileSheetKey` vocabulary they map
 * to (shared calls the format sheet `inspector`; see `MobileBottomBar.vue`'s
 * `TAB_META.sharedKey` for the same translation on the disabled-gating side).
 */
const SHARED_KEY: Record<MobileSheetKind, Exclude<MobileSheetKey, null>> = {
	slides: 'slides',
	format: 'inspector',
	comments: 'comments',
	notes: 'notes',
};

/** Which mobile bottom-bar tab is highlighted (null = none open). */
export type MobileActiveSheet = MobileSheetKind | null;

export interface UseMobileChromeInput {
	presenting: Ref<boolean>;
	/** Quick-insert action fired from the mobile bottom bar (a text box). */
	addText: () => void;
}

export interface UseMobileChromeResult {
	/** Mobile-only slide-rail sheet (the slides panel is a left rail on desktop). */
	mobileSlidesOpen: Ref<boolean>;
	/** Mobile-only bottom sheets for panels that are right-rail sidebars on desktop. */
	mobileInspectorOpen: Ref<boolean>;
	mobileCommentsOpen: Ref<boolean>;
	mobileNotesOpen: Ref<boolean>;
	/** Open one mobile sheet at a time so they don't stack over each other. */
	openMobileSheet: (which: MobileSheetKind) => void;
	/**
	 * Toggle a bottom-bar tab's sheet: tapping the open sheet closes it,
	 * tapping a different one switches to it. The decision itself comes from
	 * shared's `toggleSheet` (via the `SHARED_KEY` translation above); this
	 * only maps the result back onto the four exclusive refs.
	 */
	toggleMobileSheet: (which: MobileSheetKind) => void;
	/** The currently-open sheet, for highlighting its bottom-bar tab. */
	activeSheet: ComputedRef<MobileActiveSheet>;
	mobileQuickInsert: () => void;
	present: () => void;
}

/**
 * useMobileChrome: the mobile bottom-bar's sheet toggles (slides / format /
 * comments / notes, mutually exclusive), its quick-insert shortcut, and the
 * mobile Present action. Extracted verbatim from `PowerPointViewer.vue`.
 */
export function useMobileChrome(input: UseMobileChromeInput): UseMobileChromeResult {
	const { presenting, addText } = input,
		mobileSlidesOpen = ref(false),
		mobileInspectorOpen = ref(false),
		mobileCommentsOpen = ref(false),
		mobileNotesOpen = ref(false);

	/** Open one mobile sheet at a time so they don't stack over each other. */
	function openMobileSheet(which: MobileSheetKind): void {
		mobileSlidesOpen.value = which === 'slides';
		mobileInspectorOpen.value = which === 'format';
		mobileCommentsOpen.value = which === 'comments';
		mobileNotesOpen.value = which === 'notes';
	}

	/**
	 * Quick-insert from the mobile bottom bar: a text box is the most common
	 * starter element on a phone; the full Insert section lives in the top-bar
	 * Menu sheet. Mirrors React's MobileBottomBar `onOpenInsert`.
	 */
	function mobileQuickInsert(): void {
		addText();
	}
	function present(): void {
		presenting.value = true;
	}

	// Mirrors React's `activeSheet` derivation in MobileChromeOverlay: exactly one
	// sheet is open at a time (openMobileSheet enforces it), so the highlighted
	// tab is whichever ref is currently true.
	// oxlint-disable-next-line eslint/one-var -- distinct concerns from the refs/functions above, forcing one statement hurts readability
	const activeSheet = computed<MobileActiveSheet>(() => {
		if (mobileSlidesOpen.value) {
			return 'slides';
		}
		if (mobileInspectorOpen.value) {
			return 'format';
		}
		if (mobileCommentsOpen.value) {
			return 'comments';
		}
		if (mobileNotesOpen.value) {
			return 'notes';
		}
		return null;
	});

	/**
	 * Toggle a bottom-bar tab: decide the next sheet with shared's `toggleSheet`
	 * (translating through `SHARED_KEY`), then either open it or close all four
	 * refs. Replaces what used to be a hand-rolled "is this tab's own ref
	 * already open?" check per binding.
	 */
	function toggleMobileSheet(which: MobileSheetKind): void {
		const current = activeSheet.value ? SHARED_KEY[activeSheet.value] : null,
			next = toggleSheet(current, SHARED_KEY[which]);
		if (next === null) {
			mobileSlidesOpen.value = false;
			mobileInspectorOpen.value = false;
			mobileCommentsOpen.value = false;
			mobileNotesOpen.value = false;
		} else {
			openMobileSheet(which);
		}
	}

	return {
		mobileSlidesOpen,
		mobileInspectorOpen,
		mobileCommentsOpen,
		mobileNotesOpen,
		openMobileSheet,
		toggleMobileSheet,
		activeSheet,
		mobileQuickInsert,
		present,
	};
}
