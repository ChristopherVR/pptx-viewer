import type { PptxEmbeddedFont, PptxSlide } from 'pptx-viewer-core';
import { collectUsedFonts, scanAvailableFontFamilies } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { appendInfoDoneButton, openFileInfoDialogShell } from './file-info-dialog-shell';

export interface FontEmbeddingDialogOptions {
	slides: readonly PptxSlide[];
	embeddedFonts: readonly PptxEmbeddedFont[];
	enabled: boolean;
	onToggle(enabled: boolean): void;
}

export function openFontEmbeddingDialog(
	doc: Document,
	t: Translator,
	options: FontEmbeddingDialogOptions,
): HTMLElement {
	const shell = openFileInfoDialogShell(doc, t, t('pptx.fonts.embedFonts'));
	const description = createEl(doc, 'p', 'pptxv-info-description');
	description.textContent = t('pptx.fonts.embedDescription');
	const toggle = createEl(doc, 'label', 'pptxv-info-toggle');
	const checkbox = createEl(doc, 'input');
	checkbox.type = 'checkbox';
	checkbox.checked = options.enabled;
	checkbox.addEventListener('change', () => options.onToggle(checkbox.checked));
	const toggleLabel = createEl(doc, 'span');
	toggleLabel.textContent = t('pptx.fonts.enableEmbedding');
	toggle.append(checkbox, toggleLabel);

	const families = collectUsedFonts(options.slides);
	const embedded = new Set(options.embeddedFonts.map((font) => font.name));
	const heading = createEl(doc, 'h3');
	heading.textContent = `${t('pptx.fonts.usedFonts')} (${families.length})`;
	const list = createEl(doc, 'div', 'pptxv-info-list');
	const status = createEl(doc, 'p', 'pptxv-info-status');
	status.textContent = t('pptx.fonts.scanning');
	list.appendChild(status);

	void scanAvailableFontFamilies(families).then((available) => {
		if (!shell.overlay.isConnected) {
			return undefined;
		}
		list.replaceChildren();
		for (const family of families) {
			const row = createEl(doc, 'div', 'pptxv-info-row');
			const name = createEl(doc, 'span');
			name.textContent = family;
			const badges = createEl(doc, 'span', 'pptxv-info-badges');
			if (embedded.has(family)) {
				const badge = createEl(doc, 'b');
				badge.textContent = t('pptx.fonts.embedded');
				badges.appendChild(badge);
			}
			const availability = createEl(doc, 'em');
			availability.classList.toggle('is-missing', !available.has(family));
			availability.textContent = available.has(family) ? '✓' : t('pptx.fonts.notFound');
			badges.appendChild(availability);
			row.append(name, badges);
			list.appendChild(row);
		}
		return undefined;
	});

	shell.body.append(description, toggle, heading, list);
	appendInfoDoneButton(doc, t, shell);
	return shell.overlay;
}
