/**
 * Group- and control-level ribbon hiding.
 *
 * Every binding tags its ribbon markup with the catalogue ids
 * (`ribbon-control-catalog.ts`): the element that wraps a group carries
 * `data-ribbon-group="<tab>.<group>"` and the element that IS a control (its
 * button, split button, select or gallery trigger) carries
 * `data-ribbon-control="<tab>.<group>.<control>"`. A group whose markup has no
 * wrapper of its own gets a `display: contents` wrapper, so tagging never
 * changes layout.
 *
 * The binding then renders ONE `<style>` element with
 * {@link ribbonCustomizationCss} for its root. Hiding is therefore decided
 * here, once, from the resolved customisation, and the five bindings cannot
 * disagree about which markup a given id removes. Components that prefer to
 * skip rendering can ask {@link isRibbonGroupVisible} /
 * {@link isRibbonControlVisible} instead; both routes read the same sets.
 *
 * @module render/customization/ribbon-control-visibility
 */
import type { ResolvedCustomization } from './customization-resolve';
import { RIBBON_CONTROL_IDS, RIBBON_GROUP_IDS } from './ribbon-control-ids';
import type { RibbonControlId, RibbonGroupId } from './ribbon-control-ids';

/** Attribute naming a ribbon group on its wrapper element. */
export const RIBBON_GROUP_ATTR = 'data-ribbon-group';
/** Attribute naming a ribbon control on its element. */
export const RIBBON_CONTROL_ATTR = 'data-ribbon-control';
/**
 * Attribute a binding puts on its viewer root so the generated rules only
 * reach its own ribbon when two viewers share a page. The value is any
 * per-instance token.
 */
export const RIBBON_SCOPE_ATTR = 'data-pptx-ribbon-scope';

const GROUP_ID_SET: ReadonlySet<string> = new Set(RIBBON_GROUP_IDS);
const CONTROL_ID_SET: ReadonlySet<string> = new Set(RIBBON_CONTROL_IDS);

/** True when `id` names a catalogued ribbon group. */
export function isRibbonGroupId(id: string): id is RibbonGroupId {
	return GROUP_ID_SET.has(id);
}

/** True when `id` names a catalogued ribbon control. */
export function isRibbonControlId(id: string): id is RibbonControlId {
	return CONTROL_ID_SET.has(id);
}

/** True unless the host hid this group. */
export function isRibbonGroupVisible(resolved: ResolvedCustomization, id: RibbonGroupId): boolean {
	return !resolved.hiddenRibbonGroups.has(id);
}

/** True unless the host hid this control or the group it sits in. */
export function isRibbonControlVisible(
	resolved: ResolvedCustomization,
	id: RibbonControlId,
): boolean {
	if (resolved.hiddenRibbonControls.has(id)) {
		return false;
	}
	const group = id.slice(0, id.lastIndexOf('.')) as RibbonGroupId;
	return !resolved.hiddenRibbonGroups.has(group);
}

/** The attribute map a binding spreads onto a group wrapper. */
export function ribbonGroupAttrs(id: RibbonGroupId): Record<typeof RIBBON_GROUP_ATTR, string> {
	return { [RIBBON_GROUP_ATTR]: id };
}

/** The attribute map a binding spreads onto a control. */
export function ribbonControlAttrs(
	id: RibbonControlId,
): Record<typeof RIBBON_CONTROL_ATTR, string> {
	return { [RIBBON_CONTROL_ATTR]: id };
}

function attrSelector(scope: string | undefined, attr: string, id: string): string {
	const prefix = scope ? `[${RIBBON_SCOPE_ATTR}="${scope}"] ` : '';
	return `${prefix}[${attr}="${id}"]`;
}

/**
 * The stylesheet that removes every group and control the host hid, or `''`
 * when nothing is hidden. Pass the viewer's scope token (the value of its
 * {@link RIBBON_SCOPE_ATTR}) to confine the rules to that viewer; omit it for
 * a document-wide sheet. Ids are validated against the catalogue, so a stray
 * string from a host cannot inject CSS.
 */
export function ribbonCustomizationCss(resolved: ResolvedCustomization, scope?: string): string {
	const safeScope = scope && /^[\w-]+$/u.test(scope) ? scope : undefined;
	const selectors: string[] = [];
	for (const id of resolved.hiddenRibbonGroups) {
		if (isRibbonGroupId(id)) {
			selectors.push(attrSelector(safeScope, RIBBON_GROUP_ATTR, id));
		}
	}
	for (const id of resolved.hiddenRibbonControls) {
		if (isRibbonControlId(id)) {
			selectors.push(attrSelector(safeScope, RIBBON_CONTROL_ATTR, id));
		}
	}
	if (selectors.length === 0) {
		return '';
	}
	return `${selectors.join(',\n')} {\n\tdisplay: none !important;\n}\n`;
}
