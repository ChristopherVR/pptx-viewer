import {
	presenterConsoleAction,
	presenterConsoleViewState,
	registerPptxWebControls,
} from 'pptx-viewer-shared';
import type {
	PptxUiPresenterConsoleElement,
	PresentationPointerTool,
	PresentationSnapshot,
	PresenterConsoleRequestEvent,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';

/**
 * The presenter console's control strip: a thin adapter over the shared
 * `pptx-ui-presenter-console`, which renders the shared inventory.
 *
 * Every label is a translated `aria-label` + `title`, never bare text. The old
 * vanilla console wrote English `textContent` into fourteen buttons, which made
 * the console untranslatable and left the two blackout switches announcing
 * themselves to a screen reader as the letters "B" and "W". The on and disabled
 * rule (`presenterConsoleViewState`) and the meaning of a press
 * (`presenterConsoleAction`) are shared; this maps the result to the host's
 * handlers.
 *
 * @module viewer/presenter/presenter-strip
 */

/** Everything the strip needs to read and drive. */
export interface PresenterStripOptions {
	doc: Document;
	t: Translator;
	getSnapshot: () => PresentationSnapshot;
	/** Whether the audience display window is currently open. */
	isAudienceOpen: () => boolean;
	toggleTimer: () => void;
	resetTimer: () => void;
	showAllSlides: () => void;
	stepZoom: (direction: 1 | -1) => void;
	resetZoom: () => void;
	/** Arm a tool, or `none` to disarm the active one. */
	setPointerTool: (tool: PresentationPointerTool) => void;
	/** Toggle a blackout colour: the host switches it off when it is already active. */
	setBlackout: (value: 'black' | 'white') => void;
	toggleCaptions: () => void;
	toggleAudience: () => void;
	swapDisplays: () => void;
	end: () => void;
}

export interface PresenterStrip {
	root: HTMLElement;
	/** Re-read the snapshot and audience state into the strip. */
	sync: () => void;
}

export function buildPresenterStrip(options: PresenterStripOptions): PresenterStrip {
	registerPptxWebControls();
	const { doc, t } = options;
	const root = doc.createElement('pptx-ui-presenter-console') as PptxUiPresenterConsoleElement;
	root.className = 'pptxv-presenter-strip';
	const plain = {
		'timer-toggle': options.toggleTimer,
		'timer-reset': options.resetTimer,
		'all-slides': options.showAllSlides,
		'zoom-reset': options.resetZoom,
		captions: options.toggleCaptions,
		audience: options.toggleAudience,
		'swap-displays': options.swapDisplays,
		end: options.end,
	} as const;
	root.addEventListener('presenter-console-request', (event) => {
		const snapshot = options.getSnapshot();
		const action = presenterConsoleAction(
			(event as PresenterConsoleRequestEvent).detail.id,
			snapshot,
		);
		if (!action) {
			return;
		}
		switch (action.kind) {
			case 'pointer':
				options.setPointerTool(action.tool);
				break;
			case 'blackout':
				// `none` means "switch the active colour off": the host toggles by colour.
				options.setBlackout(
					action.value === 'none' ? (snapshot.blackout as 'black') : action.value,
				);
				break;
			case 'zoom':
				options.stepZoom(action.direction);
				break;
			default:
				plain[action.kind]();
		}
	});
	const sync = (): void => {
		root.state = {
			...presenterConsoleViewState(options.getSnapshot(), options.isAudienceOpen()),
			translate: t,
		};
	};
	sync();
	return { root, sync };
}
