import { registerPptxWebControls, isActionHidden } from 'pptx-viewer-shared';
import type { RibbonViewRequestEvent, RibbonViewState, ToolbarActionId } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import type { RibbonNavHandlers } from '../ribbon-types';

/** The View > Show toggles, as the viewer state currently holds them. */
export interface ViewToggleState {
	showGrid: boolean;
	showRulers: boolean;
	showGuides: boolean;
	snapToGrid: boolean;
	snapToShape: boolean;
}

export interface ViewTab {
	el: HTMLElement;
	setTemplateEditing(active: boolean): void;
	setEditable(editable: boolean): void;
	/** Reflect the Show group's toggles (pressed styling) from viewer state. */
	setViewOptions(options: ViewToggleState): void;
}

/**
 * The View ribbon tab: a thin adapter for the shared `pptx-ui-ribbon-view`.
 * Shared owns groups, icons, labels and pressed/disabled state; this module
 * supplies viewer options and routes typed intents to the native handlers.
 *
 * Zoom in / zoom out / slide show / notes are deliberately absent: they live
 * in the status bar. Guides toggles guide visibility only and Snap to shape is
 * its own flag. The Zoom group is hidden when the `zoom` action is hidden.
 */
export function createViewTab(
	doc: Document,
	t: Translator,
	handlers: RibbonNavHandlers,
	hiddenActions?: readonly ToolbarActionId[],
): ViewTab {
	registerPptxWebControls();
	const el = doc.createElement('pptx-ui-ribbon-view');
	let state: RibbonViewState = {
		editable: true,
		showRulers: false,
		showGrid: false,
		showGuides: false,
		snapToGrid: false,
		snapToShape: false,
		templateEditing: false,
		zoomAvailable: !isActionHidden('zoom', hiddenActions),
		translate: t,
	};
	const sync = () => {
		el.state = state;
	};
	el.addEventListener('view-request', (event) => {
		const intent = (event as RibbonViewRequestEvent).detail;
		if (intent.kind === 'guide') {
			handlers.addGuide(intent.axis);
		} else if (intent.kind === 'option') {
			if (intent.value === 'templateEditing') {
				handlers.toggleTemplateEditing?.();
			} else {
				handlers.toggleViewOption(intent.value);
			}
		} else {
			switch (intent.value) {
				case 'normal':
					handlers.normalView();
					break;
				case 'slideSorter':
					handlers.openSlideSorter();
					break;
				case 'outline':
					handlers.openOutlineView();
					break;
				case 'readingView':
					handlers.openReadingView();
					break;
				case 'slideMaster':
					handlers.toggleMasterView?.();
					break;
				case 'selectionPane':
					handlers.openSelectionPane();
					break;
				case 'eyedropper':
					handlers.activateEyedropper();
					break;
				case 'zoomToFit':
					handlers.zoomToFit();
			}
		}
	});
	sync();
	return {
		el,
		setEditable(editable) {
			state = { ...state, editable };
			sync();
		},
		setViewOptions(options) {
			state = { ...state, ...options };
			sync();
		},
		setTemplateEditing(active) {
			state = { ...state, templateEditing: active };
			sync();
		},
	};
}
