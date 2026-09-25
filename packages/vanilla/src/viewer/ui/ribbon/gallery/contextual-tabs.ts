import type {
	RibbonContextualTabId,
	RibbonGalleryGroupPlacement,
	RibbonGroupId,
} from 'pptx-viewer-shared';
import {
	CONTEXTUAL_TAB_GROUPS,
	RIBBON_CONTEXTUAL_TABS,
	RIBBON_GROUP_ATTR,
} from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import type { RibbonGalleryHub } from './gallery-hub';
import { translateOr } from './gallery-tiles';
import { createRibbonGallery } from './ribbon-gallery';

/** A ribbon group in the binding's normal markup, tagged with its catalogue id. */
export interface RibbonGroupShell {
	el: HTMLElement;
	row: HTMLElement;
}

export function createRibbonGroupShell(
	doc: Document,
	id: RibbonGroupId,
	caption: string,
): RibbonGroupShell {
	const el = createEl(doc, 'div', 'pptxv-rgroup');
	el.setAttribute(RIBBON_GROUP_ATTR, id);
	const row = createEl(doc, 'div', 'pptxv-rgroup-row');
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.textContent = caption;
	el.append(row, label);
	return { el, row };
}

/** One shared gallery group placement (a contextual tab's Shape Styles, ...). */
export function createGalleryGroup(
	doc: Document,
	t: Translator,
	group: RibbonGalleryGroupPlacement,
	hub: RibbonGalleryHub,
): HTMLElement {
	const shell = createRibbonGroupShell(
		doc,
		group.group,
		translateOr(t, group.labelKey, group.label),
	);
	for (const placement of group.galleries) {
		shell.row.appendChild(createRibbonGallery(doc, t, placement, hub).el);
	}
	return shell.el;
}

/**
 * The content panes of the five contextual tabs (Shape Format, Picture Format,
 * Table Design, Chart Design, SmartArt Design), each rendering the groups
 * `CONTEXTUAL_TAB_GROUPS` lists for it. Which of them the tab row shows is the
 * shared `visibleContextualTabs`' call, made by the ribbon on every selection.
 */
export function createContextualTabPanes(
	doc: Document,
	t: Translator,
	hub: RibbonGalleryHub,
): Map<RibbonContextualTabId, HTMLElement> {
	const panes = new Map<RibbonContextualTabId, HTMLElement>();
	for (const { id } of RIBBON_CONTEXTUAL_TABS) {
		const pane = createEl(doc, 'div', 'pptxv-ribbon-tab-content pptxv-ribbon-contextual-content');
		pane.dataset.ribbonContextualPane = id;
		for (const group of CONTEXTUAL_TAB_GROUPS[id]) {
			pane.appendChild(createGalleryGroup(doc, t, group, hub));
		}
		panes.set(id, pane);
	}
	return panes;
}

/**
 * Keep only the contextual panes the selection brings up in the ribbon's DOM,
 * as the other bindings do (their panes are rendered conditionally): a pane
 * for a tab that is not showing is detached, so its groups are gone from the
 * accessibility tree and from `[data-ribbon-group]` queries, not merely hidden.
 */
export function mountVisibleContextualPanes(
	host: HTMLElement,
	panes: ReadonlyMap<RibbonContextualTabId, HTMLElement>,
	visible: readonly RibbonContextualTabId[],
): void {
	for (const [id, pane] of panes) {
		if (!visible.includes(id)) {
			pane.remove();
		} else if (pane.parentElement !== host) {
			host.appendChild(pane);
		}
	}
}
