import { definePptxCheckbox } from './checkbox';
import { definePptxContextMenu } from './context-menu';
import { definePptxCompatToasts } from './compat-toasts';
import { definePptxDialogFooter } from './dialog-footer';
import { HOST_STYLES } from './host-styles';
import { definePptxNotesToolbar } from './notes-toolbar';
import { definePptxMobileBar } from './mobile-bar';
import { definePptxMobileToolbar } from './mobile-toolbar';
import { definePptxPasteOptions } from './paste-options';
import { definePptxReadOnlyBanner } from './read-only-banner';
import { assertWebControlContract, markWebControlContract } from './registration-contract';
import { definePptxRibbonAnimations } from './ribbon-animations';
import { definePptxRibbonCommand } from './ribbon-command';
import { definePptxRibbonDraw } from './ribbon-draw';
import { definePptxRibbonGallery } from './ribbon-gallery';
import { definePptxRibbonGroup } from './ribbon-group';
import {
	definePptxRibbonHomeArrangeAlign,
	definePptxRibbonHomeArrangeEdit,
	definePptxRibbonHomeArrangeFlip,
	definePptxRibbonHomeArrangeOrder,
	definePptxRibbonHomeClipboard,
	definePptxRibbonHomeDrawing,
	definePptxRibbonHomeEditing,
	definePptxRibbonHomeFont,
	definePptxRibbonHomeParagraph,
	definePptxRibbonHomeSlides,
} from './ribbon-home';
import { definePptxRibbonInsert } from './ribbon-insert';
import { definePptxRibbonSection } from './ribbon-section';
import { definePptxRibbonToggle } from './ribbon-toggle';
import { definePptxRibbonTransitions } from './ribbon-transitions';
import { definePptxRibbonView } from './ribbon-view';
import { definePptxSearchField } from './search-field';
import { definePptxSelect } from './select';
import { definePptxSlideShowOptions } from './slide-show-options';
import { definePptxStatusBar } from './status-bar';
import { definePptxSubtitleSettings } from './subtitle-settings';
import { definePptxThemeEditor } from './theme-editor';
import { definePptxTitleBar } from './title-bar';

export type { PptxUiThemeEditorElement, ThemeEditorApplyEvent } from './theme-editor';
export type { CompatToastsRequestEvent, PptxUiCompatToastsElement } from './compat-toasts';
export type { DialogFooterRequestEvent, PptxUiDialogFooterElement } from './dialog-footer';
export type { MobileBarRequestEvent, PptxUiMobileBarElement } from './mobile-bar';
export type { MobileToolbarRequestEvent, PptxUiMobileToolbarElement } from './mobile-toolbar';
export type { PasteOptionsRequestEvent, PptxUiPasteOptionsElement } from './paste-options';
export type { PptxUiReadOnlyBannerElement, ReadOnlyBannerRequestEvent } from './read-only-banner';

export type { RibbonCommandRequestEvent } from './ribbon-command';
export type {
	PptxUiRibbonAnimationsElement,
	RibbonAnimationsRequestEvent,
} from './ribbon-animations';
export type { PptxUiRibbonDrawElement, RibbonDrawRequestEvent } from './ribbon-draw';
export type { PptxUiRibbonHomeElement, RibbonHomeRequestEvent } from './ribbon-home';
export type {
	PptxUiRibbonTransitionsElement,
	RibbonTransitionsRequestEvent,
} from './ribbon-transitions';
export type { PptxUiRibbonInsertElement, RibbonInsertRequestEvent } from './ribbon-insert';
export type { PptxUiRibbonViewElement, RibbonViewRequestEvent } from './ribbon-view';
export type { PptxUiRibbonSectionElement } from './ribbon-section';
export type { PptxUiRibbonGalleryElement, RibbonGalleryPickEvent } from './ribbon-gallery';
export type { GalleryTranslate } from './ribbon-gallery-view';
export type { RibbonToggleRequestEvent } from './ribbon-toggle';
export type {
	PptxUiSubtitleSettingsElement,
	SubtitleSettingsChangeEvent,
} from './subtitle-settings';

export type { PptxUiStatusBarElement, StatusBarRequestEvent } from './status-bar';
export type { NotesToolbarRequestEvent, PptxUiNotesToolbarElement } from './notes-toolbar';
export type { PptxUiTitleBarElement, TitleBarCommandSearchEvent, TitleBarEvent } from './title-bar';
export type {
	ContextMenuCloseEvent,
	ContextMenuRequestEvent,
	PptxUiContextMenuElement,
} from './context-menu';
export type {
	ContextMenuCloseDetail,
	ContextMenuCloseReason,
	ContextMenuRequestDetail,
	ContextMenuViewItem,
	ContextMenuViewState,
} from './context-menu-model';
export { CONTEXT_MENU_EDITOR_LAYER, CONTEXT_MENU_PRESENTATION_LAYER } from './context-menu-model';
export {
	contextMenuViewItems,
	presentationViewItems,
	slidePaneViewItems,
} from './context-menu-items';
export type { PptxUiSelectElement } from './select-value';
export type {
	PptxUiSlideShowOptionsElement,
	SlideShowOptionsChangeEvent,
} from './slide-show-options';

const controls = [
	['pptx-ui-search', definePptxSearchField],
	['pptx-ui-checkbox', definePptxCheckbox],
	['pptx-ui-select', definePptxSelect],
	['pptx-ui-slide-show-options', definePptxSlideShowOptions],
	['pptx-ui-compat-toasts', definePptxCompatToasts],
	['pptx-ui-dialog-footer', definePptxDialogFooter],
	['pptx-ui-mobile-bar', definePptxMobileBar],
	['pptx-ui-mobile-toolbar', definePptxMobileToolbar],
	['pptx-ui-paste-options', definePptxPasteOptions],
	['pptx-ui-read-only-banner', definePptxReadOnlyBanner],
	['pptx-ui-ribbon-command', definePptxRibbonCommand],
	['pptx-ui-ribbon-animations', definePptxRibbonAnimations],
	['pptx-ui-ribbon-draw', definePptxRibbonDraw],
	['pptx-ui-ribbon-insert', definePptxRibbonInsert],
	['pptx-ui-ribbon-home-clipboard', definePptxRibbonHomeClipboard],
	['pptx-ui-ribbon-home-font', definePptxRibbonHomeFont],
	['pptx-ui-ribbon-home-paragraph', definePptxRibbonHomeParagraph],
	['pptx-ui-ribbon-home-editing', definePptxRibbonHomeEditing],
	['pptx-ui-ribbon-home-slides', definePptxRibbonHomeSlides],
	['pptx-ui-ribbon-home-drawing', definePptxRibbonHomeDrawing],
	['pptx-ui-ribbon-home-arrange-align', definePptxRibbonHomeArrangeAlign],
	['pptx-ui-ribbon-home-arrange-flip', definePptxRibbonHomeArrangeFlip],
	['pptx-ui-ribbon-home-arrange-order', definePptxRibbonHomeArrangeOrder],
	['pptx-ui-ribbon-home-arrange-edit', definePptxRibbonHomeArrangeEdit],
	['pptx-ui-ribbon-view', definePptxRibbonView],
	['pptx-ui-ribbon-transitions', definePptxRibbonTransitions],
	['pptx-ui-ribbon-group', definePptxRibbonGroup],
	['pptx-ui-ribbon-section', definePptxRibbonSection],
	['pptx-ui-ribbon-gallery', definePptxRibbonGallery],
	['pptx-ui-ribbon-toggle', definePptxRibbonToggle],
	['pptx-ui-status-bar', definePptxStatusBar],
	['pptx-ui-notes-toolbar', definePptxNotesToolbar],
	['pptx-ui-context-menu', definePptxContextMenu],
	['pptx-ui-subtitle-settings', definePptxSubtitleSettings],
	['pptx-ui-theme-editor', definePptxThemeEditor],
	['pptx-ui-title-bar', definePptxTitleBar],
] as const;

/** Idempotent browser-only registration. Safe to call from every viewer binding. */
export function registerPptxWebControls(): void {
	if (typeof window === 'undefined' || !window.customElements) {
		return;
	}
	const registry = window.customElements;
	assertWebControlContract(
		registry,
		controls.map(([name]) => name),
	);
	if (!document.getElementById('pptx-ui-control-hosts')) {
		const style = document.createElement('style');
		style.id = 'pptx-ui-control-hosts';
		style.textContent = HOST_STYLES;
		document.head.append(style);
	}
	for (const [name, define] of controls) {
		if (!registry.get(name)) {
			define(registry);
			markWebControlContract(registry.get(name)!);
		}
	}
}
