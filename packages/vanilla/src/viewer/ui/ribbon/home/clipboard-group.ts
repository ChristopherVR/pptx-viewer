import { clipboardHomeControls, registerPptxWebControls } from 'pptx-viewer-shared';
import type { RibbonHomeRequestEvent } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';

export interface ClipboardGroupHandlers {
	copy(): void;
	cut(): void;
	paste(): void;
	toggleFormatPainter(): void;
}

export interface ClipboardGroupState {
	hasSelection: boolean;
	hasClipboard: boolean;
	editable: boolean;
	formatPainterActive: boolean;
}

export interface ClipboardGroup {
	el: HTMLElement;
	update(state: ClipboardGroupState): void;
}

/** The Home Clipboard group: the shared strip plus this binding's native clipboard handlers. */
export function createClipboardGroup(
	doc: Document,
	t: Translator,
	handlers: ClipboardGroupHandlers,
): ClipboardGroup {
	registerPptxWebControls();
	const el = doc.createElement('pptx-ui-ribbon-home-clipboard');
	const actions = {
		'home.clipboard.paste': handlers.paste,
		'home.clipboard.cut': handlers.cut,
		'home.clipboard.copy': handlers.copy,
		'home.clipboard.formatPainter': handlers.toggleFormatPainter,
	} as const;
	el.addEventListener('home-request', (event) => {
		const id = (event as RibbonHomeRequestEvent).detail.id;
		if (id in actions) {
			actions[id as keyof typeof actions]();
		}
	});
	const update = ({
		hasSelection,
		hasClipboard,
		editable,
		formatPainterActive,
	}: ClipboardGroupState) => {
		// Cut and Copy act on the selection; the painter can also be cancelled
		// while armed, which is why it keys on the active flag as well.
		el.state = {
			controls: clipboardHomeControls({
				editable,
				hasSelection,
				hasClipboard,
				formatPainterActive,
				canFormatPaint: hasSelection,
				showFormatPainter: true,
			}),
			translate: t,
		};
	};
	update({ hasSelection: false, hasClipboard: false, editable: false, formatPainterActive: false });
	return { el, update };
}
