/**
 * Shared models for the small non-ribbon chrome controls (#386): the read-only
 * banner, the Paste Options toolbar, the compatibility toast stack and the
 * dialog footer. Each was hand-built five times with the same state, gating
 * and callbacks. The elements own markup, state and gating; hosts own every
 * effect (unlocking, pasting, dismissing, closing).
 */
import type { PasteSpecialFormat } from './paste-special';

export type ChromeTranslate = (key: string, params?: Record<string, string | number>) => string;

// ---------------------------------------------------------------------------
// Read-only banner
// ---------------------------------------------------------------------------

export type ReadOnlyBannerPasswordError = 'wrong-password' | 'unsupported-algorithm';

export interface ReadOnlyBannerViewState {
	/** `ReadOnlyRecommendation.kind`; mirrored onto the host's `data-kind`. */
	kind: string | null;
	/** `ReadOnlyRecommendation.messageKey`, translated by `translate`. */
	messageKey: string;
	/** Swap the Edit anyway / Dismiss pair for the inline password form. */
	passwordPromptOpen?: boolean;
	passwordError?: ReadOnlyBannerPasswordError | null;
	/** Disables the form while a submitted password is being checked. */
	checkingPassword?: boolean;
	translate?: ChromeTranslate;
}

export type ReadOnlyBannerIntent =
	| { id: 'editAnyway' | 'dismiss' | 'cancelPassword' }
	| { id: 'submitPassword'; password: string };

// ---------------------------------------------------------------------------
// Paste Options toolbar
// ---------------------------------------------------------------------------

export interface PasteOptionsViewState {
	/** Right edge of the pasted element in viewport pixels. */
	left: number;
	/** Bottom edge of the pasted element in viewport pixels. */
	top: number;
	translate?: ChromeTranslate;
}

export interface PasteOptionsIntent {
	format: PasteSpecialFormat;
}

// ---------------------------------------------------------------------------
// Compatibility toasts
// ---------------------------------------------------------------------------

/** Toasts rendered before the rest collapse into a "+N" count. */
export const COMPAT_TOAST_VISIBLE_LIMIT = 5;

export interface CompatToastViewItem {
	readonly id: string;
	readonly code: string;
	readonly severity: 'info' | 'warning';
	readonly messageKey: string;
	readonly params?: Readonly<Record<string, string>>;
}

export interface CompatToastsViewState {
	/** Dismiss-filtered toasts. The element shows the first {@link COMPAT_TOAST_VISIBLE_LIMIT}. */
	toasts: readonly CompatToastViewItem[];
	/** Extra toasts a host already trimmed off the list it passes. */
	overflowCount?: number;
	/** Width of the open right-docked panel (see `compatToastStackStyle`). */
	rightInset?: number;
	/** Live height of the docked notes strip (see `compatToastStackStyle`). */
	bottomInset?: number;
	translate?: ChromeTranslate;
}

export type CompatToastsIntent = { id: 'dismissAll' } | { id: 'dismiss'; toastId: string };

// ---------------------------------------------------------------------------
// Dialog footer
// ---------------------------------------------------------------------------

export type DialogFooterVariant = 'secondary' | 'primary' | 'warning';
export type DialogFooterIcon = 'trash' | 'pen' | 'restore' | 'print' | 'check';

export interface DialogFooterAction {
	/** Stable id echoed back in the `dialog-footer-request` intent. */
	id: string;
	/** Already-translated visible label and accessible name. */
	label: string;
	variant?: DialogFooterVariant;
	icon?: DialogFooterIcon;
	disabled?: boolean;
	/** Optional `data-testid` stamped on the button. */
	testId?: string;
}

export interface DialogFooterViewState {
	actions: readonly DialogFooterAction[];
}

export interface DialogFooterIntent {
	id: string;
}

// ---------------------------------------------------------------------------
// Mobile bottom bar and top toolbar
// ---------------------------------------------------------------------------

export type MobileBarId = 'slides' | 'insert' | 'inspector' | 'comments' | 'notes';

export interface MobileBarViewState {
	/** Every button disables at 0 (see `buildBarActions`). */
	slideCount: number;
	/** The button whose sheet is open; reflected as `aria-pressed` and a top pill. */
	activeSheet?: MobileBarId | null;
	/** Comment count on the badge of Comments (`99+` above 99). */
	commentCount?: number;
	/** Buttons dropped entirely, such as Notes when `hiddenActions` hides it. */
	hidden?: readonly MobileBarId[];
	/** Buttons disabled beyond the no-slides rule, such as edit-only ones in view mode. */
	disabled?: readonly MobileBarId[];
	translate?: ChromeTranslate;
}

export interface MobileBarIntent {
	id: MobileBarId;
}

export type MobileToolbarId = 'menu' | 'undo' | 'redo' | 'ai' | 'save' | 'present' | 'share';

export interface MobileToolbarViewState {
	/** Menu, Undo, Redo, AI and Share only show while editing. */
	editable: boolean;
	canUndo: boolean;
	canRedo: boolean;
	/** Host opted into the AI assistant; the element draws its toggle. */
	aiVisible?: boolean;
	aiActive?: boolean;
	/** Reflected as `aria-expanded` on Menu when given. */
	menuOpen?: boolean;
	/** Buttons dropped entirely (`hiddenActions`, or Share when the host has none). */
	hidden?: readonly MobileToolbarId[];
	/** Buttons disabled, such as Present while there is nothing to present. */
	disabled?: readonly MobileToolbarId[];
	translate?: ChromeTranslate;
}

export interface MobileToolbarIntent {
	id: MobileToolbarId;
}
