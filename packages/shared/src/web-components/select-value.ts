/** Public DOM shape used by all bindings; the element is not a native select. */
export interface PptxUiSelectElement extends HTMLElement {
	value: string;
	disabled: boolean;
	readonly options: HTMLOptionElement[];
	selectedIndex: number;
}

declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-select': PptxUiSelectElement;
	}
}

/** Create the base only in a browser; shared imports also run during SSR. */
export function createSelectValueElement() {
	class SelectValueElement extends HTMLElement {
		get value(): string {
			const requested = this.getAttribute('value');
			const options = this.options;
			if (
				requested !== null &&
				(!options.length || options.some((option) => option.value === requested))
			) {
				return requested;
			}
			return (
				options.find((option) => option.selected)?.value ??
				options.find(
					(option) => !option.disabled && !option.closest('optgroup[disabled]') && !option.hidden,
				)?.value ??
				options[0]?.value ??
				requested ??
				''
			);
		}
		set value(next: string) {
			this.setAttribute('value', String(next ?? ''));
		}

		get options(): HTMLOptionElement[] {
			return [...this.querySelectorAll('option')];
		}
		get selectedIndex(): number {
			return this.options.findIndex((option) => option.value === this.value);
		}
		set selectedIndex(index: number) {
			this.value = this.options[index]?.value ?? '';
		}
	}
	return SelectValueElement;
}
