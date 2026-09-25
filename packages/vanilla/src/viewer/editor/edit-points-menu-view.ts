import type { EditPointsCommandId, EditPointsMenuView } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

/**
 * The Edit Points right-click menu (a vertex or a segment). Entries, order,
 * greying and checks come from the shared `EditPointsSession`; this only paints
 * them with the element context menu's item styling.
 *
 * Mounted inside the scaled stage at the click's slide position and scaled
 * back by `inverseScale`, so it stays screen-sized at every zoom (a
 * `position: fixed` child of the transformed stage would be placed relative to
 * the stage, not the viewport).
 */
export function createEditPointsMenuElement(
	doc: Document,
	t: Translator,
	menu: EditPointsMenuView,
	onRun: (id: EditPointsCommandId) => void,
): HTMLElement {
	const el = createEl(doc, 'div', 'pptxv-context-menu');
	el.setAttribute('role', 'menu');
	el.setAttribute('aria-label', t('pptx.editPoints.menu'));
	el.dataset.pptxEditPointsMenu = 'true';
	el.style.position = 'absolute';
	el.style.left = `${menu.x}px`;
	el.style.top = `${menu.y}px`;
	el.style.transform = `scale(${menu.inverseScale})`;
	el.style.transformOrigin = '0 0';
	el.style.zIndex = '61';
	const stop = (event: Event): void => event.stopPropagation();
	el.addEventListener('pointerdown', stop);
	el.addEventListener('mousedown', stop);
	el.addEventListener('click', stop);
	el.addEventListener('contextmenu', (event) => {
		event.preventDefault();
		event.stopPropagation();
	});
	for (const entry of menu.entries) {
		if (entry.separatorBefore) {
			const separator = createEl(doc, 'div', 'pptxv-context-menu-separator');
			separator.setAttribute('role', 'separator');
			el.appendChild(separator);
		}
		const button = createEl(doc, 'button', 'pptxv-context-menu-item');
		button.type = 'button';
		button.dataset.pptxEditPointsCommand = entry.id;
		if (entry.checked === undefined) {
			button.setAttribute('role', 'menuitem');
		} else {
			button.setAttribute('role', 'menuitemcheckbox');
			button.setAttribute('aria-checked', String(entry.checked));
			const mark = createEl(doc, 'span');
			mark.setAttribute('aria-hidden', 'true');
			mark.style.display = 'inline-block';
			mark.style.width = '12px';
			mark.style.marginRight = '6px';
			mark.textContent = entry.checked ? '✓' : '';
			button.appendChild(mark);
		}
		button.appendChild(doc.createTextNode(t(entry.labelKey)));
		button.disabled = entry.disabled === true;
		button.addEventListener('click', () => onRun(entry.id));
		el.appendChild(button);
	}
	return el;
}
