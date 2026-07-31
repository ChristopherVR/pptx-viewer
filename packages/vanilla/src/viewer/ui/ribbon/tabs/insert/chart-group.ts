import type { PptxChartType } from 'pptx-viewer-core';
import { INSERT_CHART_TYPES } from 'pptx-viewer-shared';

import type { Translator } from '../../../../i18n';
import type { SelectButtonHandle } from '../../../select-button';
import { makeSelectButton } from '../../../select-button';

/**
 * Insert > Chart: a chart-type `<select>` beside an insert button, matching
 * React's Insert section. The type is parked in the select, so inserting
 * several charts of the same kind is one click each.
 */
export function createChartControl(
	doc: Document,
	t: Translator,
	onInsert: (chartType: PptxChartType) => void,
): SelectButtonHandle<PptxChartType> {
	return makeSelectButton<PptxChartType>(doc, {
		selectLabel: t('pptx.ribbon.chartType'),
		buttonLabel: t('pptx.ribbon.chart'),
		buttonTitle: t('pptx.ribbon.insertChart'),
		icon: 'chart',
		items: INSERT_CHART_TYPES.map((ct) => ({ label: ct.label, value: ct.type })),
		onCommit: onInsert,
	});
}
