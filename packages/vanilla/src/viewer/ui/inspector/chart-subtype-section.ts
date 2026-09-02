/**
 * chart-subtype-section.ts: the three chart-family-specific subtype pickers
 * (bar3D column/bar shape, radar style, surface wireframe) that sit beside
 * the gridlines toggle and secondary-axis control in the vanilla chart
 * inspector.
 *
 * Each control is shown only when the loaded chart's family matches, and its
 * options and the patch it applies both come from the shared
 * `chart-subtype-options` module (CLAUDE.md Rule 2: shared decides, this file
 * only maps the descriptor onto a `<select>`).
 */
import type { PptxBar3DShape, PptxChartData } from 'pptx-viewer-core';
import {
	BAR3D_SHAPE_OPTIONS,
	bar3DShapePatch,
	RADAR_STYLE_OPTIONS,
	radarStylePatch,
	SURFACE_WIREFRAME_OPTIONS,
	surfaceWireframePatch,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { optionSelect } from './chart-exhaustive-controls';

export interface ChartSubtypeSection {
	el: HTMLElement;
	update(data: PptxChartData): void;
}

export function createChartSubtypeSection(
	doc: Document,
	t: Translator,
	onChange: (data: PptxChartData) => void,
): ChartSubtypeSection {
	const el = doc.createElement('div');
	el.className = 'pptxv-chart-subtype';
	const bar3DShape = optionSelect(doc, t('pptx.chart.bar3DShapeLabel'), BAR3D_SHAPE_OPTIONS, t);
	bar3DShape.control.dataset.testid = 'pptx-chart-bar3d-shape';
	const radarStyle = optionSelect(doc, t('pptx.chart.radarStyleLabel'), RADAR_STYLE_OPTIONS, t);
	radarStyle.control.dataset.testid = 'pptx-chart-radar-style';
	const surfaceWireframe = optionSelect(
		doc,
		t('pptx.chart.surfaceWireframeLabel'),
		SURFACE_WIREFRAME_OPTIONS,
		t,
	);
	surfaceWireframe.control.dataset.testid = 'pptx-chart-surface-wireframe';
	el.append(bar3DShape.label, radarStyle.label, surfaceWireframe.label);

	let current: PptxChartData | undefined;
	bar3DShape.control.addEventListener('change', () => {
		if (!current) {
			return;
		}
		onChange({
			...current,
			...bar3DShapePatch(current, bar3DShape.control.value as PptxBar3DShape),
		});
	});
	radarStyle.control.addEventListener('change', () => {
		if (!current) {
			return;
		}
		onChange({
			...current,
			...radarStylePatch(
				current,
				radarStyle.control.value as NonNullable<PptxChartData['radarStyle']>,
			),
		});
	});
	surfaceWireframe.control.addEventListener('change', () => {
		if (!current) {
			return;
		}
		onChange({
			...current,
			...surfaceWireframePatch(current, surfaceWireframe.control.value === 'true'),
		});
	});

	const sync = (data: PptxChartData): void => {
		current = data;
		bar3DShape.label.hidden = data.chartType !== 'bar3D';
		radarStyle.label.hidden = data.chartType !== 'radar';
		surfaceWireframe.label.hidden = data.chartType !== 'surface';
		bar3DShape.control.value = data.barShape ?? 'box';
		radarStyle.control.value = data.radarStyle ?? 'standard';
		surfaceWireframe.control.value = data.wireframe ? 'true' : 'false';
	};
	return { el, update: sync };
}
