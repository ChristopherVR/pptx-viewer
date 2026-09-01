/**
 * `stroke-dash-options` - the pure option catalogue backing every binding's
 * stroke/dash-pattern picker (shape/connector line style, table borders).
 *
 * WHY this lives in shared: the 12 `ST_PresetLineDashVal` values are plain
 * data with no framework in them. They previously sat inside
 * `packages/react/src/viewer/constants/connectors-strokes.ts`, which meant a
 * binding porting the picker had to retype the list (and its i18n keys) by
 * hand. `packages/react` now re-exports {@link STROKE_DASH_OPTIONS} from here
 * so there is exactly one list to update.
 *
 * @module render/stroke-dash-options
 */
import type { StrokeDashType } from 'pptx-viewer-core';

/** A selectable stroke dash pattern with its English label and i18n key. */
export interface StrokeDashOption {
	value: StrokeDashType;
	label: string;
	i18nKey: string;
}

/**
 * Every `ST_PresetLineDashVal` value offered by the inspector's dash-pattern
 * select, in the same order React's `connectors-strokes.ts` used.
 */
export const STROKE_DASH_OPTIONS: readonly StrokeDashOption[] = [
	{ value: 'solid', label: 'Solid', i18nKey: 'pptx.stroke.dashSolid' },
	{ value: 'dot', label: 'Dot', i18nKey: 'pptx.stroke.dashDot' },
	{ value: 'dash', label: 'Dash', i18nKey: 'pptx.stroke.dashDash' },
	{ value: 'dashDot', label: 'Dash Dot', i18nKey: 'pptx.stroke.dashDashDot' },
	{ value: 'lgDash', label: 'Long Dash', i18nKey: 'pptx.connectorOptions.dashLongDash' },
	{
		value: 'lgDashDot',
		label: 'Long Dash Dot',
		i18nKey: 'pptx.connectorOptions.dashLongDashDot',
	},
	{
		value: 'lgDashDotDot',
		label: 'Long Dash Dot Dot',
		i18nKey: 'pptx.connectorOptions.dashLongDashDotDot',
	},
	{ value: 'sysDot', label: 'System Dot', i18nKey: 'pptx.stroke.dashSysDot' },
	{ value: 'sysDash', label: 'System Dash', i18nKey: 'pptx.stroke.dashSysDash' },
	{
		value: 'sysDashDot',
		label: 'System Dash Dot',
		i18nKey: 'pptx.connectorOptions.dashSysDashDot',
	},
	{
		value: 'sysDashDotDot',
		label: 'System Dash Dot Dot',
		i18nKey: 'pptx.connectorOptions.dashSysDashDotDot',
	},
	{ value: 'custom', label: 'Custom', i18nKey: 'pptx.documentProperties.tabs.custom' },
];
