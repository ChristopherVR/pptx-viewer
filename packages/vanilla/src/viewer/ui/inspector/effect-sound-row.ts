import type { EffectSoundState } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';

export interface EffectSoundRow {
	el: HTMLElement;
	update(state: EffectSoundState & { editable: boolean }): void;
}

/**
 * The animation panel's effect sound row (`p:stSnd`): "No Sound" or a custom
 * audio file picked from disk. Picking a file hands the caller a pending
 * `data:` URL; the core save pipeline embeds it and mints its relationship.
 */
export function createEffectSoundRow(
	doc: Document,
	t: Translator,
	onPick: (pick: { dataUrl: string; fileName?: string } | undefined) => void,
): EffectSoundRow {
	const el = createEl(doc, 'label', 'pptxv-effect-sound-row');
	const caption = createEl(doc, 'span');
	caption.textContent = t('pptx.animation.sound');

	const select = doc.createElement('select');
	select.setAttribute('aria-label', t('pptx.animation.sound'));
	const none = doc.createElement('option');
	none.value = 'none';
	none.textContent = t('pptx.animation.sound.none');
	const custom = doc.createElement('option');
	custom.value = 'custom';
	custom.textContent = t('pptx.animation.sound.custom');
	select.append(none, custom);

	const fileInput = doc.createElement('input');
	fileInput.type = 'file';
	fileInput.accept = 'audio/*';
	fileInput.setAttribute('aria-label', t('pptx.animation.sound.chooseFile'));
	fileInput.className = 'pptxv-effect-sound-file-input';
	fileInput.tabIndex = -1;

	select.addEventListener('change', () => {
		if (select.value === 'custom') {
			fileInput.click();
			return;
		}
		onPick(undefined);
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

	el.append(caption, select, fileInput);

	return {
		el,
		update(state) {
			select.value = state.hasSound ? 'custom' : 'none';
			custom.textContent =
				state.hasSound && state.fileName ? state.fileName : t('pptx.animation.sound.custom');
			select.disabled = !state.editable;
		},
	};
}
