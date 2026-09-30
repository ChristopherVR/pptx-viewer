import { normalizeSubtitleSettings, subtitleLanguageLabel, SUBTITLE_LANGUAGES } from '../render';
import type { SubtitleSettings, SubtitleSettingsLabels } from '../render';
import { attachControlStyles } from './control-styles';
import type { PptxUiSelectElement } from './select-value';
import { SUBTITLE_SETTINGS_STYLES } from './subtitle-settings-styles';

export interface PptxUiSubtitleSettingsElement extends HTMLElement {
	settings: SubtitleSettings;
	labels: SubtitleSettingsLabels;
	languageDisabled: boolean;
}
export type SubtitleSettingsChangeEvent = CustomEvent<SubtitleSettings>;
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-subtitle-settings': PptxUiSubtitleSettingsElement;
	}
}

/** Shared trigger and modal. Hosts own preferences; Apply emits one controlled update. */
export function definePptxSubtitleSettings(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-subtitle-settings')) {
		return;
	}
	class SubtitleSettingsElement extends HTMLElement implements PptxUiSubtitleSettingsElement {
		private current = normalizeSubtitleSettings();
		private text: SubtitleSettingsLabels = {
			title: 'Subtitle Settings',
			language: 'Spoken language',
			browserLanguage: 'Browser language',
			description: '',
			apply: 'Apply',
			cancel: 'Cancel',
		};
		private readonly command: HTMLElement;
		private readonly dialog: HTMLDialogElement;
		private readonly heading: HTMLHeadingElement;
		private readonly description: HTMLParagraphElement;
		private readonly languageLabel: HTMLLabelElement;
		private readonly language: PptxUiSelectElement;
		private readonly apply: HTMLButtonElement;
		private readonly cancel: HTMLButtonElement;
		constructor() {
			super();
			const root = this.attachShadow({ mode: 'open' });
			attachControlStyles(root, SUBTITLE_SETTINGS_STYLES);
			this.command = document.createElement('pptx-ui-ribbon-command');
			this.command.setAttribute('data-ribbon-control', 'slideShow.captions.subtitleSettings');
			this.command.setAttribute('icon', 'captions');
			this.command.setAttribute('compact', '');
			this.dialog = document.createElement('dialog');
			this.heading = document.createElement('h2');
			this.description = document.createElement('p');
			this.languageLabel = document.createElement('label');
			this.language = document.createElement('pptx-ui-select');
			this.language.id = 'spoken-language';
			this.languageLabel.htmlFor = this.language.id;
			const footer = document.createElement('footer');
			this.cancel = document.createElement('button');
			this.cancel.type = 'button';
			this.apply = document.createElement('button');
			this.apply.type = 'button';
			footer.append(this.cancel, this.apply);
			this.dialog.append(this.heading, this.description, this.languageLabel, this.language, footer);
			root.append(this.command, this.dialog);
			this.command.addEventListener('command-request', () => this.open());
			this.cancel.addEventListener('click', () => this.close());
			this.dialog.addEventListener('cancel', (event) => {
				event.preventDefault();
				this.close();
			});
			this.dialog.addEventListener('keydown', (event) => {
				event.stopPropagation();
				if (event.key === 'Tab') {
					const picker = this.language.shadowRoot?.querySelector<HTMLButtonElement>('button');
					const controls = [
						...(picker && !picker.disabled ? [picker] : []),
						this.cancel,
						this.apply,
					];
					const active = event.composedPath()[0];
					const index = controls.findIndex((control) => control === active);
					event.preventDefault();
					controls[(index + (event.shiftKey ? controls.length - 1 : 1)) % controls.length].focus();
				}
				if (event.key === 'Escape') {
					event.preventDefault();
					this.close();
				}
			});
			this.apply.addEventListener('click', () => {
				const settings = normalizeSubtitleSettings({ spokenLanguage: this.language.value });
				this.dispatchEvent(
					new CustomEvent('subtitle-settings-change', {
						detail: settings,
						bubbles: true,
						composed: true,
					}),
				);
				this.close();
			});
		}
		get settings(): SubtitleSettings {
			return { ...this.current };
		}
		set settings(value: SubtitleSettings) {
			this.current = normalizeSubtitleSettings(value);
		}
		get labels(): SubtitleSettingsLabels {
			return this.text;
		}
		set labels(value: SubtitleSettingsLabels) {
			this.text = { ...this.text, ...value };
			this.sync();
		}
		get languageDisabled(): boolean {
			return this.language.disabled;
		}
		set languageDisabled(value: boolean) {
			this.language.disabled = value;
		}
		connectedCallback(): void {
			this.sync();
		}
		disconnectedCallback(): void {
			if (this.dialog.open) {
				this.dialog.close();
			}
		}
		private open(): void {
			if (this.dialog.open) {
				return;
			}
			this.sync();
			this.language.value = this.current.spokenLanguage;
			this.dialog.showModal();
			this.language.shadowRoot?.querySelector<HTMLButtonElement>('button')?.focus();
		}
		private close(): void {
			this.dialog.close();
			this.command.shadowRoot?.querySelector<HTMLButtonElement>('button')?.focus();
		}
		private sync(): void {
			this.command.setAttribute('label', this.text.title);
			this.dialog.setAttribute('aria-label', this.text.title);
			this.heading.textContent = this.text.title;
			this.description.textContent = this.text.description;
			this.languageLabel.textContent = this.text.language;
			this.language.setAttribute('aria-label', this.text.language);
			this.cancel.textContent = this.text.cancel;
			this.apply.textContent = this.text.apply;
			this.language.replaceChildren(
				...SUBTITLE_LANGUAGES.map((value) => {
					const option = document.createElement('option');
					option.value = value;
					option.textContent =
						value === 'auto' ? this.text.browserLanguage : subtitleLanguageLabel(value);
					return option;
				}),
			);
		}
	}
	registry.define('pptx-ui-subtitle-settings', SubtitleSettingsElement);
}
