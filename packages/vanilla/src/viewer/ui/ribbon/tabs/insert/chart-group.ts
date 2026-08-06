import { INSERT_CHART_TYPES } from 'pptx-viewer-shared';
import type { InsertChartKind } from 'pptx-viewer-shared';

import type { Translator } from '../../../../i18n';
import type { SelectButtonHandle } from '../../../select-button';
import { makeSelectButton } from '../../../select-button';

/**
 * Insert > Chart: a chart-type `<select>` beside an insert button, matching
 * React's Insert section. The type is parked in the select, so inserting
 * several charts of the same kind is one click each.
 *
 * The select carries the dropdown entry id (`InsertChartKind`), not the raw
 * `PptxChartType`: Column and Bar are two entries over the same `'bar'` family
 * (vertical vs horizontal), and only the id keeps them distinguishable all the
 * way into `createDefaultChartElement`.
 */
export function createChartControl(
	doc: Document,
	t: Translator,
	onInsert: (chartKind: InsertChartKind) => void,
): SelectButtonHandle<InsertChartKind> {
	return makeSelectButton<InsertChartKind>(doc, {
		selectLabel: t('pptx.ribbon.chartType'),
		buttonLabel: t('pptx.ribbon.chart'),
		buttonTitle: t('pptx.ribbon.insertChart'),
		icon: 'chart',
		items: INSERT_CHART_TYPES.map((ct) => ({ label: t(ct.labelKey), value: ct.id })),
		onCommit: onInsert,
	});
}
