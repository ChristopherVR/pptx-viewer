import type { PptxEmbeddedFont, PptxSlide } from 'pptx-viewer-core';
import { collectUsedFonts, scanAvailableFontFamilies } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { appendInfoDoneButton, openFileInfoDialogShell } from './file-info-dialog-shell';

export interface FontEmbeddingDialogOptions {
	slides: readonly PptxSlide[];
	embeddedFonts: readonly PptxEmbeddedFont[];
	enabled: boolean;
	/**
	 * False when the deck embeds nothing, in which case the switch is inert and
	 * says why: the viewer can keep or strip embedded font data on save, but it
	 * cannot manufacture it from an installed system face.
	 */
	canEmbed?: boolean;
	/** i18n key for the explanation shown when `canEmbed` is false. */
	unavailableKey?: string;
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
	const canEmbed = options.canEmbed !== false;
	const toggle = createEl(doc, 'label', 'pptxv-info-toggle');
	const checkbox = createEl(doc, 'input');
	checkbox.type = 'checkbox';
	checkbox.checked = options.enabled;
	checkbox.disabled = !canEmbed;
	checkbox.addEventListener('change', () => options.onToggle(checkbox.checked));
	const toggleLabel = createEl(doc, 'span');
	toggleLabel.textContent = t('pptx.fonts.enableEmbedding');
	toggle.append(checkbox, toggleLabel);
	// The switch used to move and change nothing at all. It now decides whether
	// save keeps the deck's embedded font data, so it has to say which of the two
	// it is doing, and admit when it can do neither.
	const note = createEl(doc, 'p', 'pptxv-info-status');
	note.textContent = canEmbed
		? t('pptx.fonts.embedKeepsExisting')
		: t(options.unavailableKey ?? 'pptx.fonts.embedUnavailable');

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

	shell.body.append(description, toggle, note, heading, list);
	appendInfoDoneButton(doc, t, shell);
	return shell.overlay;
}
