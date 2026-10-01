import type { RibbonTransitionsRequestEvent } from 'pptx-viewer-shared';
import {
	applyRibbonTransitionDraft,
	playSlideTransitionPreview,
	ribbonTransitionsDraftPatch,
	ribbonTransitionsSoundChange,
	registerPptxWebControls,
	ribbonTransitionStockSoundUrl,
} from 'pptx-viewer-shared';

import { playAnimationSound } from '../../../animation/animation-sound';
import type { Translator } from '../../../i18n';
import type { RibbonTransitionHandlers } from '../ribbon-types';

export interface TransitionsTab {
	el: HTMLElement;
	setEditable(editable: boolean): void;
	/** Re-seed every control from the ACTIVE slide's transition. */
	sync(): void;
}

/**
 * The Transitions ribbon tab: a thin adapter for the shared
 * `pptx-ui-ribbon-transitions`. Shared owns every control, label, pressed state
 * and gating; this module reads the active slide through `handlers`, commits the
 * whole draft on each change (one undoable step), replays the transition on the
 * stage for Preview (writing nothing) and applies sound picks as raw patches.
 */
export function createTransitionsTab(
	doc: Document,
	t: Translator,
	handlers: RibbonTransitionHandlers,
	onToggleInspector: () => void,
): TransitionsTab {
	registerPptxWebControls();
	const el = doc.createElement('pptx-ui-ribbon-transitions');
	let editable = true;
	const push = (): void => {
		el.state = {
			draft: handlers.readDraft(),
			transition: handlers.readTransition(),
			editable,
			translate: t,
		};
	};
	el.addEventListener('transitions-request', (event) => {
		const intent = (event as RibbonTransitionsRequestEvent).detail;
		const patch = ribbonTransitionsDraftPatch(intent);
		if (patch) {
			handlers.applyDraft({ ...handlers.readDraft(), ...patch }, false);
			return;
		}
		switch (intent.kind) {
			case 'preview':
				playSlideTransitionPreview(
					handlers.readTransition() ?? applyRibbonTransitionDraft(undefined, handlers.readDraft()),
					doc,
				);
				break;
			case 'applyToAll':
				handlers.applyDraft(handlers.readDraft(), true);
				break;
			case 'inspector':
				onToggleInspector();
				break;
			case 'soundPreview': {
				const url = ribbonTransitionStockSoundUrl(handlers.readTransition());
				if (url) {
					playAnimationSound(url);
				}
				break;
			}
			default:
				void ribbonTransitionsSoundChange(intent).then((change) => {
					if (change) {
						handlers.applyChange(change);
					}
					return undefined;
				});
		}
	});
	push();
	return {
		el,
		setEditable(next) {
			editable = next;
			push();
		},
		sync: push,
	};
}
