/**
 * Paint the on-canvas action affordances (see `element-action-affordance`) at a
 * rendered stage boundary, for the bindings that cannot paint them inline.
 *
 * React renders the badge and the tooltip as JSX children of its element
 * container, which wraps EVERY element type. The other four bindings do not
 * wrap: their element renderer dispatches straight to a per-type component
 * (image, chart, table, media, ole, zoom, ...) whose single root IS the element
 * node, so there is no shared parent to hang extra children off. Reproducing
 * the affordance inside all twelve per-type components in each of four bindings
 * would be forty-odd copies of the same markup, which is precisely the drift
 * this change exists to remove.
 *
 * So the four bindings decorate after render instead, exactly as they already
 * do for the role / name / `data-pptx-action` half of the element contract
 * (`applyRenderedElementAccessibility`), and call this alongside it. The pass is
 * idempotent and re-runs on every slide / element-list change, so a framework
 * re-render that discards the nodes simply gets them back.
 *
 * @module render/element-action-affordance-dom
 */

import type { PptxElement } from 'pptx-viewer-core';

import { elementIdSelector } from './css-escape';
import {
	ACTION_INDICATOR_CLASS,
	ACTION_INDICATOR_ICON_PATH,
	LINK_TOOLTIP_CLASS,
	LINK_TOOLTIP_HINT_CLASS,
	LINK_TOOLTIP_HOST_CLASS,
	LINK_TOOLTIP_LABEL_CLASS,
	LINK_TOOLTIP_PANEL_CLASS,
	ensureActionAffordanceStyles,
	resolveElementActionAffordance,
} from './element-action-affordance';
import type { ActionAffordanceLabels } from './element-action-affordance';

/** Marks a node this pass owns, so it can be refreshed or removed cleanly. */
const AFFORDANCE_ATTRIBUTE = 'data-pptx-affordance';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** Where and with what text to paint the affordances. */
export interface ElementActionAffordanceDomOptions {
	/** The live editing canvas is showing these elements. */
	canInteract: boolean;
	/** This stage is a running slide show; suppresses everything. */
	presenting?: boolean;
	labels: ActionAffordanceLabels;
}

/**
 * Element types this pass leaves alone.
 *
 * A connector's rendered node is its pointer-transparent bounding box, not the
 * line itself: only the stroke's hit target takes the pointer. A badge pinned
 * to that box's corner would float in empty space and could never be hovered,
 * so React does not draw one there either.
 */
function skipsAffordance(element: PptxElement): boolean {
	return element.type === 'connector';
}

/** Remove any affordance nodes this pass previously added to `node`. */
function clearAffordances(node: Element): void {
	node.classList.remove(LINK_TOOLTIP_HOST_CLASS);
	for (const owned of [...node.children]) {
		if (owned.hasAttribute(AFFORDANCE_ATTRIBUTE)) {
			owned.remove();
		}
	}
}

/** The affordance child of `node` with this kind, or `undefined`. */
function ownedChild(node: Element, kind: string): HTMLElement | undefined {
	for (const child of [...node.children]) {
		if (child.getAttribute(AFFORDANCE_ATTRIBUTE) === kind) {
			return child as HTMLElement;
		}
	}
	return undefined;
}

/** Build (once) the amber badge, whose only mutable part is its `title`. */
function buildIndicator(doc: Document): HTMLElement {
	const badge = doc.createElement('div');
	badge.setAttribute(AFFORDANCE_ATTRIBUTE, 'indicator');
	badge.className = ACTION_INDICATOR_CLASS;
	const svg = doc.createElementNS(SVG_NAMESPACE, 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('fill', 'currentColor');
	svg.setAttribute('aria-hidden', 'true');
	const path = doc.createElementNS(SVG_NAMESPACE, 'path');
	path.setAttribute('d', ACTION_INDICATOR_ICON_PATH);
	svg.appendChild(path);
	badge.appendChild(svg);
	return badge;
}

/** Build (once) the hover tooltip; its two text lines are refreshed in place. */
function buildTooltip(doc: Document): HTMLElement {
	const tooltip = doc.createElement('div');
	tooltip.setAttribute(AFFORDANCE_ATTRIBUTE, 'tooltip');
	tooltip.className = LINK_TOOLTIP_CLASS;
	const panel = doc.createElement('div');
	panel.className = LINK_TOOLTIP_PANEL_CLASS;
	const label = doc.createElement('div');
	label.className = LINK_TOOLTIP_LABEL_CLASS;
	const hint = doc.createElement('div');
	hint.className = LINK_TOOLTIP_HINT_CLASS;
	panel.appendChild(label);
	panel.appendChild(hint);
	tooltip.appendChild(panel);
	return tooltip;
}

/** Set `text` only when it changed, so a re-run never dirties the DOM. */
function setText(node: Element, text: string): void {
	if (node.textContent !== text) {
		node.textContent = text;
	}
}

/**
 * Paint / refresh / remove the action affordances for every top-level element
 * on `stage`, returning how many elements ended up carrying one.
 *
 * Group CHILDREN are deliberately not decorated: PowerPoint treats a group as
 * one object, the click resolves up to it (`resolveTopLevelElementId`), and
 * React badges only its top-level container. A grouped child's own action is
 * still followed, and still announced, it just does not get its own badge.
 */
export function applyElementActionAffordances(
	stage: ParentNode,
	elements: readonly PptxElement[],
	options: ElementActionAffordanceDomOptions,
): number {
	let painted = 0;
	for (const element of elements) {
		const node = stage.querySelector(elementIdSelector(element.id));
		if (!node) {
			continue;
		}
		const affordance = skipsAffordance(element)
			? undefined
			: resolveElementActionAffordance(element, options);
		if (!affordance || (!affordance.showIndicator && !affordance.showLinkTooltip)) {
			clearAffordances(node);
			continue;
		}
		const doc = node.ownerDocument;
		ensureActionAffordanceStyles(doc);

		if (affordance.showIndicator) {
			let badge = ownedChild(node, 'indicator');
			if (!badge) {
				badge = buildIndicator(doc);
				node.appendChild(badge);
			}
			if (badge.getAttribute('title') !== affordance.indicatorTitle) {
				badge.setAttribute('title', affordance.indicatorTitle);
			}
		} else {
			ownedChild(node, 'indicator')?.remove();
		}

		if (affordance.showLinkTooltip) {
			let tooltip = ownedChild(node, 'tooltip');
			if (!tooltip) {
				tooltip = buildTooltip(doc);
				node.appendChild(tooltip);
			}
			const panel = tooltip.firstElementChild;
			if (panel?.firstElementChild && panel.lastElementChild) {
				setText(panel.firstElementChild, affordance.linkTooltipLabel);
				setText(panel.lastElementChild, affordance.linkTooltipHint);
			}
			node.classList.add(LINK_TOOLTIP_HOST_CLASS);
		} else {
			ownedChild(node, 'tooltip')?.remove();
			node.classList.remove(LINK_TOOLTIP_HOST_CLASS);
		}
		painted += 1;
	}
	return painted;
}
