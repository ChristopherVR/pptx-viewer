import { CUSTOM_FONT_ACCEPT, registerCustomFont } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

/**
 * File > Options > General > Fonts.
 *
 * Lets the user hand a local font file to the viewer so a deck authored with a
 * font the browser lacks renders with the real face instead of a substitute.
 * Opt-in, and deliberately session-scoped: the file is added to the page's font
 * set and nothing is uploaded or written into the presentation.
 *
 * @module settings-custom-fonts
 */
export interface CustomFontsPaneDeps {
	/** Mirrors `general.enableCustomFontUpload`; the picker stays inert when off. */
	enabled: boolean;
	/** Families registered so far this session. */
	families: readonly string[];
	/** Notifies the viewer so the Home tab font list picks the family up. */
	onRegistered(family: string): void;
	/** Re-renders the pane so a newly added family shows up in the list. */
	onRefresh(): void;
}

/** Append the Fonts section's bespoke controls to `host`. */
export function appendCustomFontsPane(
	doc: Document,
	t: Translator,
	host: HTMLElement,
	deps: CustomFontsPaneDeps,
): void {
	const input = createEl(doc, 'input', 'pptxv-visually-hidden') as HTMLInputElement;
	input.type = 'file';
	input.accept = CUSTOM_FONT_ACCEPT;
	input.hidden = true;

	const button = createEl(doc, 'button', 'pptxv-options-action') as HTMLButtonElement;
	button.type = 'button';
	button.textContent = t('pptx.options.general.addFontFile');
	button.disabled = !deps.enabled;
	button.addEventListener('click', () => input.click());

	const error = createEl(doc, 'p', 'pptxv-options-section-desc');
	error.setAttribute('role', 'alert');
	error.hidden = true;
	error.textContent = t('pptx.options.general.customFontError');

	input.addEventListener('change', () => {
		const file = input.files?.[0];
		// Clear the value so re-picking the same file fires change again.
		input.value = '';
		if (!file) {
			return;
		}
		error.hidden = true;
		void registerCustomFont(file)
			.then((registration) => {
				if (registration) {
					deps.onRegistered(registration.family);
					deps.onRefresh();
				} else {
					// Either the environment has no FontFace support, or the
					// filename reduced to nothing usable once its style tokens
					// were stripped.
					error.hidden = false;
				}
				return undefined;
			})
			.catch(() => {
				error.hidden = false;
			});
	});

	host.append(button, input, error);

	if (!deps.enabled) {
		const hint = createEl(doc, 'p', 'pptxv-options-section-desc');
		hint.textContent = t('pptx.options.general.customFontsDisabled');
		host.appendChild(hint);
	}

	const heading = createEl(doc, 'p', 'pptxv-options-section-desc');
	heading.textContent = t('pptx.options.general.customFontsAdded');
	host.appendChild(heading);

	if (deps.families.length === 0) {
		const empty = createEl(doc, 'p', 'pptxv-options-section-desc');
		empty.textContent = t('pptx.options.general.customFontsEmpty');
		host.appendChild(empty);
		return;
	}

	const list = createEl(doc, 'ul', 'pptxv-options-font-list');
	for (const family of deps.families) {
		const item = createEl(doc, 'li');
		item.textContent = family;
		item.style.fontFamily = family;
		list.appendChild(item);
	}
	host.appendChild(list);
}
