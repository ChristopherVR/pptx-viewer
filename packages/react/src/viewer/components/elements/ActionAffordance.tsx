/**
 * The on-canvas affordances for an element carrying a PowerPoint Action
 * Setting: the amber "has action" badge and the hover link tooltip.
 *
 * The decision, the fallback text chain and the styling all live in
 * `pptx-viewer-shared` (`render/element-action-affordance`); this file is only
 * the React view of them, so the five bindings cannot drift apart again.
 */
import type { PptxElement } from 'pptx-viewer-core';
import {
	ACTION_INDICATOR_CLASS,
	ACTION_INDICATOR_ICON_PATH,
	LINK_TOOLTIP_CLASS,
	LINK_TOOLTIP_HINT_CLASS,
	LINK_TOOLTIP_LABEL_CLASS,
	LINK_TOOLTIP_PANEL_CLASS,
	actionAffordanceLabels,
	ensureActionAffordanceStyles,
	resolveElementActionAffordance,
} from 'pptx-viewer-shared';
import type { ElementActionAffordance } from 'pptx-viewer-shared';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Resolve what this element's action affordances should say and whether to draw
 * them at all.
 *
 * The stylesheet is ensured here rather than from an effect on purpose: an
 * effect runs after the first paint, and the tooltip's "hidden until hovered"
 * rule IS the stylesheet, so a deferred injection would flash every tooltip on
 * the slide. The call is idempotent per document and a no-op under SSR.
 */
export function useActionAffordance(
	element: PptxElement,
	canInteract: boolean,
): ElementActionAffordance {
	const { t } = useTranslation();
	ensureActionAffordanceStyles();
	return useMemo(
		() =>
			resolveElementActionAffordance(element, {
				canInteract,
				// Wrapped rather than passed by reference: i18next's `TFunction` is
				// heavily overloaded and does not assign to a plain key -> string.
				labels: actionAffordanceLabels((key) => t(key)),
			}),
		[element, canInteract, t],
	);
}

/** Small amber lightning-bolt badge shown when an element has an action. */
export function ActionIndicator({ title }: { title: string }): React.ReactElement {
	return (
		<div className={ACTION_INDICATOR_CLASS} title={title}>
			<svg viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'>
				<path d={ACTION_INDICATOR_ICON_PATH} />
			</svg>
		</div>
	);
}

/** PowerPoint-style hover tooltip naming an action's destination. */
export function LinkTooltip({ label, hint }: { label: string; hint: string }): React.ReactElement {
	return (
		<div className={LINK_TOOLTIP_CLASS}>
			<div className={LINK_TOOLTIP_PANEL_CLASS}>
				<div className={LINK_TOOLTIP_LABEL_CLASS}>{label}</div>
				<div className={LINK_TOOLTIP_HINT_CLASS}>{hint}</div>
			</div>
		</div>
	);
}

/** Both affordances, or nothing when the element carries no action. */
export function ActionAffordances({
	affordance,
}: {
	affordance: ElementActionAffordance;
}): React.ReactElement | null {
	if (!affordance.showIndicator && !affordance.showLinkTooltip) {
		return null;
	}
	return (
		<>
			{affordance.showIndicator && <ActionIndicator title={affordance.indicatorTitle} />}
			{affordance.showLinkTooltip && (
				<LinkTooltip label={affordance.linkTooltipLabel} hint={affordance.linkTooltipHint} />
			)}
		</>
	);
}
