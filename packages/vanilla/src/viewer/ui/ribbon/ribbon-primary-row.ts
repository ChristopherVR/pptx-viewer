import type { ToolbarActionId } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { makeButton } from '../controls';
import { createIcon } from '../icons';
import {
	buildOverflowMenuItems,
	buildPresentMenuItems,
	makePrimaryMenu,
} from './ribbon-primary-menus';
import type { RibbonEditState, RibbonHandlers } from './ribbon-types';

export interface RibbonPrimaryRow {
	el: HTMLElement;
	setEditState(state: RibbonEditState): void;
	setAutosaveStatus(label: string, kind: 'idle' | 'saving' | 'saved' | 'error'): void;
	/** Reflect the inspector panel's open state on its toggle button. */
	setInspectorOpen(open: boolean): void;
}

/**
 * Desktop quick-access row above the ribbon tabs, mirroring React's
 * `ToolbarPrimaryRow` right cluster: comments, the "Present" split button
 * with its options dropdown, "+ Show", the inspector toggle, the settings
 * gear, and the "..." overflow menu. Save/undo/redo and autosave state live
 * in the title bar, matching React; collaboration appends its status pill
 * (and, without a tab row, its Share trigger) into this `.pptxv-ribbon-primary`
 * row (see `collab/collab-ui.ts`).
 */
export function createRibbonPrimaryRow(
	doc: Document,
	t: Translator,
	handlers: RibbonHandlers,
	hiddenActions?: readonly ToolbarActionId[],
): RibbonPrimaryRow {
	const el = createEl(doc, 'div', 'pptxv-ribbon-primary');

	// -- Comments ------------------------------------------------------------
	const comments = makeButton(doc, {
		label: t('pptx.toolbar.comments'),
		icon: 'comment',
		onClick: () => handlers.nav.openComments(),
	});
	el.appendChild(comments.btn);

	// -- Present split button + options dropdown -----------------------------
	const presentSplit = createEl(doc, 'div', 'pptxv-present-split');
	const presentMain = createEl(doc, 'button', 'pptxv-present-main');
	presentMain.type = 'button';
	presentMain.title = t('pptx.present.presentTooltip');
	presentMain.textContent = t('pptx.toolbar.present');
	presentMain.addEventListener('click', () => handlers.slideShow.startFromCurrent());
	const presentCaret = createEl(doc, 'button', 'pptxv-present-caret');
	presentCaret.type = 'button';
	presentCaret.title = t('pptx.present.optionsTooltip');
	presentCaret.setAttribute('aria-label', t('pptx.present.optionsTooltip'));
	presentCaret.setAttribute('aria-haspopup', 'menu');
	presentCaret.appendChild(createIcon(doc, 'chevron-down'));
	const presentMenu = makePrimaryMenu(
		doc,
		t('pptx.present.optionsTooltip'),
		buildPresentMenuItems(t, handlers, hiddenActions),
		(open) => {
			presentCaret.classList.toggle('is-active', open);
			presentCaret.setAttribute('aria-expanded', String(open));
		},
	);
	presentCaret.addEventListener('click', (event) => {
		event.stopPropagation();
		presentMenu.toggle();
	});
	presentSplit.append(presentMain, presentCaret, presentMenu.el);
	el.appendChild(presentSplit);

	// -- "+ Show" custom-shows quick action ----------------------------------
	const showBtn = createEl(doc, 'button', 'pptxv-show-btn');
	showBtn.type = 'button';
	showBtn.title = t('pptx.customShows.createTooltip');
	showBtn.textContent = '+ Show';
	showBtn.addEventListener('click', () => handlers.slideShow.openCustomShows());
	el.appendChild(showBtn);

	el.appendChild(createEl(doc, 'span', 'pptxv-primary-sep'));

	// -- Inspector toggle ----------------------------------------------------
	const inspectorToggle = makeButton(doc, {
		label: t('pptx.toolbar.toggleInspector'),
		icon: 'panel-right',
		onClick: () => handlers.nav.toggleInspector?.(),
	});
	el.appendChild(inspectorToggle.btn);

	// -- Settings gear -------------------------------------------------------
	const settings = makeButton(doc, {
		label: t('pptx.toolbar.settingsShortcuts'),
		icon: 'settings',
		onClick: () => handlers.nav.openSettings(),
	});
	el.appendChild(settings.btn);

	// -- "..." overflow menu -------------------------------------------------
	const overflowHost = createEl(doc, 'div', 'pptxv-primary-menu-host');
	const overflowMenu = makePrimaryMenu(
		doc,
		t('pptx.ribbon.moreActions'),
		buildOverflowMenuItems(t, handlers, hiddenActions),
	);
	const overflow = makeButton(doc, {
		label: t('pptx.ribbon.moreActions'),
		icon: 'ellipsis',
		onClick: () => overflowMenu.toggle(),
	});
	overflow.btn.setAttribute('aria-haspopup', 'menu');
	overflow.btn.addEventListener('pointerdown', (event) => event.stopPropagation());
	overflowHost.append(overflow.btn, overflowMenu.el);
	el.appendChild(overflowHost);

	return {
		el,
		setEditState({ editable }) {
			el.hidden = !editable;
			if (!editable) {
				presentMenu.close();
				overflowMenu.close();
			}
		},
		setAutosaveStatus() {},
		setInspectorOpen(open) {
			inspectorToggle.setActive(open);
		},
	};
}
