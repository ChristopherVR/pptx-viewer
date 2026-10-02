import { isActionHidden, registerPptxWebControls } from 'pptx-viewer-shared';
import type {
	MobileToolbarId,
	MobileToolbarRequestEvent,
	PptxUiMobileToolbarElement,
	ToolbarActionId,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
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
 * Compact phone toolbar matching React's menu/edit/save/present action row. A
 * thin adapter over the shared `pptx-ui-mobile-toolbar`, which owns the markup
 * and gating. Applies the same `hiddenActions` rules as the desktop chrome:
 * undo/redo hide independently, and present shares the `'fullscreen'` action
 * with the status bar / View tab's slide-show toggle. The AI toggle and the
 * collaboration pill are host-mounted into the element's `ai` and
 * `collaboration` slots; Share is the collaboration pill, so it is not drawn.
 */
export function createMobileToolbar(
	doc: Document,
	t: Translator,
	handlers: MobileToolbarHandlers,
	hiddenActions?: readonly ToolbarActionId[],
): MobileToolbar {
	registerPptxWebControls();
	const el = doc.createElement('pptx-ui-mobile-toolbar') as PptxUiMobileToolbarElement;
	el.className = 'pptxv-mobile-toolbar';
	const aiHost = createEl(doc, 'span', 'pptxv-mobile-toolbar-ai');
	aiHost.slot = 'ai';
	const collaborationHost = createEl(doc, 'span', 'pptxv-mobile-toolbar-collaboration');
	collaborationHost.slot = 'collaboration';
	el.append(aiHost, collaborationHost);

	const hidden: MobileToolbarId[] = ['share'];
	for (const [id, action] of [
		['undo', 'undo'],
		['redo', 'redo'],
		['present', 'fullscreen'],
	] as const) {
		if (isActionHidden(action, hiddenActions)) {
			hidden.push(id);
		}
	}
	let edit: RibbonEditState = { editable: true, canUndo: false, canRedo: false };
	const sync = (): void => {
		el.state = {
			editable: edit.editable,
			canUndo: edit.canUndo,
			canRedo: edit.canRedo,
			hidden,
			translate: t,
		};
	};
	const intents: Record<MobileToolbarId, (() => void) | undefined> = {
		menu: handlers.openMenu,
		undo: handlers.undo,
		redo: handlers.redo,
		ai: undefined,
		save: handlers.save,
		present: handlers.present,
		share: undefined,
	};
	el.addEventListener('mobile-toolbar-request', (event) => {
		intents[(event as MobileToolbarRequestEvent).detail.id]?.();
	});
	sync();

	return {
		el,
		collaborationHost,
		aiHost,
		setEditState(state) {
			edit = state;
			sync();
		},
	};
}
