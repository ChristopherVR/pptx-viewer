/**
 * Connector geometry, arrow, arrow size, and stroke dash options.
 *
 * NOTE: `label` keeps the English fallback text (existing consumers outside
 * this sweep still render `option.label` directly). Each option also carries
 * an `i18nKey` pointing at the shared i18n dictionary, matching the
 * `{ value, i18nKey }` convention already used by `pptx-viewer-shared`'s
 * table-cell fill option lists, so a render site can switch to
 * `t(option.i18nKey)` without a data-shape change.
 */

import type { ConnectorArrowOption, ConnectorGeometryOption, StrokeDashOption } from '../types';

export const CONNECTOR_GEOMETRY_OPTIONS: (ConnectorGeometryOption & { i18nKey: string })[] = [
	{ value: 'straightConnector1', label: 'Straight', i18nKey: 'pptx.connectorOptions.straight' },
	{ value: 'bentConnector2', label: 'Bent', i18nKey: 'pptx.connectorOptions.bent' },
	{ value: 'bentConnector3', label: 'Double Bent', i18nKey: 'pptx.connectorOptions.doubleBent' },
	{ value: 'bentConnector4', label: 'Triple Bent', i18nKey: 'pptx.connectorOptions.tripleBent' },
	{ value: 'bentConnector5', label: 'Quad Bent', i18nKey: 'pptx.connectorOptions.quadBent' },
	{ value: 'curvedConnector2', label: 'Curved', i18nKey: 'pptx.connectorOptions.curved' },
	{
		value: 'curvedConnector3',
		label: 'Curved (Cubic)',
		i18nKey: 'pptx.connectorOptions.curvedCubic',
	},
	{ value: 'curvedConnector4', label: 'Curved 4', i18nKey: 'pptx.connectorOptions.curved4' },
	{ value: 'curvedConnector5', label: 'Curved 5', i18nKey: 'pptx.connectorOptions.curved5' },
];

export const CONNECTOR_ARROW_OPTIONS: (ConnectorArrowOption & { i18nKey: string })[] = [
	{ value: 'none', label: 'None', i18nKey: 'pptx.arrowhead.none' },
	{ value: 'triangle', label: 'Triangle', i18nKey: 'pptx.arrowhead.triangle' },
	{ value: 'stealth', label: 'Stealth', i18nKey: 'pptx.arrowhead.stealth' },
	{ value: 'diamond', label: 'Diamond', i18nKey: 'pptx.arrowhead.diamond' },
	{ value: 'oval', label: 'Oval', i18nKey: 'pptx.arrowhead.oval' },
	{ value: 'arrow', label: 'Open Arrow', i18nKey: 'pptx.arrowhead.openArrow' },
];

export const ARROW_SIZE_OPTIONS: {
	value: 'sm' | 'med' | 'lg';
	label: string;
	i18nKey: string;
}[] = [
	{ value: 'sm', label: 'Small', i18nKey: 'pptx.connectorOptions.sizeSmall' },
	{ value: 'med', label: 'Medium', i18nKey: 'pptx.connectorOptions.sizeMedium' },
	{ value: 'lg', label: 'Large', i18nKey: 'pptx.connectorOptions.sizeLarge' },
];

export const STROKE_DASH_OPTIONS: (StrokeDashOption & { i18nKey: string })[] = [
	{ value: 'solid', label: 'Solid', i18nKey: 'pptx.stroke.dashSolid' },
	{ value: 'dot', label: 'Dot', i18nKey: 'pptx.stroke.dashDot' },
	{ value: 'dash', label: 'Dash', i18nKey: 'pptx.stroke.dashDash' },
	{ value: 'dashDot', label: 'Dash Dot', i18nKey: 'pptx.stroke.dashDashDot' },
	{ value: 'lgDash', label: 'Long Dash', i18nKey: 'pptx.connectorOptions.dashLongDash' },
	{ value: 'lgDashDot', label: 'Long Dash Dot', i18nKey: 'pptx.connectorOptions.dashLongDashDot' },
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
