import { definePptxCheckbox } from './checkbox';
import { HOST_STYLES } from './host-styles';
import { assertWebControlContract, markWebControlContract } from './registration-contract';
import { definePptxRibbonCommand } from './ribbon-command';
import { definePptxRibbonGroup } from './ribbon-group';
import { definePptxRibbonToggle } from './ribbon-toggle';
import { definePptxSearchField } from './search-field';
import { definePptxSelect } from './select';
import { definePptxSlideShowOptions } from './slide-show-options';
import { definePptxSubtitleSettings } from './subtitle-settings';

export type { RibbonCommandRequestEvent } from './ribbon-command';
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
	['pptx-ui-ribbon-toggle', definePptxRibbonToggle],
	['pptx-ui-subtitle-settings', definePptxSubtitleSettings],
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
