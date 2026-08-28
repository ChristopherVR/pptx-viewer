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
 */
export type PresentationActionIntent =
	| { kind: 'goToSlide'; slideIndex: number }
	| { kind: 'move'; direction: 1 | -1 }
	| { kind: 'endShow' }
	| { kind: 'openUrl'; url: string }
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
}

/**
 * Resolve an action and perform it.
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
		runPresentationAction(outcome.action, options, runner);
	}
	return outcome.kind;
}
