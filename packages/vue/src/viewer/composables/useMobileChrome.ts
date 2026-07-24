import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

export type MobileSheetKind = 'slides' | 'format' | 'comments' | 'notes';

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
	const { presenting, addText } = input;

	const mobileSlidesOpen = ref(false);
	const mobileInspectorOpen = ref(false);
	const mobileCommentsOpen = ref(false);
	const mobileNotesOpen = ref(false);

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

	return {
		mobileSlidesOpen,
		mobileInspectorOpen,
		mobileCommentsOpen,
		mobileNotesOpen,
		openMobileSheet,
		activeSheet,
		mobileQuickInsert,
		present,
	};
}
