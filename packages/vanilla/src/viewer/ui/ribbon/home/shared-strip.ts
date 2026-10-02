import { registerPptxWebControls } from 'pptx-viewer-shared';
import type {
	PptxUiRibbonHomeElement,
	RibbonHomeIntent,
	RibbonHomeRequestEvent,
	RibbonHomeViewState,
} from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';

type HomeTag =
	| 'slides'
	| 'drawing'
	| 'arrange-align'
	| 'arrange-flip'
	| 'arrange-order'
	| 'arrange-edit';

export interface SharedHomeStrip {
	el: PptxUiRibbonHomeElement;
	/** Reflect controlled state; the shared element rejects gated intents itself. */
	set(controls: RibbonHomeViewState['controls']): void;
}

/** A shared Home element whose one `home-request` intent goes to `onIntent`. */
export function createSharedHomeStrip(
	doc: Document,
	t: Translator,
	tag: HomeTag,
	onIntent: (intent: RibbonHomeIntent) => void,
): SharedHomeStrip {
	registerPptxWebControls();
	const el = doc.createElement(`pptx-ui-ribbon-home-${tag}`);
	el.addEventListener('home-request', (event) =>
		onIntent((event as RibbonHomeRequestEvent).detail),
	);
	el.state = { controls: {}, translate: t };
	return {
		el,
		set(controls) {
			el.state = { controls, translate: t };
		},
	};
}
