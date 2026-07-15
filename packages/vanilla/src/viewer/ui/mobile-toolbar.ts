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

/** Compact phone toolbar matching React's menu/edit/save/present action row. */
export function createMobileToolbar(
	doc: Document,
	t: Translator,
	handlers: MobileToolbarHandlers,
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
	const undo = makeButton(doc, {
		label: t('pptx.toolbar.undo'),
		icon: 'undo',
		className: 'pptxv-mobile-toolbar-btn pptxv-mobile-toolbar-edit',
		onClick: handlers.undo,
	});
	const redo = makeButton(doc, {
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
	const present = makeButton(doc, {
		label: t('pptx.toolbar.present'),
		icon: 'presentation',
		className: 'pptxv-mobile-toolbar-btn pptxv-mobile-present',
		onClick: handlers.present,
	});
	const collaborationHost = createEl(doc, 'span', 'pptxv-mobile-toolbar-collaboration');

	el.append(menu.btn, undo.btn, redo.btn, spacer, save.btn, present.btn, collaborationHost);

	return {
		el,
		collaborationHost,
		setEditState({ editable, canUndo, canRedo }) {
			for (const button of [menu.btn, undo.btn, redo.btn]) {
				button.hidden = !editable;
			}
			collaborationHost.hidden = !editable;
			undo.setDisabled(!canUndo);
			redo.setDisabled(!canRedo);
		},
	};
}
