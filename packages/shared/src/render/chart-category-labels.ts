import type { PptxChartAxisFormatting } from 'pptx-viewer-core';

import { chartAxisTextStyle } from './chart-axis-style';
import { categoryX } from './chart-category-position';
import { DEFAULT_CHART_TEXT_PX, chartFontPx } from './chart-font';
import type { PlotLayout, SvgText } from './chart-view-model';

interface LabelGroup {
	text: string;
	start: number;
	end: number;
}

function groupedLabels(values: ReadonlyArray<string>): LabelGroup[] {
	const groups: LabelGroup[] = [];
	values.forEach((text, index) => {
		const previous = groups[groups.length - 1];
		if (previous?.text === text) {
			previous.end = index;
		} else {
			groups.push({ text, start: index, end: index });
		}
	});
	return groups;
}

/** Build leaf and grouped parent category labels in separate axis bands. */
export function buildMultiLevelCategoryLabels(
	categoryLabels: ReadonlyArray<string>,
	categoryLevels: ReadonlyArray<ReadonlyArray<string>> | undefined,
	sourceIndices: ReadonlyArray<number>,
	layout: PlotLayout,
	spacing: 'bar' | 'line',
	axis: PptxChartAxisFormatting | undefined,
	labelY: number,
	labelsAbove: boolean,
	offset: number,
): SvgText[] {
	const sourceLevels = categoryLevels?.length ? categoryLevels : [categoryLabels];
	const levels = axis?.noMultiLevelLabels ? sourceLevels.slice(0, 1) : sourceLevels;
	const skip = Math.max(1, axis?.tickLabelSkip ?? 1);
	const textAnchor: SvgText['textAnchor'] =
		axis?.labelAlignment === 'l' ? 'start' : axis?.labelAlignment === 'r' ? 'end' : 'middle';
	const direction = labelsAbove ? -1 : 1;
	// Band height tracks the rendered px size (axis.fontSize is parsed in points).
	const fontPx = axis?.fontSize !== undefined ? chartFontPx(axis.fontSize) : DEFAULT_CHART_TEXT_PX;
	const bandHeight = Math.max(fontPx, 8) + 4;
	// `SvgText.y` is the ALPHABETIC BASELINE (this is the one label emitter that
	// does not set `dominant-baseline`), so `offset` - the gap `c:lblOffset` asks
	// for between the axis and its labels - only becomes a real gap once the
	// glyph ascent is added below the axis, or the descent removed above it.
	// Without this the ink of a label under the axis starts ~0.8 em higher than
	// intended and crowds the plot: measured against PowerPoint the gap was 1.2px
	// where it should be 17.6px.
	const baselineShift = labelsAbove ? -0.2 * fontPx : 0.8 * fontPx;
	return levels.flatMap((level, levelIndex) => {
		const values = sourceIndices.map((sourceIndex) => level[sourceIndex] ?? '');
		return groupedLabels(values).flatMap((group) => {
			if (!group.text || group.start % skip !== 0) {
				return [];
			}
			const startX = categoryX(group.start, sourceIndices.length, layout, spacing);
			const endX = categoryX(group.end, sourceIndices.length, layout, spacing);
			return [
				{
					kind: 'text' as const,
					x: (startX + endX) / 2,
					y: labelY + direction * (offset + levelIndex * bandHeight) + baselineShift,
					text: group.text,
					textAnchor,
					...chartAxisTextStyle(axis),
				},
			];
		});
	});
}
