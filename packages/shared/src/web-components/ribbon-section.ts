import { defineRibbonSection } from 'ooxml-ui/controls';

import type { RibbonGroupView } from '../render/ribbon-command-view';
import { definePptxRibbonCommand, definePptxRibbonGroup } from './office-aliases';

export interface PptxUiRibbonSectionElement extends HTMLElement {
	groups: readonly RibbonGroupView[];
}

declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-ribbon-section': PptxUiRibbonSectionElement;
	}
}

/**
 * `pptx-ui-ribbon-section`: the shared keyed `office-ui-ribbon-section` building pptx groups
 * and commands, so the `data-ribbon-group` / `data-ribbon-control` customization ids and the
 * existing intent events stay unchanged.
 */
export function definePptxRibbonSection(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-ribbon-section')) {
		return;
	}
	definePptxRibbonGroup(registry);
	definePptxRibbonCommand(registry);
	defineRibbonSection(registry);
	const Base = registry.get('office-ui-ribbon-section') as unknown as new () => HTMLElement;
	class PptxRibbonSection extends Base {
		static groupTag = 'pptx-ui-ribbon-group';
		static commandTag = 'pptx-ui-ribbon-command';
		static groupIdAttribute = 'data-ribbon-group';
		static commandIdAttribute = 'data-ribbon-control';
	}
	registry.define('pptx-ui-ribbon-section', PptxRibbonSection);
}
