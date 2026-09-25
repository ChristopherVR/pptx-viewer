/**
 * The ribbon slice of `resolveCustomization`: splits `ribbon.hiddenTabs` and
 * `ribbon.hiddenButtons` into the legacy toolbar-action ids every binding's
 * tab bar already gates on, the contextual tabs, and the catalogued groups and
 * controls the shared ribbon stylesheet hides.
 *
 * Two ribbon controls are also legacy toolbar buttons (`mergeShapes`,
 * `crop`); naming either spelling hides both, so a host does not need to know
 * which one a binding happens to check.
 *
 * @module render/customization/customization-resolve-ribbon
 */
import { RIBBON_CONTEXTUAL_TABS } from '../toolbar-actions';
import type { RibbonContextualTabId, ToolbarActionId } from '../toolbar-actions';
import type { RibbonCustomization } from './customization-types';
import type { RibbonControlId, RibbonGroupId } from './ribbon-control-ids';
import { isRibbonControlId, isRibbonGroupId } from './ribbon-control-visibility';

/** Legacy toolbar-button ids that are also catalogued ribbon controls. */
const BUTTON_CONTROL_ALIASES: ReadonlyArray<readonly [ToolbarActionId, RibbonControlId]> = [
	['mergeShapes', 'home.arrange.mergeShapes'],
	['crop', 'home.arrange.crop'],
];

const CONTEXTUAL_TAB_IDS: ReadonlySet<string> = new Set(RIBBON_CONTEXTUAL_TABS.map((t) => t.id));

export interface ResolvedRibbonCustomization {
	actions: Set<ToolbarActionId>;
	contextualTabs: Set<RibbonContextualTabId>;
	groups: Set<RibbonGroupId>;
	controls: Set<RibbonControlId>;
}

/** Split a host's ribbon customisation into the sets the render sites read. */
export function resolveRibbonCustomization(
	ribbon: RibbonCustomization | undefined,
): ResolvedRibbonCustomization {
	const actions = new Set<ToolbarActionId>();
	const contextualTabs = new Set<RibbonContextualTabId>();
	const groups = new Set<RibbonGroupId>();
	const controls = new Set<RibbonControlId>();
	for (const tab of ribbon?.hiddenTabs ?? []) {
		if (CONTEXTUAL_TAB_IDS.has(tab)) {
			contextualTabs.add(tab as RibbonContextualTabId);
		} else {
			actions.add(tab as ToolbarActionId);
		}
	}
	for (const group of ribbon?.hiddenGroups ?? []) {
		if (isRibbonGroupId(group)) {
			groups.add(group);
		}
	}
	for (const button of ribbon?.hiddenButtons ?? []) {
		if (isRibbonControlId(button)) {
			controls.add(button);
		} else {
			actions.add(button as ToolbarActionId);
		}
	}
	for (const [action, control] of BUTTON_CONTROL_ALIASES) {
		if (actions.has(action)) {
			controls.add(control);
		} else if (controls.has(control)) {
			actions.add(action);
		}
	}
	return { actions, contextualTabs, groups, controls };
}
