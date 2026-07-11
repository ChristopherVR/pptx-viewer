import type { PptxElement } from 'pptx-viewer-core';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { createEquationPanel } from './equation-panel';
import { createFindReplacePanel } from './find-replace-panel';
import { createFormatBackgroundPanel } from './format-background-panel';
import type { HomeTab } from './home/home-tab';
import { createHomeTab } from './home/home-tab';
import { createRibbonNavRow } from './ribbon-nav-row';
import { createRibbonPrimaryRow } from './ribbon-primary-row';
import { createRibbonTabBar } from './ribbon-tab-bar';
import { DEFAULT_RIBBON_TAB, RIBBON_TABS } from './ribbon-tabs';
import type {
	RibbonDrawState,
	RibbonEditState,
	RibbonHandlers,
	RibbonNavState,
	RibbonSelectionState,
	RibbonTabId,
} from './ribbon-types';
import type { AnimationsTab } from './tabs/animations-tab';
import { createAnimationsTab } from './tabs/animations-tab';
import type { DesignTab } from './tabs/design-tab';
import { createDesignTab } from './tabs/design-tab';
import type { DrawTab } from './tabs/draw-tab';
import { createDrawTab } from './tabs/draw-tab';
import { createFileTab } from './tabs/file-tab';
import type { InsertTab } from './tabs/insert-tab';
import { createInsertTab } from './tabs/insert-tab';
import type { TransitionsTab } from './tabs/transitions-tab';
import { createTransitionsTab } from './tabs/transitions-tab';
import { createViewTab } from './tabs/view-tab';

export interface Ribbon {
	el: HTMLElement;
	update(state: RibbonNavState): void;
	setEditState(state: RibbonEditState): void;
	setNotesExpanded(expanded: boolean): void;
	setAutosaveStatus(label: string, kind: 'idle' | 'saving' | 'saved' | 'error'): void;
	/** Show/hide the whole editing surface (Home/Insert tab content + find/replace). */
	setEditable(editable: boolean): void;
	/** Reflect the current selection across the Home tab's Font/Paragraph/Arrange groups. */
	updateSelection(selectedElement: PptxElement | undefined, extra: RibbonSelectionState): void;
	/** Reflect the current Draw tab tool/colour/width (store-driven). */
	setDrawState(state: RibbonDrawState): void;
}

/**
 * The tabbed editing ribbon: quick-access primary row (undo/redo/save +
 * autosave pill), the always-visible nav row (prev/next/counter/zoom/present/
 * notes, see `ribbon-nav-row.ts`), the tab bar, and the swappable tab content
 * (File/Home/Insert/View this wave, see `ribbon-tabs.ts`). Replaces the old
 * `toolbar.ts` + `format-toolbar.ts` pair.
 */
export function createRibbon(doc: Document, t: Translator, handlers: RibbonHandlers): Ribbon {
	const el = createEl(doc, 'div', 'pptxv-ribbon');
	el.setAttribute('role', 'toolbar');

	const primary = createRibbonPrimaryRow(doc, t, handlers.primary);
	const nav = createRibbonNavRow(doc, t, handlers.nav);
	el.append(primary.el, nav.el);

	const tabBar = createRibbonTabBar(doc, t, (tab) => setActiveTab(tab));
	tabBar.el.hidden = true;
	el.appendChild(tabBar.el);

	const findReplace = createFindReplacePanel(doc, t, handlers.findReplace);
	el.appendChild(findReplace.el);

	const equationPanel = createEquationPanel(doc, t, (omml) => handlers.insert.insertEquation(omml));
	el.appendChild(equationPanel.el);

	const formatBackgroundPanel = createFormatBackgroundPanel(doc, t, handlers.edit);
	el.appendChild(formatBackgroundPanel.el);

	const fileTab = createFileTab(doc, t, handlers.file);
	const homeTab: HomeTab = createHomeTab(doc, t, {
		edit: handlers.edit,
		onToggleFindReplace: () => findReplace.toggle(),
	});
	const insertTab: InsertTab = createInsertTab(doc, t, handlers.insert, () =>
		equationPanel.toggle(),
	);
	const drawTab: DrawTab = createDrawTab(doc, t, handlers.draw);
	const designTab: DesignTab = createDesignTab(doc, t, handlers.design, () =>
		formatBackgroundPanel.toggle(),
	);
	const transitionsTab: TransitionsTab = createTransitionsTab(doc, t, handlers.edit);
	const animationsTab: AnimationsTab = createAnimationsTab(doc, t, handlers.edit);
	const viewTab = createViewTab(doc, t, handlers.nav);

	const panes: Record<RibbonTabId, HTMLElement> = {
		file: fileTab.el,
		home: homeTab.el,
		insert: insertTab.el,
		draw: drawTab.el,
		design: designTab.el,
		transitions: transitionsTab.el,
		animations: animationsTab.el,
		view: viewTab.el,
	};
	for (const tab of RIBBON_TABS) {
		panes[tab.id].hidden = true;
		el.appendChild(panes[tab.id]);
	}

	let activeTab: RibbonTabId = DEFAULT_RIBBON_TAB;
	function setActiveTab(tab: RibbonTabId): void {
		activeTab = tab;
		tabBar.setActive(tab);
		for (const id of Object.keys(panes) as RibbonTabId[]) {
			panes[id].hidden = id !== tab;
		}
	}
	setActiveTab(activeTab);

	let latestSelected: PptxElement | undefined;
	let latestExtra: RibbonSelectionState = { hasClipboard: false, slideCount: 0 };

	const syncHome = (): void => {
		homeTab.update({
			editable: lastEditable,
			selectedElement: latestSelected,
			hasClipboard: latestExtra.hasClipboard,
			slideCount: latestExtra.slideCount,
		});
	};
	const syncAnimations = (): void => {
		animationsTab.update({ editable: lastEditable, hasSelection: latestSelected !== undefined });
	};

	let lastEditable = false;

	return {
		el,
		update: (state) => nav.update(state),
		setEditState(state) {
			primary.setEditState(state);
			tabBar.el.hidden = !state.editable;
		},
		setNotesExpanded: (expanded) => nav.setNotesExpanded(expanded),
		setAutosaveStatus: (label, kind) => primary.setAutosaveStatus(label, kind),
		setEditable(editable) {
			lastEditable = editable;
			insertTab.setEditable(editable);
			drawTab.setEditable(editable);
			findReplace.setEditable(editable);
			equationPanel.setEditable(editable);
			formatBackgroundPanel.setEditable(editable);
			designTab.setEditable(editable);
			transitionsTab.setEditable(editable);
			syncHome();
			syncAnimations();
		},
		setDrawState: (state) => drawTab.update(state),
		updateSelection(selectedElement, extra) {
			latestSelected = selectedElement;
			latestExtra = extra;
			syncHome();
			syncAnimations();
		},
	};
}
