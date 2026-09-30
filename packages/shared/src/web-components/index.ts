import { definePptxCheckbox } from './checkbox';
import { HOST_STYLES } from './host-styles';
import { assertWebControlContract, markWebControlContract } from './registration-contract';
import { definePptxRibbonCommand } from './ribbon-command';
import { definePptxRibbonGallery } from './ribbon-gallery';
import { definePptxRibbonGroup } from './ribbon-group';
import { definePptxRibbonSection } from './ribbon-section';
import { definePptxRibbonToggle } from './ribbon-toggle';
import { definePptxSearchField } from './search-field';
import { definePptxSelect } from './select';
import { definePptxSlideShowOptions } from './slide-show-options';
import { definePptxSubtitleSettings } from './subtitle-settings';
import { definePptxThemeEditor } from './theme-editor';

export type { PptxUiThemeEditorElement, ThemeEditorApplyEvent } from './theme-editor';

export type { RibbonCommandRequestEvent } from './ribbon-command';
export type { PptxUiRibbonSectionElement } from './ribbon-section';
export type { PptxUiRibbonGalleryElement, RibbonGalleryPickEvent } from './ribbon-gallery';
export type { GalleryTranslate } from './ribbon-gallery-view';
export type { RibbonToggleRequestEvent } from './ribbon-toggle';
export type {
	PptxUiSubtitleSettingsElement,
	SubtitleSettingsChangeEvent,
} from './subtitle-settings';

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
	['pptx-ui-ribbon-command', definePptxRibbonCommand],
	['pptx-ui-ribbon-group', definePptxRibbonGroup],
	['pptx-ui-ribbon-section', definePptxRibbonSection],
	['pptx-ui-ribbon-gallery', definePptxRibbonGallery],
	['pptx-ui-ribbon-toggle', definePptxRibbonToggle],
	['pptx-ui-subtitle-settings', definePptxSubtitleSettings],
	['pptx-ui-theme-editor', definePptxThemeEditor],
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
