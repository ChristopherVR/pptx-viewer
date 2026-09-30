import type { RibbonGroupView } from '../render/ribbon-command-view';
import { createRibbonSectionView } from './ribbon-section-view';

export interface PptxUiRibbonSectionElement extends HTMLElement {
	groups: readonly RibbonGroupView[];
}

declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-ribbon-section': PptxUiRibbonSectionElement;
	}
}

/** Whole command/group families use one keyed view and the existing intent ABI. */
export function definePptxRibbonSection(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-ribbon-section')) {
		return;
	}
	class RibbonSection extends HTMLElement implements PptxUiRibbonSectionElement {
		private model: readonly RibbonGroupView[] = [];
		private readonly render = createRibbonSectionView(this);
		get groups() {
			return this.model;
		}
		set groups(value: readonly RibbonGroupView[]) {
			this.model = value;
			this.render(value);
		}
		connectedCallback(): void {
			this.style.display = 'inline-flex';
			this.style.alignItems = 'stretch';
			this.render(this.model);
		}
	}
	registry.define('pptx-ui-ribbon-section', RibbonSection);
}
