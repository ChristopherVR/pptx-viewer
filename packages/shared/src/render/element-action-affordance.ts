/**
 * On-canvas affordances for an element that carries a PowerPoint Action Setting.
 *
 * PowerPoint's editing view tells the author, without a click, which shapes are
 * wired up: an action shape gets a marker, and hovering one shows where it goes.
 * The viewer mirrors that with two affordances:
 *
 *  - the **action indicator**, a small amber lightning badge pinned to the
 *    element's top-right corner whenever it owns an `a:hlinkClick` (click) or
 *    `a:hlinkHover` (mouse-over) action;
 *  - the **link tooltip**, a popover under the element naming the destination
 *    plus how to follow it.
 *
 * Both are AUTHORING chrome, so both are gated on the live editing canvas.
 * Painting them during a slide show would be wrong twice over: the audience
 * would see editor furniture, and the badge would sit on top of the very shape
 * the presenter is trying to click. `presenting` is therefore a hard veto, not
 * merely the absence of `canInteract`, because the four non-React bindings run
 * their presentation stage through the same renderer as the editing one.
 *
 * Only React drew either of them; the tooltip additionally existed in Vue. That
 * divergence was also the last residual noise in the cross-binding render
 * fingerprints, since the badge contributes an `<svg>` and the tooltip
 * contributes text to an otherwise textless element. The rule and the styling
 * therefore both live here, so the five bindings cannot drift apart again: a
 * binding supplies only the markup, never the decision or the look.
 *
 * @module render/element-action-affordance
 */

import type { PptxElement } from 'pptx-viewer-core';

/** Class on the element box that hosts a link tooltip (drives `:hover`). */
export const LINK_TOOLTIP_HOST_CLASS = 'pptx-link-host';

/** Class on the tooltip's outer positioning box. */
export const LINK_TOOLTIP_CLASS = 'pptx-link-tooltip';

/** Class on the tooltip's bordered panel. */
export const LINK_TOOLTIP_PANEL_CLASS = 'pptx-link-tooltip-panel';

/** Class on the tooltip's destination line. */
export const LINK_TOOLTIP_LABEL_CLASS = 'pptx-link-tooltip-label';

/** Class on the tooltip's "how to follow this" hint line. */
export const LINK_TOOLTIP_HINT_CLASS = 'pptx-link-tooltip-hint';

/** Class on the amber action badge. */
export const ACTION_INDICATOR_CLASS = 'pptx-action-indicator';

/**
 * `d` of the lightning bolt inside the badge, on a `0 0 24 24` viewBox.
 *
 * Shared rather than restated per binding so the glyph cannot drift; it is the
 * same path React has drawn since the badge was introduced.
 */
export const ACTION_INDICATOR_ICON_PATH = 'M13 2L3 14h9l-1 8 10-12h-9l1-8z';

/**
 * Styling for both affordances, injected once per document by each binding.
 *
 * Written as plain CSS against the `--pptx-*` theme tokens (rather than as
 * Tailwind utilities, which only React and Vue can use) so Angular, Vanilla and
 * Svelte get the identical look for free, and so a theme override reaches all
 * five.
 *
 * `font-family` is stated explicitly and deliberately. Left to inherit, the
 * tooltip picks up whatever the host app happens to set, which is how React and
 * Vue ended up rendering the same tooltip in two different stacks and put 80
 * spurious entries into the render-parity fingerprints. Pinning it here makes
 * the affordance's typography a property of the affordance.
 */
export const ACTION_AFFORDANCE_CSS = `
.${ACTION_INDICATOR_CLASS} {
	position: absolute;
	top: -4px;
	right: -4px;
	z-index: 20;
	display: flex;
	width: 16px;
	height: 16px;
	align-items: center;
	justify-content: center;
	border-radius: 9999px;
	background: #f59e0b;
	/* Left pointer-interactive on purpose: the badge's native title attribute is
	   the only place the deck's screen tip is readable, and a title on a
	   pointer-transparent node never fires. Clicks still reach the element
	   underneath by bubbling, so nothing is swallowed. */
	box-shadow: 0 1px 3px 0 rgb(0 0 0 / 10%), 0 1px 2px -1px rgb(0 0 0 / 10%);
}
.${ACTION_INDICATOR_CLASS} svg {
	width: 10px;
	height: 10px;
	color: #fff;
}
.${LINK_TOOLTIP_CLASS} {
	position: absolute;
	top: 100%;
	left: 4px;
	z-index: 9999;
	max-width: 16rem;
	margin-top: 4px;
	opacity: 0;
	transition: opacity 150ms;
	pointer-events: none;
	font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
	text-align: left;
}
.${LINK_TOOLTIP_HOST_CLASS}:hover > .${LINK_TOOLTIP_CLASS} {
	opacity: 1;
}
.${LINK_TOOLTIP_PANEL_CLASS} {
	border: 1px solid var(--pptx-border, #374151);
	border-radius: 0.25rem;
	background: var(--pptx-popover, #111827);
	padding: 6px 10px;
	box-shadow: 0 10px 15px -3px rgb(0 0 0 / 10%), 0 4px 6px -4px rgb(0 0 0 / 10%);
}
.${LINK_TOOLTIP_LABEL_CLASS} {
	overflow: hidden;
	color: var(--pptx-foreground, #f3f4f6);
	font-size: 12px;
	font-weight: 400;
	font-style: normal;
	line-height: 16px;
	letter-spacing: normal;
	text-decoration: none;
	text-overflow: ellipsis;
	text-transform: none;
	white-space: nowrap;
}
.${LINK_TOOLTIP_HINT_CLASS} {
	margin-top: 2px;
	color: var(--pptx-muted-foreground, #9ca3af);
	font-size: 10px;
	font-weight: 400;
	font-style: normal;
	line-height: 12px;
	letter-spacing: normal;
	text-decoration: none;
	text-transform: none;
}
`;

/** `id` of the once-per-document `<style>` holding {@link ACTION_AFFORDANCE_CSS}. */
const AFFORDANCE_STYLE_ELEMENT_ID = 'pptx-action-affordance-styles';

/**
 * Inject {@link ACTION_AFFORDANCE_CSS} into a document exactly once.
 *
 * Every binding calls this from its viewer root rather than shipping the rules
 * in its own stylesheet, because a per-package copy is precisely how the two
 * existing implementations drifted. Idempotent, and a no-op under SSR.
 */
export function ensureActionAffordanceStyles(doc?: Document): void {
	const target = doc ?? (typeof document === 'undefined' ? undefined : document);
	if (!target || target.getElementById(AFFORDANCE_STYLE_ELEMENT_ID)) {
		return;
	}
	const style = target.createElement('style');
	style.id = AFFORDANCE_STYLE_ELEMENT_ID;
	style.textContent = ACTION_AFFORDANCE_CSS;
	(target.head ?? target.documentElement).appendChild(style);
}

/** Translated strings the affordances fall back to when the deck names none. */
export interface ActionAffordanceLabels {
	/** Badge title when neither action carries a screen tip ("Has action"). */
	hasAction: string;
	/** Tooltip label when the action names no destination ("Link"). */
	link: string;
	/** Hint for an action that opens a URL ("Ctrl+Click to follow link"). */
	followLink: string;
	/** Hint for a navigation/verb action ("Active in presentation mode"). */
	presentationMode: string;
}

/**
 * Build the label set from a binding's translator.
 *
 * The four dictionary keys are named once, here, so a binding cannot quietly
 * hard-code English (which is how React's badge shipped an untranslated "Has
 * action" while the key for it already existed).
 */
export function actionAffordanceLabels(translate: (key: string) => string): ActionAffordanceLabels {
	return {
		hasAction: translate('pptx.element.hasAction'),
		link: translate('pptx.element.linkFallback'),
		followLink: translate('pptx.linkTooltip.followLink'),
		presentationMode: translate('pptx.linkTooltip.presentationMode'),
	};
}

/** Where the affordances are being asked for. */
export interface ActionAffordanceContext {
	/**
	 * The live editing canvas is showing this element. Thumbnails, presenter
	 * previews, export rasters and read-only canvases pass `false`.
	 */
	canInteract: boolean;
	/** This stage is a running slide show; a hard veto (see the module note). */
	presenting?: boolean;
	labels: ActionAffordanceLabels;
}

/** What a binding should render for one element. */
export interface ElementActionAffordance {
	/** Draw the amber badge. */
	showIndicator: boolean;
	/** `title` for the badge: the deck's screen tip, else the generic label. */
	indicatorTitle: string;
	/** Draw the hover tooltip (and put {@link LINK_TOOLTIP_HOST_CLASS} on the box). */
	showLinkTooltip: boolean;
	/** Destination line: screen tip, else URL, else the `ppaction://` verb. */
	linkTooltipLabel: string;
	/** Hint line, already resolved to the URL / navigation wording. */
	linkTooltipHint: string;
}

/** Nothing to draw; shared so the common case allocates one frozen object. */
const NO_AFFORDANCE: ElementActionAffordance = Object.freeze({
	showIndicator: false,
	indicatorTitle: '',
	showLinkTooltip: false,
	linkTooltipLabel: '',
	linkTooltipHint: '',
});

/**
 * Decide which action affordances an element gets, and with what text.
 *
 * Kept a single call returning both affordances (rather than two predicates)
 * because they share the same gate and the same fallback chain, and the one
 * time they were derived separately per binding they immediately diverged.
 */
export function resolveElementActionAffordance(
	element: PptxElement,
	context: ActionAffordanceContext,
): ElementActionAffordance {
	const { canInteract, presenting = false, labels } = context;
	const click = element.actionClick;
	const hover = element.actionHover;
	if (!canInteract || presenting || (!click && !hover)) {
		return NO_AFFORDANCE;
	}
	const hasUrl = Boolean(click?.url);
	return {
		showIndicator: true,
		indicatorTitle: click?.tooltip || hover?.tooltip || labels.hasAction,
		// The tooltip names a CLICK destination, so a hover-only action gets the
		// badge but no popover: there is nothing to follow and no key to press.
		showLinkTooltip: Boolean(click),
		linkTooltipLabel: click?.tooltip || click?.url || click?.action || labels.link,
		linkTooltipHint: hasUrl ? labels.followLink : labels.presentationMode,
	};
}
