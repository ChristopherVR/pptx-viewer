import type {
	CompatToastsIntent,
	CompatToastsViewState,
	DialogFooterIntent,
	DialogFooterViewState,
	PasteOptionsIntent,
	PasteOptionsViewState,
	ReadOnlyBannerIntent,
	ReadOnlyBannerViewState,
	RibbonControlId,
} from '../render';
import type {
	ContextMenuCloseDetail,
	ContextMenuRequestDetail,
	ContextMenuViewState,
} from './context-menu-model';

/**
 * Public types of the `pptx-ui-*` tags implemented by `ooxml-ui` (see `office-aliases.ts`).
 * Unchanged from when pptx-viewer owned the implementations.
 */
export type CompatToastsRequestEvent = CustomEvent<CompatToastsIntent>;
export interface PptxUiCompatToastsElement extends HTMLElement {
	state: CompatToastsViewState;
}

export type DialogFooterRequestEvent = CustomEvent<DialogFooterIntent>;
export interface PptxUiDialogFooterElement extends HTMLElement {
	state: DialogFooterViewState;
	/** Move keyboard focus to an action, e.g. the primary one when a dialog opens. */
	focusAction(id: string): void;
}

export type PasteOptionsRequestEvent = CustomEvent<PasteOptionsIntent>;
export interface PptxUiPasteOptionsElement extends HTMLElement {
	state: PasteOptionsViewState;
}

export type ReadOnlyBannerRequestEvent = CustomEvent<ReadOnlyBannerIntent>;
export interface PptxUiReadOnlyBannerElement extends HTMLElement {
	state: ReadOnlyBannerViewState;
}

export type RibbonCommandRequestEvent = CustomEvent<{ id: RibbonControlId }>;

export type ContextMenuRequestEvent = CustomEvent<ContextMenuRequestDetail>;
export type ContextMenuCloseEvent = CustomEvent<ContextMenuCloseDetail>;
export interface PptxUiContextMenuElement extends HTMLElement {
	state: ContextMenuViewState;
}

export type RibbonToggleRequestEvent = CustomEvent<{ id: RibbonControlId; checked: boolean }>;

declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-compat-toasts': PptxUiCompatToastsElement;
		'pptx-ui-context-menu': PptxUiContextMenuElement;
		'pptx-ui-dialog-footer': PptxUiDialogFooterElement;
		'pptx-ui-paste-options': PptxUiPasteOptionsElement;
		'pptx-ui-read-only-banner': PptxUiReadOnlyBannerElement;
	}
}
