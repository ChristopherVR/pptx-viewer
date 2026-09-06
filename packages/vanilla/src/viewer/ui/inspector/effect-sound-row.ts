import { EFFECT_SOUND_CATALOGUE, getEffectSoundAsset } from 'pptx-viewer-shared';
import type { EffectSoundState } from 'pptx-viewer-shared';

import { playAnimationSound } from '../../animation/animation-sound';
import type { Translator } from '../../i18n';
import { createEl } from '../../render';

const NONE_VALUE = 'none';
const CURRENT_VALUE = 'current';
const OTHER_VALUE = 'other';

export interface EffectSoundRow {
	el: HTMLElement;
	update(state: EffectSoundState & { editable: boolean }): void;
}

/**
 * The animation panel's effect sound row: PowerPoint's own gallery of 19
 * built-in stock sounds, "No Sound", and "Other Sound..." (a custom audio
 * file picked from disk), plus a Preview button for the currently-selected
 * stock sound. Picking a file (or a stock sound) hands the caller a pending
 * `data:` URL; the core save pipeline embeds it and mints its relationship.
 */
export function createEffectSoundRow(
	doc: Document,
	t: Translator,
	onPick: (pick: { dataUrl: string; fileName?: string } | undefined) => void,
	onPickStock: (catalogueId: string) => void,
): EffectSoundRow {
	const el = createEl(doc, 'label', 'pptxv-effect-sound-row');
	const caption = createEl(doc, 'span');
	caption.textContent = t('pptx.animation.sound');

	const controlsRow = createEl(doc, 'div', 'pptxv-effect-sound-controls');

	const select = doc.createElement('select');
	select.setAttribute('aria-label', t('pptx.animation.sound'));
	const none = doc.createElement('option');
	none.value = NONE_VALUE;
	none.textContent = t('pptx.animation.sound.none');
	// The "current custom file" option is inserted right AFTER None, only
	// while it applies (see `update`), matching the other four bindings'
	// conditional render.
	const current = doc.createElement('option');
	current.value = CURRENT_VALUE;
	const other = doc.createElement('option');
	other.value = OTHER_VALUE;
	other.textContent = t('pptx.animation.sound.other');
	select.append(none);
	for (const entry of EFFECT_SOUND_CATALOGUE) {
		const option = doc.createElement('option');
		option.value = entry.id;
		option.textContent = t(entry.i18nKey);
		select.append(option);
	}
	select.append(other);

	const previewButton = doc.createElement('button');
	previewButton.type = 'button';
	previewButton.className = 'pptxv-effect-sound-preview';
	previewButton.setAttribute('aria-label', t('pptx.animation.sound.preview'));
	previewButton.textContent = '▶';
	previewButton.disabled = true;

	const fileInput = doc.createElement('input');
	fileInput.type = 'file';
	fileInput.accept = 'audio/*';
	fileInput.setAttribute('aria-label', t('pptx.animation.sound.chooseFile'));
	fileInput.className = 'pptxv-effect-sound-file-input';
	fileInput.tabIndex = -1;

	let currentCatalogueId: string | undefined;

	select.addEventListener('change', () => {
		const value = select.value;
		if (value === OTHER_VALUE) {
			fileInput.click();
			return;
		}
		if (value === NONE_VALUE) {
			onPick(undefined);
			return;
		}
		if (value === CURRENT_VALUE) {
			return;
		}
		onPickStock(value);
	});

	fileInput.addEventListener('change', () => {
		const file = fileInput.files?.[0];
		fileInput.value = '';
		if (!file) {
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === 'string') {
				onPick({ dataUrl: reader.result, fileName: file.name });
			}
		};
		reader.readAsDataURL(file);
	});

	previewButton.addEventListener('click', () => {
		if (!currentCatalogueId) {
			return;
		}
		const asset = getEffectSoundAsset(currentCatalogueId);
		if (asset) {
			playAnimationSound(asset.dataUrl);
		}
	});

	controlsRow.append(select, previewButton);
	el.append(caption, controlsRow, fileInput);

	return {
		el,
		update(state) {
			currentCatalogueId = state.catalogueId;
			const showCurrent = state.hasSound && !state.catalogueId;
			if (showCurrent) {
				current.textContent = state.fileName ?? t('pptx.animation.sound.custom');
				if (!current.isConnected) {
					select.insertBefore(current, none.nextSibling);
				}
			} else if (current.isConnected) {
				current.remove();
			}
			select.value = state.catalogueId ?? (state.hasSound ? CURRENT_VALUE : NONE_VALUE);
			select.disabled = !state.editable;
			previewButton.disabled = !state.catalogueId;
		},
	};
}
