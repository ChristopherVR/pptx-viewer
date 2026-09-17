import type { ChartPptxElement, PptxElement } from 'pptx-viewer-core';
import {
	applyChartElementToggle,
	applyChartStylePreset,
	buildChartQuickActionsDescriptor,
	CHART_QUICK_ACTION_BUTTON_SIZE,
	hideChartSeries,
	restoreFilteredSeries,
} from 'pptx-viewer-shared';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuFilter, LuPaintbrush, LuPlus } from 'react-icons/lu';

import { CARD, HEADING } from '../inspector/chart-panel-constants';

export interface ChartQuickActionsOverlayProps {
	element: ChartPptxElement;
	canEdit: boolean;
	onUpdateElement: (elementId: string, updates: Partial<PptxElement>) => void;
}

const ICONS: Record<
	'elements' | 'styles' | 'filters',
	React.ComponentType<{ className?: string }>
> = {
	elements: LuPlus,
	styles: LuPaintbrush,
	filters: LuFilter,
};

/**
 * PowerPoint's three floating quick-action icons ("Chart Elements" +,
 * "Chart Styles" paintbrush, "Chart Filters" funnel) shown just outside a
 * selected chart's top-right corner. A stage-level sibling of
 * `SelectionHandleOverlay`, for the same reason: it must not be clipped by
 * the chart's own container.
 *
 * All decision-making (which buttons render, checklist/gallery/filter state)
 * comes from the shared `buildChartQuickActionsDescriptor`
 * (`pptx-viewer-shared`); this component only renders three buttons plus
 * whichever popover is open, and calls the shared mutation functions the
 * descriptor's state was computed from (`applyChartElementToggle`,
 * `hideChartSeries`/`restoreFilteredSeries`, `applyChartStylePreset`). See
 * that module's header for scope notes (Series-only Chart Filters, no
 * trendline/error-bar/up-down-bars checklist rows).
 */
export function ChartQuickActionsOverlay({
	element,
	canEdit,
	onUpdateElement,
}: ChartQuickActionsOverlayProps): React.ReactElement | null {
	const { t } = useTranslation();
	const [open, setOpen] = useState<'elements' | 'styles' | 'filters' | null>(null);
	const hostRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) {
			return;
		}
		const handler = (e: MouseEvent) => {
			if (hostRef.current && !hostRef.current.contains(e.target as Node)) {
				setOpen(null);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [open]);

	const descriptor = buildChartQuickActionsDescriptor({
		isChartSelected: true,
		chartData: element.chartData,
		selectionBox: { x: element.x, y: element.y, width: element.width, height: element.height },
	});
	if (!descriptor || !element.chartData) {
		return null;
	}
	const chartData = element.chartData;

	const commit = (updates: Partial<PptxElement>) => onUpdateElement(element.id, updates);

	return (
		<div
			ref={hostRef}
			data-pptx-chart-quick-actions='true'
			data-export-ignore='true'
			style={{ position: 'absolute', left: 0, top: 0, zIndex: 59 }}
		>
			{descriptor.buttons.map((button) => (
				<React.Fragment key={button.id}>
					<button
						type='button'
						disabled={!canEdit}
						data-testid={`chart-quick-action-${button.id}`}
						aria-label={t(button.labelKey)}
						title={t(button.labelKey)}
						onClick={() => setOpen((prev) => (prev === button.id ? null : button.id))}
						style={{
							position: 'absolute',
							left: button.x,
							top: button.y,
							width: button.size,
							height: button.size,
							scale: 'var(--pptx-handle-inverse-scale, 1)',
							transformOrigin: 'top left',
						}}
						className='flex items-center justify-center rounded bg-popover border border-border shadow-sm hover:bg-accent text-foreground'
					>
						{React.createElement(ICONS[button.id], { className: 'size-3.5' })}
					</button>

					{open === button.id && button.id === 'elements' && (
						<div
							data-testid='chart-quick-elements-popover'
							style={{
								position: 'absolute',
								left: button.x + CHART_QUICK_ACTION_BUTTON_SIZE + 4,
								top: button.y,
								scale: 'var(--pptx-handle-inverse-scale, 1)',
								transformOrigin: 'top left',
							}}
							className={`${CARD} w-44 z-10 shadow-lg`}
						>
							<div className={HEADING}>{t('pptx.chart.quickElements')}</div>
							{descriptor.elements.map((item) => (
								<label key={item.key} className='flex items-center gap-2 cursor-pointer'>
									<input
										type='checkbox'
										disabled={!canEdit}
										checked={item.checked}
										data-testid={`chart-quick-element-${item.key}`}
										onChange={(e) =>
											commit({
												chartData: applyChartElementToggle(chartData, item.key, e.target.checked),
											})
										}
										className='accent-primary'
									/>
									<span className='text-[11px]'>{t(item.labelKey)}</span>
								</label>
							))}
						</div>
					)}

					{open === button.id && button.id === 'styles' && (
						<div
							data-testid='chart-quick-styles-popover'
							style={{
								position: 'absolute',
								left: button.x + CHART_QUICK_ACTION_BUTTON_SIZE + 4,
								top: button.y,
								scale: 'var(--pptx-handle-inverse-scale, 1)',
								transformOrigin: 'top left',
							}}
							className={`${CARD} w-48 z-10 shadow-lg grid grid-cols-3 gap-1.5`}
						>
							{descriptor.styles.presets.map((preset) => (
								<button
									key={preset.id}
									type='button'
									disabled={!canEdit}
									data-testid={`chart-quick-style-${preset.id}`}
									aria-label={t(preset.labelKey)}
									aria-pressed={preset.applied}
									title={t(preset.labelKey)}
									onClick={() => {
										const next = applyChartStylePreset(chartData, preset.id);
										if (next) {
											commit({ chartData: next });
										}
									}}
									className={`flex flex-col rounded overflow-hidden border ${
										preset.applied ? 'border-primary ring-1 ring-primary' : 'border-border'
									}`}
								>
									<span className='flex h-5 w-full'>
										{preset.colors.slice(0, 5).map((c, i) => (
											<span key={i} style={{ backgroundColor: c }} className='flex-1' />
										))}
									</span>
								</button>
							))}
						</div>
					)}

					{open === button.id && button.id === 'filters' && (
						<div
							data-testid='chart-quick-filters-popover'
							style={{
								position: 'absolute',
								left: button.x + CHART_QUICK_ACTION_BUTTON_SIZE + 4,
								top: button.y,
								scale: 'var(--pptx-handle-inverse-scale, 1)',
								transformOrigin: 'top left',
							}}
							className={`${CARD} w-48 z-10 shadow-lg`}
						>
							<div className={HEADING}>{t('pptx.chart.quickFilters')}</div>
							{descriptor.filters.series.map((row) => (
								<label key={row.key} className='flex items-center gap-2 cursor-pointer'>
									<input
										type='checkbox'
										disabled={!canEdit}
										checked={row.visible}
										data-testid={`chart-quick-filter-${row.key}`}
										onChange={() => {
											const next =
												row.seriesIndex !== undefined
													? hideChartSeries(chartData, row.seriesIndex)
													: restoreFilteredSeries(chartData, row.filteredIndex!);
											if (next) {
												commit({ chartData: next });
											}
										}}
										className='accent-primary'
									/>
									<span className='text-[11px] truncate'>{row.name}</span>
								</label>
							))}
						</div>
					)}
				</React.Fragment>
			))}
		</div>
	);
}
