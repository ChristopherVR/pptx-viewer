import type { PptxChartType } from 'pptx-viewer-core';
import { INSERT_CHART_TYPES } from 'pptx-viewer-shared';

import type { Translator } from '../../../../i18n';
import type { DropdownHandle } from '../../../dropdown';
import { makeDropdown } from '../../../dropdown';

/**
 * Insert > Chart dropdown: one entry per chart type the shared
 * `insert-chart.ts` module supports. Selecting an entry inserts immediately
 * (no separate "insert" step), matching the field/action-button dropdowns.
 */
export function createChartDropdown(
	doc: Document,
	t: Translator,
	onSelect: (chartType: PptxChartType) => void,
): DropdownHandle<PptxChartType> {
	return makeDropdown<PptxChartType>(doc, {
		triggerLabel: t('pptx.ribbon.insertChart'),
		triggerText: t('pptx.ribbon.chart'),
		items: INSERT_CHART_TYPES.map((ct) => ({ label: ct.label, value: ct.type })),
		onSelect,
	});
}
