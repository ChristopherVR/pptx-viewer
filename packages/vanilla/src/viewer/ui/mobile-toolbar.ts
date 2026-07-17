import type { ToolbarActionId } from 'pptx-viewer-shared';
import { isActionHidden } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { makeButton } from './controls';
import type { RibbonEditState } from './ribbon/ribbon-types';

export interface MobileToolbarHandlers {
	openMenu(): void;
	undo(): void;
	redo(): void;
	save(): void;
	present(): void;
}

export interface MobileToolbar {
	el: HTMLElement;
	collaborationHost: HTMLElement;
	setEditState(state: RibbonEditState): void;
}

/**
 * Compact phone toolbar matching React's menu/edit/save/present action row.
 * Applies the same `hiddenActions` rules as the desktop chrome: undo/redo
 * hide independently, and present shares the `'fullscreen'` action with the
 * status bar / View tab's slide-show toggle.
 */
export function createMobileToolbar(
	doc: Document,
	t: Translator,
	handlers: MobileToolbarHandlers,
	hiddenActions?: readonly ToolbarActionId[],
): MobileToolbar {
	const el = createEl(doc, 'div', 'pptxv-mobile-toolbar');
	el.setAttribute('role', 'toolbar');
	el.setAttribute('aria-label', t('pptx.mobileToolbar.toolbar'));

	const menu = makeButton(doc, {
		label: t('pptx.mobileToolbar.menu'),
		icon: 'sidebar',
		className: 'pptxv-mobile-toolbar-btn pptxv-mobile-toolbar-edit',
		onClick: handlers.openMenu,
	});
	const undo = isActionHidden('undo', hiddenActions)
		? null
		: makeButton(doc, {
				label: t('pptx.toolbar.undo'),
				icon: 'undo',
				className: 'pptxv-mobile-toolbar-btn pptxv-mobile-toolbar-edit',
				onClick: handlers.undo,
			});
	const redo = isActionHidden('redo', hiddenActions)
		? null
		: makeButton(doc, {
				label: t('pptx.toolbar.redo'),
				icon: 'redo',
				className: 'pptxv-mobile-toolbar-btn pptxv-mobile-toolbar-edit',
				onClick: handlers.redo,
			});
	const spacer = createEl(doc, 'span', 'pptxv-mobile-toolbar-spacer');
	const save = makeButton(doc, {
		label: t('pptx.toolbar.save'),
		icon: 'download',
		className: 'pptxv-mobile-toolbar-btn',
		onClick: handlers.save,
	});
	const present = isActionHidden('fullscreen', hiddenActions)
		? null
		: makeButton(doc, {
				label: t('pptx.toolbar.present'),
				icon: 'presentation',
				className: 'pptxv-mobile-toolbar-btn pptxv-mobile-present',
				onClick: handlers.present,
			});
	const collaborationHost = createEl(doc, 'span', 'pptxv-mobile-toolbar-collaboration');

	el.append(
		menu.btn,
		...(undo ? [undo.btn] : []),
		...(redo ? [redo.btn] : []),
		spacer,
		save.btn,
		...(present ? [present.btn] : []),
		collaborationHost,
	);

	return {
		el,
		collaborationHost,
		setEditState({ editable, canUndo, canRedo }) {
			for (const button of [menu.btn, undo?.btn, redo?.btn]) {
				if (button) {
					button.hidden = !editable;
				}
			}
			collaborationHost.hidden = !editable;
			undo?.setDisabled(!canUndo);
			redo?.setDisabled(!canRedo);
		},
	};
}
