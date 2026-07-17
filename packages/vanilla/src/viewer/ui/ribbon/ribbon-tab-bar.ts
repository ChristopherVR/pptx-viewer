import type { ToolbarActionId } from 'pptx-viewer-shared';
import { filterVisibleTabs } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { RIBBON_TABS } from './ribbon-tabs';
import type { RibbonTabId } from './ribbon-types';

export interface RibbonTabBar {
	el: HTMLElement;
	setActive(tab: RibbonTabId): void;
}

/**
 * The ribbon's tab strip (File/Home/Insert/.../View), à la React's ribbon tab
 * row. Tabs in `hiddenActions` are never constructed, matching how the ribbon
 * itself skips building content for a hidden tab.
 */
export function createRibbonTabBar(
	doc: Document,
	t: Translator,
	onSelect: (tab: RibbonTabId) => void,
	hiddenActions?: readonly ToolbarActionId[],
): RibbonTabBar {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tabs');
	el.setAttribute('role', 'tablist');

	const buttons = new Map<RibbonTabId, HTMLButtonElement>();
	for (const tab of filterVisibleTabs(RIBBON_TABS, hiddenActions)) {
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
