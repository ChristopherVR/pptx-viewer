/**
 * What a click during a running slide show actually MEANS.
 *
 * PowerPoint gives an on-slide click three possible readings, in priority
 * order:
 *
 *  1. The click landed on a shape carrying an Action Setting
 *     (`a:hlinkClick` on `p:cNvPr`, i.e. `PptxElement.actionClick`). The
 *     action runs; the show does NOT step on.
 *  2. The click landed on live content that owns its own click (a real
 *     hyperlink, media transport, show chrome). Nothing navigates.
 *  3. Anything else is PowerPoint's "On Mouse Click" advance.
 *
 * Only React implemented (1), and it did so inside its own JSX by calling
 * `stopPropagation` on the element's `onClick`. The other four bindings had no
 * element-level action handler at all, so on the reporter's deck
 * (`e2e/fixtures/solution-explorer.pptx`, a wheel of eight
 * `ppaction://hlinksldjump` slices) clicking ANY slice stepped the show to the
 * next slide instead of jumping to the slice's own slide: the red arrow in the
 * hub swept to the wrong position every time, which reads as "clicking the
 * slices is broken and the arrow does not move properly".
 *
 * The rule therefore lives here, keyed off the `data-element-id` attribute all
 * five bindings already stamp, so a binding wires one call into the handler it
 * already has instead of re-deriving PowerPoint's precedence.
 *
 * @module render/presentation-action
 */

import type { PptxAction, PptxElement, PptxSlide } from 'pptx-viewer-core';

import { isUrlSafe, safeOpenUrl } from './hyperlink-security';
import { isPresentationAdvanceClick } from './presentation-setup';

/**
 * `ppaction://noaction` is what PowerPoint writes when a shape's Action
 * Settings carry a highlight or a sound but no navigation ("Action: None").
 * It is deliberately NOT actionable: the shape does nothing, and the click
 * falls through to the show's own click-to-advance exactly as it would on any
 * inert shape. Treating it as an action would make the "Explore solution"
 * button on the reporter's non-linked slides swallow every click.
 */
const NO_OP_ACTION = 'ppaction://noaction';

/** True when the action is PowerPoint's explicit "do nothing" verb. */
export function isNoOpPresentationAction(action: PptxAction | undefined): boolean {
	if (!action) {
		return true;
	}
	const verb = (action.action ?? '').trim().toLowerCase();
	if (verb === NO_OP_ACTION) {
		return true;
	}
	return (
		verb.length === 0 && typeof action.targetSlideIndex !== 'number' && !(action.url ?? '').trim()
	);
}

/**
 * What running an action asks the show to do, expressed without reference to
 * any binding's navigation API.
 *
 * `move` is deliberately distinct from `goToSlide`: PowerPoint's Next/Previous
 * verbs step through the SHOW ORDER (custom show membership minus hidden
 * slides), which only a binding's own navigator knows.
 *
 * The five wave-4 additions (`lastViewed`, `customShow`, `openFile`,
 * `openPresentation`, `playMedia`, `oleVerb`) all name something only a
 * binding's own show navigator can carry out - which slide the audience saw
 * last, which show is "the" custom show `id`, how to prompt for or stream an
 * external file, how to embed another presentation, which media element to
 * toggle, which OLE verb to run - so they are classified here and left for
 * {@link PresentationActionRunner}'s optional callbacks to perform.
 */
export type PresentationActionIntent =
	| { kind: 'goToSlide'; slideIndex: number }
	| { kind: 'move'; direction: 1 | -1 }
	| { kind: 'endShow' }
	| { kind: 'openUrl'; url: string }
	/** `ppaction://hlinkshowjump?jump=lastslideviewed`: back to the last slide the audience saw. */
	| { kind: 'lastViewed' }
	/** `ppaction://customshow?id=<id>[&return=true]`. */
	| { kind: 'customShow'; customShowId: string; returnAfter: boolean }
	/** `ppaction://hlinkfile`: `target` is the relationship's resolved external path. */
	| { kind: 'openFile'; target: string }
	/** `ppaction://hlinkpres`: `target` is the relationship's resolved external path. */
	| { kind: 'openPresentation'; target: string }
	/** `ppaction://media`: play (or toggle) the acting element's own embedded media. */
	| { kind: 'playMedia'; elementId?: string }
	/** `ppaction://ole?verb=<n>`: run a numbered OLE verb on an embedded object. */
	| { kind: 'oleVerb'; verb: number }
	| { kind: 'none' };

/** A resolved action: what to navigate, plus any sound to play alongside. */
export interface PresentationActionResolution {
	intent: PresentationActionIntent;
	/** `a:snd` attached to the action, to play as the action runs. */
	soundPath?: string;
}

export interface ResolvePresentationActionOptions {
	/** Total slides in the deck, used to clamp a jump target. */
	slideCount: number;
	/**
	 * The element the action is running against, when known. Only used for
	 * `ppaction://media`'s `playMedia` intent, which targets the acting
	 * element's OWN embedded media rather than a navigation target.
	 */
	elementId?: string;
}

/** Read a `key=value` pair out of a `ppaction://verb?query` action string. */
function actionQueryParam(action: string, key: string): string | undefined {
	const match = action.match(new RegExp(`[?&]${key}=([^&]*)`, 'i'));
	return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Turn a parsed `PptxAction` into the navigation the show must perform.
 *
 * An explicit `targetSlideIndex` wins: core resolves `ppaction://hlinksldjump`
 * against the slide's relationships at parse time, so by the time it reaches a
 * viewer the r:id has already become an index. The `hlinkshowjump` verbs
 * (first / last / next / previous / end show) are matched on the action string,
 * and anything left carrying a URL opens externally.
 */
export function resolvePresentationAction(
	action: PptxAction | undefined,
	options: ResolvePresentationActionOptions,
): PresentationActionResolution {
	const soundPath = action?.soundPath;
	if (!action || isNoOpPresentationAction(action)) {
		return { intent: { kind: 'none' }, soundPath };
	}

	const verb = (action.action ?? '').toLowerCase();

	if (typeof action.targetSlideIndex === 'number' && Number.isFinite(action.targetSlideIndex)) {
		if (options.slideCount <= 0) {
			return { intent: { kind: 'none' }, soundPath };
		}
		const slideIndex = Math.max(
			0,
			Math.min(options.slideCount - 1, Math.floor(action.targetSlideIndex)),
		);
		return { intent: { kind: 'goToSlide', slideIndex }, soundPath };
	}

	if (verb.includes('hlinkshowjump')) {
		// Checked before "lastslide": "lastslideviewed" contains "lastslide" as
		// a substring, so the more specific verb has to win first.
		if (verb.includes('lastslideviewed')) {
			return { intent: { kind: 'lastViewed' }, soundPath };
		}
		if (verb.includes('nextslide')) {
			return { intent: { kind: 'move', direction: 1 }, soundPath };
		}
		if (verb.includes('previousslide')) {
			return { intent: { kind: 'move', direction: -1 }, soundPath };
		}
		if (verb.includes('firstslide')) {
			return { intent: { kind: 'goToSlide', slideIndex: 0 }, soundPath };
		}
		if (verb.includes('lastslide')) {
			return {
				intent:
					options.slideCount > 0
						? { kind: 'goToSlide', slideIndex: options.slideCount - 1 }
						: { kind: 'none' },
				soundPath,
			};
		}
		if (verb.includes('endshow')) {
			return { intent: { kind: 'endShow' }, soundPath };
		}
		return { intent: { kind: 'none' }, soundPath };
	}

	if (verb.includes('customshow')) {
		const customShowId = actionQueryParam(action.action ?? '', 'id');
		return {
			intent: customShowId
				? {
						kind: 'customShow',
						customShowId,
						returnAfter: verb.includes('return=true'),
					}
				: { kind: 'none' },
			soundPath,
		};
	}

	if (verb.includes('hlinkfile')) {
		const target = (action.url ?? '').trim();
		return { intent: target ? { kind: 'openFile', target } : { kind: 'none' }, soundPath };
	}

	if (verb.includes('hlinkpres')) {
		const target = (action.url ?? '').trim();
		return { intent: target ? { kind: 'openPresentation', target } : { kind: 'none' }, soundPath };
	}

	if (verb.includes('ppaction://media')) {
		return {
			intent: { kind: 'playMedia', ...(options.elementId ? { elementId: options.elementId } : {}) },
			soundPath,
		};
	}

	if (verb.includes('ppaction://ole')) {
		const verbNumberRaw = actionQueryParam(action.action ?? '', 'verb');
		const verbNumber =
			verbNumberRaw !== undefined ? Number.parseInt(verbNumberRaw, 10) : Number.NaN;
		return {
			intent: Number.isFinite(verbNumber)
				? { kind: 'oleVerb', verb: verbNumber }
				: { kind: 'none' },
			soundPath,
		};
	}

	// An unresolved slide jump (no relationship, or a broken r:id) navigates
	// nowhere rather than being mistaken for an external link.
	if (verb.includes('hlinksldjump')) {
		return { intent: { kind: 'none' }, soundPath };
	}

	const url = (action.url ?? '').trim();
	if (url && isUrlSafe(url)) {
		return { intent: { kind: 'openUrl', url }, soundPath };
	}
	return { intent: { kind: 'none' }, soundPath };
}

/** Every element on a slide, group children included, in document order. */
function flattenSlideElements(elements: readonly PptxElement[] | undefined): PptxElement[] {
	const flat: PptxElement[] = [];
	for (const element of elements ?? []) {
		flat.push(element);
		if (element.type === 'group' && element.children) {
			flat.push(...flattenSlideElements(element.children));
		}
	}
	return flat;
}

/** The element a click landed on, and the action it carries. */
export interface PresentationActionTarget {
	elementId: string;
	action: PptxAction;
}

/**
 * Walk up from a click target to the innermost rendered element carrying a
 * click action.
 *
 * The walk continues past an element with no action rather than stopping at
 * the first `[data-element-id]`: a hyperlinked shape inside a group paints its
 * children as their own elements, so the deepest node under the pointer is
 * usually a child of the shape that owns the action.
 */
export function findPresentationActionTarget(
	target: unknown,
	slide: PptxSlide | undefined,
): PresentationActionTarget | undefined {
	if (typeof Element === 'undefined' || !(target instanceof Element) || !slide) {
		return undefined;
	}
	const byId = new Map<string, PptxElement>();
	for (const element of flattenSlideElements(slide.elements)) {
		byId.set(element.id, element);
	}
	for (let node: Element | null = target; node !== null; node = node.parentElement) {
		const id = node.getAttribute('data-element-id');
		if (!id) {
			continue;
		}
		const action = byId.get(id)?.actionClick;
		if (action && !isNoOpPresentationAction(action)) {
			return { elementId: id, action };
		}
	}
	return undefined;
}

/**
 * The navigation a binding must expose for {@link runPresentationAction} to
 * drive. Every member maps onto something each viewer already has, so wiring an
 * action costs one call rather than a re-implementation of the verb table.
 */
export interface PresentationActionRunner {
	/** Jump to a deck index (already clamped). */
	goToSlide: (slideIndex: number) => void;
	/** Step the SHOW ORDER forward / backward, as Next and Previous do. */
	move: (direction: 1 | -1) => void;
	/** Leave the show. */
	endShow: () => void;
	/** Play the action's click sound, when the binding supports one. */
	playSound?: (soundPath: string) => void;
	/**
	 * Trust Center gate for an on-slide action that opens an external URL
	 * (Options > Trust Center > "Confirm before opening external hyperlinks").
	 * Called with the resolved URL before it is opened; returning `false`
	 * blocks the navigation. Omitted (or unset) opens unconditionally, matching
	 * the pre-existing behavior for a binding that has not wired the gate yet.
	 */
	confirmUrl?: (url: string) => boolean;
	/**
	 * `ppaction://hlinkshowjump?jump=lastslideviewed`: jump back to the last
	 * slide the audience actually saw (not necessarily the previous slide in
	 * deck order - the show may have branched via a custom show or an action
	 * button). Omitted: the click is still spent (see below), just with no
	 * navigation performed.
	 */
	lastViewed?: () => void;
	/**
	 * `ppaction://customshow?id=<id>[&return=true]`: run the named custom
	 * show. `customShowId` is the raw `id` from the action string (an index
	 * into `PptxPresentationProperties`' custom-show list, byte-for-byte as
	 * PowerPoint wrote it - a binding resolves it against its own custom-show
	 * data). `returnAfter` is PowerPoint's "Resume last slide viewed after
	 * showing this custom show" checkbox.
	 */
	customShow?: (customShowId: string, returnAfter: boolean) => void;
	/**
	 * `ppaction://hlinkfile`: open an external file. `target` is the
	 * relationship's resolved path/URL, exactly as `PptxAction.url` carries it
	 * (core resolves the `r:id` at parse time; nothing further to resolve
	 * here).
	 */
	openFile?: (target: string) => void;
	/**
	 * `ppaction://hlinkpres`: open another presentation. `target` is the
	 * relationship's resolved path/URL, same as {@link openFile}.
	 */
	openPresentation?: (target: string) => void;
	/**
	 * `ppaction://media`: play (or toggle) the CLICKED element's own embedded
	 * media, as opposed to a `media` element's normal inline transport
	 * controls. `elementId` is the element the click landed on
	 * ({@link ResolvePresentationActionOptions.elementId}), when the caller
	 * supplied one.
	 */
	playMedia?: (elementId: string | undefined) => void;
	/**
	 * `ppaction://ole?verb=<n>`: run a numbered OLE verb (e.g. `-1` = primary
	 * verb, `0` = "Edit") on the clicked element's embedded OLE object.
	 */
	oleVerb?: (verb: number) => void;
}

/**
 * Resolve an action and perform it.
 *
 * A wave-4 intent (`lastViewed`, `customShow`, `openFile`,
 * `openPresentation`, `playMedia`, `oleVerb`) whose runner callback is
 * omitted still counts as spent: the shape carries a real action either way,
 * so the click must not ALSO fall through to click-to-advance just because
 * this particular binding has not wired that verb's navigator yet.
 *
 * @returns `true` when the action navigated (or opened a URL), so the caller
 *   knows the click is spent and must not also advance the show.
 */
export function runPresentationAction(
	action: PptxAction | undefined,
	options: ResolvePresentationActionOptions,
	runner: PresentationActionRunner,
): boolean {
	const { intent, soundPath } = resolvePresentationAction(action, options);
	if (soundPath && runner.playSound) {
		runner.playSound(soundPath);
	}
	switch (intent.kind) {
		case 'goToSlide':
			runner.goToSlide(intent.slideIndex);
			return true;
		case 'move':
			runner.move(intent.direction);
			return true;
		case 'endShow':
			runner.endShow();
			return true;
		case 'openUrl':
			// A declined confirmation still counts as "the click was spent on an
			// action", the same as an opened link: the show must not also advance.
			if (runner.confirmUrl && !runner.confirmUrl(intent.url)) {
				return true;
			}
			return safeOpenUrl(intent.url);
		case 'lastViewed':
			runner.lastViewed?.();
			return true;
		case 'customShow':
			runner.customShow?.(intent.customShowId, intent.returnAfter);
			return true;
		case 'openFile':
			runner.openFile?.(intent.target);
			return true;
		case 'openPresentation':
			runner.openPresentation?.(intent.target);
			return true;
		case 'playMedia':
			runner.playMedia?.(intent.elementId);
			return true;
		case 'oleVerb':
			runner.oleVerb?.(intent.verb);
			return true;
		default:
			return false;
	}
}

/** How a binding must treat one click on a running show's stage. */
export type PresentationClickOutcome =
	| { kind: 'action'; elementId: string; action: PptxAction }
	| { kind: 'advance' }
	| { kind: 'inert' };

/**
 * Classify a click on the slide-show stage.
 *
 * `advance` still has to pass the slide's own `advanceOnClick` gate
 * ({@link isClickAdvanceAllowed}) and any pending animation builds; this only
 * decides whether the click REACHES the advance at all.
 */
export function resolvePresentationClick(
	target: unknown,
	slide: PptxSlide | undefined,
): PresentationClickOutcome {
	const actionTarget = findPresentationActionTarget(target, slide);
	if (actionTarget) {
		return { kind: 'action', elementId: actionTarget.elementId, action: actionTarget.action };
	}
	return isPresentationAdvanceClick(target) ? { kind: 'advance' } : { kind: 'inert' };
}

/**
 * The one call a binding wires into the click handler it already has.
 *
 * Classifies the click, runs any on-slide action itself, and reports what is
 * left for the caller: only `'advance'` means "now do your click-to-advance"
 * (still subject to the slide's `advanceOnClick` gate and pending builds).
 *
 * @returns The click's classification: `'action'` (consumed here),
 *   `'advance'` (the caller's to handle), or `'inert'`.
 */
export function handlePresentationStageClick(
	target: unknown,
	slide: PptxSlide | undefined,
	options: ResolvePresentationActionOptions,
	runner: PresentationActionRunner,
): PresentationClickOutcome['kind'] {
	const outcome = resolvePresentationClick(target, slide);
	if (outcome.kind === 'action') {
		// Threads the clicked element's id through for `playMedia`, which acts
		// on the acting element's OWN embedded media rather than a navigation
		// target; a caller-supplied `options.elementId` (if any) still wins.
		runPresentationAction(
			outcome.action,
			{ ...options, elementId: options.elementId ?? outcome.elementId },
			runner,
		);
	}
	return outcome.kind;
}
