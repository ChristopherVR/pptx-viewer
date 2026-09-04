/**
 * Action conversion helpers for element click/hover actions.
 *
 * Converts between the low-level {@link PptxAction} (which mirrors
 * the OOXML `ppaction://` URI scheme) and the high-level
 * {@link ElementAction} (which the editor UI works with).
 *
 * OOXML action URIs follow the pattern:
 *   `ppaction://hlinksldjump`  : navigate to a specific slide
 *   `ppaction://hlinkshowjump?jump=<verb>`: navigate first/last/next/prev/end/lastslideviewed
 *   `ppaction://customshow?id=<id>[&return=true]`: jump into a named custom show
 *   `ppaction://hlinkfile`: open an external file (target on the action's `r:id`)
 *   `ppaction://hlinkpres`: open another presentation (target on the action's `r:id`)
 *   `ppaction://media`: play the element's own embedded media
 *   `ppaction://ole?verb=<n>`: run a numbered OLE verb on an embedded object
 *
 * @module element-actions
 */

import type { PptxElement, PptxAction, ElementAction, ElementActionType } from '../types';

// ---------------------------------------------------------------------------
// Action ↔ PptxAction conversion helpers
// ---------------------------------------------------------------------------

/**
 * Maps OOXML `hlinkshowjump` verb strings (lowercase) to their
 * corresponding high-level {@link ElementActionType} values.
 */
const JUMP_VERB_MAP: Record<string, ElementActionType> = {
	nextslide: 'nextSlide',
	previousslide: 'prevSlide',
	firstslide: 'firstSlide',
	lastslide: 'lastSlide',
	endshow: 'endShow',
	lastslideviewed: 'lastViewed',
};

/** Read a `key=value` pair out of a lowercased `ppaction://verb?query` string. */
function actionQueryParam(actionStr: string, key: string): string | undefined {
	const match = actionStr.match(new RegExp(`[?&]${key}=([^&]*)`));
	return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Derive a high-level {@link ElementAction} from a low-level
 * {@link PptxAction}. Inspects the `action` URI string to determine
 * the action type (slide jump, show jump, or external URL).
 *
 * @param pptxAction - The low-level PPTX action from the XML model.
 * @param trigger - Whether this action fires on `"click"` or `"hover"`.
 * @returns A high-level {@link ElementAction} for the editor UI.
 */
export function pptxActionToElementAction(
	pptxAction: PptxAction,
	trigger: 'click' | 'hover',
): ElementAction {
	const originalAction = pptxAction.action ?? '';
	const actionStr = originalAction.toLowerCase();

	// Slide jump via ppaction://hlinksldjump: navigates to a specific slide
	if (actionStr.includes('hlinksldjump') && typeof pptxAction.targetSlideIndex === 'number') {
		return { trigger, type: 'slide', slideIndex: pptxAction.targetSlideIndex };
	}

	// Show-jump verbs (ppaction://hlinkshowjump?jump=<verb>): navigational actions
	if (actionStr.includes('hlinkshowjump')) {
		// Sort by descending key length so "lastslideviewed" is tried before any
		// shorter verb whose characters happen to be a substring of it.
		for (const [verb, actionType] of Object.entries(JUMP_VERB_MAP).sort(
			(a, b) => b[0].length - a[0].length,
		)) {
			if (actionStr.includes(verb)) {
				return { trigger, type: actionType };
			}
		}
	}

	// Custom show jump: ppaction://customshow?id=<id>[&return=true]
	if (actionStr.includes('customshow')) {
		// The id itself keeps its original case; only the verb match above is
		// case-insensitive.
		const customShowId = actionQueryParam(originalAction, 'id');
		return {
			trigger,
			type: 'customShow',
			...(customShowId ? { customShowId } : {}),
			returnAfter: actionStr.includes('return=true'),
		};
	}

	// Open an external file: ppaction://hlinkfile (target resolved via r:id)
	if (actionStr.includes('hlinkfile')) {
		return { trigger, type: 'openFile', ...(pptxAction.url ? { url: pptxAction.url } : {}) };
	}

	// Run an external program: ppaction://program (target resolved via r:id,
	// same shape as hlinkfile). Checked before the generic "external URL"
	// fallback below so a Run-Program action does not get reported as `type:
	// 'url'` and, if the Action Settings UI round-trips it unchanged, silently
	// corrupted into a plain hyperlink on save (issue G15).
	if (actionStr.includes('ppaction://program')) {
		return { trigger, type: 'runProgram', ...(pptxAction.url ? { url: pptxAction.url } : {}) };
	}

	// Open another presentation: ppaction://hlinkpres (target resolved via r:id)
	if (actionStr.includes('hlinkpres')) {
		return {
			trigger,
			type: 'openPresentation',
			...(pptxAction.url ? { url: pptxAction.url } : {}),
		};
	}

	// Play the element's own embedded media: ppaction://media
	if (actionStr.includes('ppaction://media')) {
		return { trigger, type: 'playMedia' };
	}

	// Run a numbered OLE verb on an embedded object: ppaction://ole?verb=<n>
	if (actionStr.includes('ppaction://ole')) {
		const verbRaw = actionQueryParam(actionStr, 'verb');
		const verb = verbRaw !== undefined ? Number.parseInt(verbRaw, 10) : Number.NaN;
		return { trigger, type: 'oleVerb', ...(Number.isFinite(verb) ? { oleVerb: verb } : {}) };
	}

	// External URL (only when not a slide jump to avoid false positives)
	if (pptxAction.url && !actionStr.includes('hlinksldjump')) {
		return { trigger, type: 'url', url: pptxAction.url };
	}

	return { trigger, type: 'none' };
}

/**
 * Convert a high-level {@link ElementAction} back to a low-level
 * {@link PptxAction} for serialisation into OOXML.
 *
 * Returns `undefined` when the action type is `"none"` (no action configured).
 *
 * @param ea - The high-level element action.
 * @returns A {@link PptxAction} for XML serialisation, or `undefined`.
 */
export function elementActionToPptxAction(ea: ElementAction): PptxAction | undefined {
	if (ea.type === 'none') {
		return undefined;
	}

	const action: PptxAction = {};

	switch (ea.type) {
		case 'url':
			if (ea.url) {
				action.url = ea.url;
			}
			break;
		case 'slide':
			action.action = 'ppaction://hlinksldjump';
			if (typeof ea.slideIndex === 'number') {
				action.targetSlideIndex = ea.slideIndex;
			}
			break;
		case 'firstSlide':
			action.action = 'ppaction://hlinkshowjump?jump=firstslide';
			break;
		case 'lastSlide':
			action.action = 'ppaction://hlinkshowjump?jump=lastslide';
			break;
		case 'prevSlide':
			action.action = 'ppaction://hlinkshowjump?jump=previousslide';
			break;
		case 'nextSlide':
			action.action = 'ppaction://hlinkshowjump?jump=nextslide';
			break;
		case 'endShow':
			action.action = 'ppaction://hlinkshowjump?jump=endshow';
			break;
		case 'lastViewed':
			action.action = 'ppaction://hlinkshowjump?jump=lastslideviewed';
			break;
		case 'customShow': {
			const params = [`id=${ea.customShowId ?? ''}`, ...(ea.returnAfter ? ['return=true'] : [])];
			action.action = `ppaction://customshow?${params.join('&')}`;
			break;
		}
		case 'openFile':
			action.action = 'ppaction://hlinkfile';
			if (ea.url) {
				action.url = ea.url;
			}
			break;
		case 'runProgram':
			action.action = 'ppaction://program';
			if (ea.url) {
				action.url = ea.url;
			}
			break;
		case 'openPresentation':
			action.action = 'ppaction://hlinkpres';
			if (ea.url) {
				action.url = ea.url;
			}
			break;
		case 'playMedia':
			action.action = 'ppaction://media';
			break;
		case 'oleVerb':
			action.action = `ppaction://ole?verb=${typeof ea.oleVerb === 'number' ? ea.oleVerb : 0}`;
			break;
	}

	return action;
}

/**
 * Check if an element has any configured interactive action
 * (either click or hover).
 *
 * @param element - The element to check.
 * @returns `true` if the element has a click or hover action.
 */
export function elementHasAction(element: PptxElement): boolean {
	return Boolean(element.actionClick || element.actionHover);
}
