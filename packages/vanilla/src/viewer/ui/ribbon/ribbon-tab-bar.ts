import type { ToolbarActionId } from 'pptx-viewer-shared';
import { filterVisibleTabs, isActionHidden } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { RIBBON_TABS } from './ribbon-tabs';
import type { RibbonTabId } from './ribbon-types';

export interface RibbonTabBar {
	el: HTMLElement;
	setActive(tab: RibbonTabId): void;
	/** Hide/show tab buttons per Options > Customize Ribbon (File always shown). */
	setHiddenTabs(hidden: ReadonlySet<string>): void;
	/** Set each tab's `title` from a ScreenTip resolver (Options > General). */
	applyScreenTips(resolve: (label: string) => string | undefined): void;
}

/** Right-side quick actions on the tab row (React's `TabRowActions`). */
export interface RibbonTabBarActions {
	/** The red-dot Record button (starts rehearsal/recording). */
	startRecording(): void;
}

/**
 * The ribbon's tab strip (File/Home/Insert/.../View), à la React's ribbon tab
 * row. Tabs in `hiddenActions` are never constructed, matching how the ribbon
 * itself skips building content for a hidden tab. The right side carries the
 * Record button plus a `.pptxv-tabrow-actions` host the collaboration UI
 * mounts its Share trigger into (see `collab/collab-ui.ts`).
 */
export function createRibbonTabBar(
	doc: Document,
	t: Translator,
	onSelect: (tab: RibbonTabId) => void,
	hiddenActions?: readonly ToolbarActionId[],
	actions?: RibbonTabBarActions,
): RibbonTabBar {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tabs');
	el.setAttribute('role', 'tablist');

	const buttons = new Map<RibbonTabId, HTMLButtonElement>();
	const labels = new Map<RibbonTabId, string>();
	for (const tab of filterVisibleTabs(RIBBON_TABS, hiddenActions)) {
		const btn = createEl(doc, 'button', 'pptxv-ribbon-tab');
		if (tab.id === 'file') {
			btn.classList.add('pptxv-ribbon-tab-file');
		}
		btn.type = 'button';
		btn.setAttribute('role', 'tab');
		const label = t(tab.labelKey);
		btn.textContent = label;
		btn.addEventListener('click', () => onSelect(tab.id));
		el.appendChild(btn);
		buttons.set(tab.id, btn);
		labels.set(tab.id, label);
	}

	if (actions) {
		el.appendChild(createEl(doc, 'span', 'pptxv-tabrow-spacer'));
		const actionsHost = createEl(doc, 'div', 'pptxv-tabrow-actions');
		if (!isActionHidden('record', hiddenActions)) {
			const record = createEl(doc, 'button', 'pptxv-tabrow-record');
			record.type = 'button';
			record.title = t('pptx.titleBar.record');
			record.setAttribute('aria-label', t('pptx.titleBar.record'));
			const dot = createEl(doc, 'span', 'pptxv-tabrow-record-dot');
			dot.setAttribute('aria-hidden', 'true');
			const label = createEl(doc, 'span');
			label.textContent = t('pptx.titleBar.record');
			record.append(dot, label);
			record.addEventListener('click', () => actions.startRecording());
			actionsHost.appendChild(record);
		}
		el.appendChild(actionsHost);
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
		setHiddenTabs(hidden) {
			for (const [id, btn] of buttons) {
				btn.hidden = id !== 'file' && hidden.has(id);
			}
		},
		applyScreenTips(resolve) {
			for (const [id, btn] of buttons) {
				const tip = resolve(labels.get(id) ?? '');
				if (tip) {
					btn.title = tip;
				} else {
					btn.removeAttribute('title');
				}
			}
		},
	};
}
