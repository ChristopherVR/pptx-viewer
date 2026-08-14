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
	/**
	 * Empty top-right host into which the AI assistant mounts its mobile toggle
	 * (the desktop title-bar toggle is offscreen on phones, so the assistant
	 * would otherwise be unreachable). Populated by `mountAiChat` when `ai` is
	 * configured; stays `display:none` while empty. Hidden when not editable,
	 * matching React's `showEdit && aiEnabled` gating.
	 */
	aiHost: HTMLElement;
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
		// It opens the all-sections sheet, so it is a menu, and React draws it
		// with lucide's Menu rather than a panel toggle.
		icon: 'menu',
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
	const aiHost = createEl(doc, 'span', 'pptxv-mobile-toolbar-ai');
	const collaborationHost = createEl(doc, 'span', 'pptxv-mobile-toolbar-collaboration');

	el.append(
		menu.btn,
		...(undo ? [undo.btn] : []),
		...(redo ? [redo.btn] : []),
		spacer,
		aiHost,
		save.btn,
		...(present ? [present.btn] : []),
		collaborationHost,
	);

	return {
		el,
		collaborationHost,
		aiHost,
		setEditState({ editable, canUndo, canRedo }) {
			for (const button of [menu.btn, undo?.btn, redo?.btn]) {
				if (button) {
					button.hidden = !editable;
				}
			}
			collaborationHost.hidden = !editable;
			aiHost.hidden = !editable;
			undo?.setDisabled(!canUndo);
			redo?.setDisabled(!canRedo);
		},
	};
}
