import type { PptxElement } from 'pptx-viewer-core';
import type { AccountAuthConfig, RibbonContextualTabId, ToolbarActionId } from 'pptx-viewer-shared';
import {
	filterVisibleTabs,
	isActionHidden,
	resolveActiveRibbonTab,
	visibleContextualTabs,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { createEquationPanel } from './equation-panel';
import { createFindReplacePanel } from './find-replace-panel';
import { createFormatBackgroundPanel } from './format-background-panel';
import { createContextualTabPanes } from './gallery/contextual-tabs';
import { createRibbonGalleryHub } from './gallery/gallery-hub';
import type { HomeTab } from './home/home-tab';
import { createHomeTab } from './home/home-tab';
import type { Ribbon } from './ribbon-api';
import { buildHomeSyncState } from './ribbon-home-sync';
import { createRibbonPrimaryRow } from './ribbon-primary-row';
import { createRibbonTabBar } from './ribbon-tab-bar';
import { DEFAULT_RIBBON_TAB, RIBBON_TABS } from './ribbon-tabs';
import type { RibbonHandlers, RibbonSelectionState, RibbonTabId } from './ribbon-types';
import type { AnimationsTab } from './tabs/animations-tab';
import { createAnimationsTab } from './tabs/animations-tab';
import type { DesignTab } from './tabs/design-tab';
import { createDesignTab } from './tabs/design-tab';
import type { DrawTab } from './tabs/draw-tab';
import { createDrawTab } from './tabs/draw-tab';
import { createFileTab } from './tabs/file-tab';
import { createHelpTab } from './tabs/help-tab';
import type { InsertTab } from './tabs/insert-tab';
import { createInsertTab } from './tabs/insert-tab';
import { createRecordTab } from './tabs/record-tab';
import { createReviewTab } from './tabs/review-tab';
import { createSlideShowTab } from './tabs/slide-show-tab';
import type { TransitionsTab } from './tabs/transitions-tab';
import { createTransitionsTab } from './tabs/transitions-tab';
import { createViewTab } from './tabs/view-tab';

export type { Ribbon } from './ribbon-api';

/**
 * The tabbed editing ribbon: a React-aligned command row, tab bar, and
 * swappable tab content. Slide navigation and zoom live in the status bar,
 * avoiding the duplicate counter row that used to sit above the tabs.
 *
 * `hiddenActions` (from the host's `hiddenActions` viewer option) gates DOM
 * construction, not just visibility: a hidden ribbon tab's content module is
 * never called, and a hidden button/cluster inside a tab is never built by
 * that tab's own module (see `ribbon-types.ts` handlers vs. this file).
 */
export function createRibbon(
	doc: Document,
	t: Translator,
	handlers: RibbonHandlers,
	hiddenActions?: readonly ToolbarActionId[],
	accountAuth?: AccountAuthConfig,
): Ribbon {
	const el = createEl(doc, 'div', 'pptxv-ribbon');
	el.setAttribute('role', 'toolbar');
	el.setAttribute('aria-label', t('pptx.toolbar.presentationToolbarAria'));

	const primary = createRibbonPrimaryRow(doc, t, handlers, hiddenActions);
	el.append(primary.el);

	const tabBar = createRibbonTabBar(doc, t, (tab) => setActiveTab(tab), hiddenActions, {
		startRecording: () => handlers.slideShow.startRehearsal(),
	});
	tabBar.el.hidden = true;
	el.appendChild(tabBar.el);

	const findReplace = createFindReplacePanel(doc, t, handlers.findReplace);
	el.appendChild(findReplace.el);

	const equationPanel = createEquationPanel(doc, t, (omml, id) =>
		id ? handlers.edit.updateEquation(id, omml) : handlers.insert.insertEquation(omml),
	);
	el.appendChild(equationPanel.el);

	const formatBackgroundPanel = createFormatBackgroundPanel(doc, t, handlers.edit);
	el.appendChild(formatBackgroundPanel.el);

	const galleryHub = createRibbonGalleryHub((result) =>
		handlers.edit.applyRibbonGalleryResult(result),
	);
	const hidden = (id: RibbonTabId): boolean => isActionHidden(id, hiddenActions);
	const fileTab = hidden('file')
		? null
		: createFileTab(doc, t, handlers.file, () => setActiveTab('home'), hiddenActions, accountAuth);
	const homeTab: HomeTab | null = hidden('home')
		? null
		: createHomeTab(doc, t, {
				edit: handlers.edit,
				onToggleFindReplace: () => findReplace.toggle(),
				hiddenActions,
				galleryHub,
			});
	const insertTab: InsertTab | null = hidden('insert')
		? null
		: createInsertTab(
				doc,
				t,
				handlers.insert,
				() => equationPanel.toggle(),
				() => handlers.nav.openHeaderFooter(),
				() => handlers.nav.openHyperlink(),
			);
	const drawTab: DrawTab | null = hidden('draw') ? null : createDrawTab(doc, t, handlers.draw);
	let inspectorOpen = false;
	const openInspector = (): void => handlers.nav.toggleInspector?.();
	/**
	 * Design > Slide Size. The only slide-size control this binding has is the
	 * inspector's SLIDE SIZE card (`inspector/deck-panel.ts`), and the deck panel
	 * only renders with nothing selected, so reach it by dropping the selection
	 * and opening the inspector. It used to open Document Properties, a dialog
	 * with no slide-size control in it at all.
	 */
	const openSlideSize = (): void => {
		handlers.nav.clearSelection?.();
		if (!inspectorOpen) {
			openInspector();
		}
	};
	const designTab: DesignTab | null = hidden('design')
		? null
		: createDesignTab(
				doc,
				t,
				handlers.design,
				() => formatBackgroundPanel.toggle(),
				openSlideSize,
				galleryHub,
			);
	const transitionsTab: TransitionsTab | null = hidden('transitions')
		? null
		: createTransitionsTab(doc, t, handlers.transitions, openInspector);
	const animationsTab: AnimationsTab | null = hidden('animations')
		? null
		: createAnimationsTab(doc, t, handlers.edit, openInspector);
	const slideShowTab = hidden('slideShow')
		? null
		: createSlideShowTab(doc, t, handlers.slideShow, hiddenActions);
	const recordTab = hidden('record') ? null : createRecordTab(doc, t, handlers.slideShow);
	const reviewTab = hidden('review') ? null : createReviewTab(doc, t, handlers.nav);
	const viewTab = hidden('view') ? null : createViewTab(doc, t, handlers.nav, hiddenActions);
	const helpTab = hidden('help') ? null : createHelpTab(doc, t, handlers.nav);

	type AnyTabId = RibbonTabId | RibbonContextualTabId;
	const panes: Partial<Record<AnyTabId, HTMLElement>> = {
		file: fileTab?.el,
		home: homeTab?.el,
		insert: insertTab?.el,
		draw: drawTab?.el,
		design: designTab?.el,
		transitions: transitionsTab?.el,
		animations: animationsTab?.el,
		slideShow: slideShowTab?.el,
		record: recordTab ?? undefined,
		review: reviewTab?.el,
		view: viewTab?.el,
		help: helpTab ?? undefined,
	};
	const visibleTabs = filterVisibleTabs(RIBBON_TABS, hiddenActions);
	for (const tab of visibleTabs) {
		const pane = panes[tab.id];
		if (pane) {
			pane.hidden = true;
			el.appendChild(pane);
		}
	}

	// Contextual tabs (Shape Format, ...) sit after the fixed tabs; the tab row
	// only shows the ones the current selection brings up.
	for (const [id, pane] of createContextualTabPanes(doc, t, galleryHub)) {
		pane.hidden = true;
		panes[id] = pane;
		el.appendChild(pane);
	}

	const defaultVisibleTab: RibbonTabId =
		visibleTabs.find((tab) => tab.id === DEFAULT_RIBBON_TAB)?.id ??
		visibleTabs[0]?.id ??
		DEFAULT_RIBBON_TAB;
	let activeTab: AnyTabId = defaultVisibleTab;
	function setActiveTab(tab: AnyTabId): void {
		if (!panes[tab]) {
			return;
		}
		if (tab !== activeTab) {
			galleryHub.closeAll();
		}
		activeTab = tab;
		tabBar.setActive(tab);
		for (const id of Object.keys(panes) as AnyTabId[]) {
			const pane = panes[id];
			if (pane) {
				pane.hidden = id !== tab;
			}
		}
	}
	setActiveTab(activeTab);

	let latestSelected: PptxElement | undefined;
	let latestExtra: RibbonSelectionState = { hasClipboard: false, slideCount: 0, selectedCount: 0 };

	const syncContextual = (): void => {
		const visible = visibleContextualTabs(
			latestSelected ?? null,
			handlers.nav.getCustomization?.(),
		);
		tabBar.setContextualTabs(visible);
		const next = resolveActiveRibbonTab(activeTab, visible, defaultVisibleTab);
		if (next !== activeTab) {
			setActiveTab(next);
		}
	};
	const syncHome = (): void => {
		galleryHub.sync(latestExtra.galleryContext, lastEditable);
		syncContextual();
		homeTab?.update(buildHomeSyncState(lastEditable, latestSelected, latestExtra));
	};
	const syncAnimations = (): void => {
		animationsTab?.update({
			editable: lastEditable,
			hasSelection: latestSelected !== undefined,
			selectedElementId: latestExtra.selectedElementId,
			animations: latestExtra.animations ?? [],
			animationTimelineAnchors: latestExtra.animationTimelineAnchors ?? [],
		});
	};

	let lastEditable = false;
	let optionHiddenTabs = new Set<string>();

	const setHiddenOptionTabs = (tabIds: readonly string[]): void => {
		optionHiddenTabs = new Set(tabIds.filter((id) => id !== 'file'));
		tabBar.setHiddenTabs(optionHiddenTabs);
		if (optionHiddenTabs.has(activeTab)) {
			const fallback = optionHiddenTabs.has('home')
				? visibleTabs.find((tab) => !optionHiddenTabs.has(tab.id))?.id
				: 'home';
			if (fallback) {
				setActiveTab(fallback);
			}
		}
	};

	return {
		el,
		update() {},
		setEditState(state) {
			primary.setEditState(state);
			tabBar.el.hidden = !state.editable;
		},
		setNotesExpanded() {},
		setAutosaveStatus: (label, kind) => primary.setAutosaveStatus(label, kind),
		setEditable(editable) {
			lastEditable = editable;
			reviewTab?.setEditable(editable);
			viewTab?.setEditable(editable);
			insertTab?.setEditable(editable);
			drawTab?.setEditable(editable);
			findReplace.setEditable(editable);
			equationPanel.setEditable(editable);
			formatBackgroundPanel.setEditable(editable);
			designTab?.setEditable(editable);
			transitionsTab?.setEditable(editable);
			// `setEditable` runs on every store change (see `editing-chrome-sync`),
			// which is what keeps these two tabs reading the deck: the Transitions
			// draft follows the active slide, and the Slide Show Options checkboxes
			// follow the show settings even when the Set Up dialog changed them.
			transitionsTab?.sync();
			slideShowTab?.syncOptions();
			syncHome();
			syncAnimations();
		},
		setDrawState: (state) => {
			drawTab?.update(state);
			insertTab?.setFreeformTool(state.freeformTool ?? null);
		},
		setTemplateEditing: (active) => viewTab?.setTemplateEditing(active),
		setViewOptions: (options) => viewTab?.setViewOptions(options),
		setHasMacros: (hasMacros) => fileTab?.setHasMacros(hasMacros),
		setSubtitlesVisible: (visible) => slideShowTab?.setSubtitlesVisible(visible),
		setHideSlideActive: (active) => slideShowTab?.setHideSlideActive(active),
		setInspectorOpen: (open) => {
			inspectorOpen = open;
			primary.setInspectorOpen(open);
		},
		toggleFindReplace: () => findReplace.toggle(),
		openEquationEditor: (id, omml) => equationPanel.openEdit(id, omml),
		showDefaultTab: () => setActiveTab(defaultVisibleTab),
		setHiddenOptionTabs,
		applyScreenTips: (tip) => tabBar.applyScreenTips(tip),
		updateSelection(selectedElement, extra) {
			latestSelected = selectedElement;
			latestExtra = extra;
			insertTab?.setHasSelection(selectedElement !== undefined);
			syncHome();
			syncAnimations();
		},
	};
}
