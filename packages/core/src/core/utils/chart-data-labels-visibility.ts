/**
 * chart-data-labels-visibility.ts: does a `c:dLbls` group actually show
 * anything?
 *
 * PowerPoint 2013+ writes a chart-type-level `c:dLbls` on EVERY chart it
 * authors, with every `c:show*` flag set to `0`. The group's presence is not a
 * request for labels: only a `show*` flag of `1` (on the group itself or on one
 * of its per-point `c:dLbl` overrides) makes a label visible. Treating mere
 * presence as "labels on" printed a value above every bar of every modern
 * chart (COM-verified against a PowerPoint-authored clustered column).
 *
 * @module utils/chart-data-labels-visibility
 */
import type { XmlObject } from '../types';

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
	getChildrenArrayByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject[];
}

/** The `c:dLbls` / `c:dLbl` children that each make one label component visible. */
const SHOW_FLAGS = [
	'showVal',
	'showCatName',
	'showSerName',
	'showPercent',
	'showBubbleSize',
] as const;

/** A CT_Boolean is true when `@val` is `1`/`true`, or when the attribute is absent. */
function isOn(node: XmlObject | undefined): boolean {
	if (!node) {
		return false;
	}
	const value = node['@_val'];
	return value === undefined || value === '1' || value === 'true';
}

function groupShowsContent(group: XmlObject, xmlLookup: XmlLookupLike): boolean {
	if (isOn(xmlLookup.getChildByLocalName(group, 'delete'))) {
		return false;
	}
	return SHOW_FLAGS.some((flag) => isOn(xmlLookup.getChildByLocalName(group, flag)));
}

/**
 * True when the `c:dLbls` group (or any of its per-point `c:dLbl` overrides)
 * turns on at least one visible label component.
 */
export function dataLabelsGroupShowsContent(
	dLbls: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
): boolean {
	if (!dLbls) {
		return false;
	}
	if (isOn(xmlLookup.getChildByLocalName(dLbls, 'delete'))) {
		return false;
	}
	if (groupShowsContent(dLbls, xmlLookup)) {
		return true;
	}
	return xmlLookup
		.getChildrenArrayByLocalName(dLbls, 'dLbl')
		.some((point) => groupShowsContent(point, xmlLookup));
}

/** True when the `c:dLbls` group is an explicit `c:delete val="1"`. */
export function dataLabelsGroupDeleted(
	dLbls: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
): boolean {
	return dLbls !== undefined && isOn(xmlLookup.getChildByLocalName(dLbls, 'delete'));
}
