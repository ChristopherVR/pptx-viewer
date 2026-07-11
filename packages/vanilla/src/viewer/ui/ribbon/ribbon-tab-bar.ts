import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { RIBBON_TABS } from './ribbon-tabs';
import type { RibbonTabId } from './ribbon-types';

export interface RibbonTabBar {
	el: HTMLElement;
	setActive(tab: RibbonTabId): void;
}

/** The ribbon's tab strip (File/Home/Insert/.../View), à la React's ribbon tab row. */
export function createRibbonTabBar(
	doc: Document,
	t: Translator,
	onSelect: (tab: RibbonTabId) => void,
): RibbonTabBar {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tabs');
	el.setAttribute('role', 'tablist');

	const buttons = new Map<RibbonTabId, HTMLButtonElement>();
	for (const tab of RIBBON_TABS) {
		const btn = createEl(doc, 'button', 'pptxv-ribbon-tab');
		if (tab.id === 'file') {
			btn.classList.add('pptxv-ribbon-tab-file');
		}
		btn.type = 'button';
		btn.setAttribute('role', 'tab');
		btn.textContent = t(tab.labelKey);
		btn.addEventListener('click', () => onSelect(tab.id));
		el.appendChild(btn);
		buttons.set(tab.id, btn);
	}

	return {
		el,
		setActive(tab) {
			for (const [id, btn] of buttons) {
				const active = id === tab;
				btn.classList.toggle('is-active', active);
				btn.setAttribute('aria-selected', String(active));
			}
		},
	};
}
