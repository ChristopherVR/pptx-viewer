import { registerPptxWebControls } from 'pptx-viewer-shared';
import type { RibbonDrawRequestEvent, RibbonDrawViewState } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import type { RibbonDrawHandlers, RibbonDrawState } from '../ribbon-types';

export interface DrawTab {
	el: HTMLElement;
	setEditable(editable: boolean): void;
	update(state: RibbonDrawState): void;
}

export function createDrawTab(doc: Document, t: Translator, handlers: RibbonDrawHandlers): DrawTab {
	registerPptxWebControls();
	const el = doc.createElement('pptx-ui-ribbon-draw');
	let state: RibbonDrawViewState = {
		tool: 'select',
		color: '#000000',
		width: 3,
		editable: true,
		translate: t,
	};
	const sync = () => {
		el.state = state;
	};
	el.addEventListener('draw-request', (event) => {
		if (!state.editable) {
			return;
		}
		const intent = (event as RibbonDrawRequestEvent).detail;
		switch (intent.kind) {
			case 'tool':
				handlers.setTool(intent.value);
				break;
			case 'width':
				handlers.setWidth(intent.value);
				break;
			case 'color':
				handlers.setColor(intent.value, intent.committed);
		}
	});
	sync();
	return {
		el,
		setEditable(editable) {
			state = { ...state, editable };
			sync();
		},
		update(next) {
			state = { ...state, ...next };
			sync();
		},
	};
}
