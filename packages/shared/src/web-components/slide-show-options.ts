import type { PptxPresentationProperties } from 'pptx-viewer-core';

import { readSlideShowOption, SLIDE_SHOW_OPTIONS, slideShowOptionChange } from '../render';
import type { SlideShowOptionId } from '../render';
import { attachControlStyles } from './control-styles';
import { SLIDE_SHOW_OPTIONS_STYLES } from './slide-show-options-styles';

export interface PptxUiSlideShowOptionsElement extends HTMLElement {
	presentationProperties: PptxPresentationProperties | undefined;
	labels: Partial<Record<SlideShowOptionId, string>>;
	disabled: boolean;
}

export type SlideShowOptionsChangeEvent = CustomEvent<Partial<PptxPresentationProperties>>;

/** Controlled ribbon options. The host owns document edits, history and persistence. */
export function definePptxSlideShowOptions(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-slide-show-options')) {
		return;
	}

	class SlideShowOptions extends HTMLElement implements PptxUiSlideShowOptionsElement {
		static observedAttributes = ['disabled'];
		private properties: PptxPresentationProperties | undefined;
		private optionLabels: Partial<Record<SlideShowOptionId, string>> = {};
		private readonly rows = new Map<
			SlideShowOptionId,
			{
				checkbox: HTMLElement & { checked: boolean; disabled: boolean };
				text: Text;
			}
		>();

		constructor() {
			super();
			const root = this.attachShadow({ mode: 'open' });
			attachControlStyles(root, SLIDE_SHOW_OPTIONS_STYLES);
			const columns = [document.createElement('div'), document.createElement('div')];
			for (const column of columns) {
				column.className = 'column';
			}
			SLIDE_SHOW_OPTIONS.forEach((option, index) => {
				const label = document.createElement('label');
				const checkbox = document.createElement('pptx-ui-checkbox') as HTMLElement & {
					checked: boolean;
					disabled: boolean;
				};
				const text = document.createTextNode('');
				label.append(checkbox, text);
				// Forward label activation explicitly, including DOMs without form-associated labels.
				label.addEventListener('click', (event) => {
					event.preventDefault();
					if (event.target !== checkbox) {
						checkbox.click();
					}
				});
				columns[index < 3 ? 0 : 1].append(label);
				this.rows.set(option.id, { checkbox, text });
				checkbox.addEventListener('change', (event) => {
					event.stopPropagation();
					const change = slideShowOptionChange(option.id, checkbox.checked);
					this.sync();
					if (!this.disabled && !option.unsupported && change) {
						this.dispatchEvent(
							new CustomEvent('show-options-change', {
								detail: change,
								bubbles: true,
								composed: true,
							}),
						);
					}
				});
				checkbox.addEventListener('input', (event) => event.stopPropagation());
			});
			// Captions stay host-owned until their command family is migrated.
			columns[1].append(document.createElement('slot'));
			root.append(...columns);
		}

		connectedCallback(): void {
			this.sync();
		}
		attributeChangedCallback(): void {
			this.sync();
		}
		get presentationProperties(): PptxPresentationProperties | undefined {
			return this.properties;
		}
		set presentationProperties(value: PptxPresentationProperties | undefined) {
			this.properties = value;
			this.sync();
		}
		get labels(): Partial<Record<SlideShowOptionId, string>> {
			return this.optionLabels;
		}
		set labels(value: Partial<Record<SlideShowOptionId, string>>) {
			this.optionLabels = value ?? {};
			this.sync();
		}
		get disabled(): boolean {
			return this.hasAttribute('disabled');
		}
		set disabled(value: boolean) {
			this.toggleAttribute('disabled', Boolean(value));
		}

		private sync(): void {
			for (const option of SLIDE_SHOW_OPTIONS) {
				const row = this.rows.get(option.id)!;
				const label = this.optionLabels[option.id] ?? option.labelKey;
				row.text.textContent = label;
				row.checkbox.setAttribute('aria-label', label);
				row.checkbox.checked = readSlideShowOption(this.properties, option.id);
				row.checkbox.disabled = this.disabled || option.unsupported;
			}
		}
	}
	registry.define('pptx-ui-slide-show-options', SlideShowOptions);
}
