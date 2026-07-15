import type { SmartArtLayout } from 'pptx-viewer-core';

import type { Translator } from '../../../../i18n';
import { makeButton } from '../../../controls';
import { createSmartArtDialog } from './smartart-dialog';

export interface SmartArtControl {
	el: HTMLElement;
	setDisabled(disabled: boolean): void;
}

/** Insert > SmartArt trigger backed by the shared preset gallery dialog. */
export function createSmartArtControl(
	doc: Document,
	t: Translator,
	onSelect: (layout: SmartArtLayout, defaultItems: string[]) => void,
): SmartArtControl {
	const dialog = createSmartArtDialog(doc, t, onSelect);
	const trigger = makeButton(doc, {
		label: t('pptx.ribbon.smartArt'),
		icon: 'smart-art',
		onClick: () => {
			const host = trigger.btn.closest<HTMLElement>('.pptxv') ?? doc.body;
			dialog.open(host);
		},
	});
	trigger.btn.title = t('pptx.ribbon.insertSmartArt');
	return {
		el: trigger.btn,
		setDisabled(disabled) {
			trigger.setDisabled(disabled);
			if (disabled) {
				dialog.close();
			}
		},
	};
}
