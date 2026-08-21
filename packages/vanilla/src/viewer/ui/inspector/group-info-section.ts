import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { InspectorState } from './types';

export interface GroupInfoSection {
	el: HTMLElement;
	update(state: InspectorState): void;
}

/** Read-only child-count summary for a selected group. */
export function createGroupInfoSection(
	doc: Document,
	t: Translator,
	section: (label: string) => HTMLElement,
): GroupInfoSection {
	const el = section(t('pptx.elementType.group'));
	const summary = createEl(doc, 'div', 'pptxv-inspector-muted-text');
	el.appendChild(summary);

	return {
		el,
		update(state) {
			el.hidden = !state.isGroup;
			if (!state.isGroup) {
				return;
			}
			summary.textContent =
				state.groupChildCount !== undefined
					? t('pptx.group.childCount', { count: state.groupChildCount })
					: t('pptx.group.groupedElement');
		},
	};
}
