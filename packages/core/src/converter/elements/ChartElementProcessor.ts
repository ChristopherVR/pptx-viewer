import type {
	ChartPptxElement,
	PptxChartData,
	PptxElement,
} from '../../core';
import type {
	ElementProcessor,
	ElementProcessorContext,
} from './ElementProcessor';

export class ChartElementProcessor implements ElementProcessor {
	public readonly supportedTypes = ['chart'] as const;

	public async process(
		element: PptxElement,
		_ctx: ElementProcessorContext
	): Promise<string | null> {
		if (element.type !== 'chart') return null;
		const chartElement: ChartPptxElement = element;
		const chartData = chartElement.chartData;
		if (!chartData) return '*[Chart: no data]*';

		const output: string[] = [];
		const title = chartData.title?.trim() || 'Untitled Chart';
		const chartType = this.humanizeType(chartData.chartType);
		output.push(`**${title}**`);
		output.push(`*Type: ${chartType}*`);

		if (chartData.categories.length > 0 && chartData.series.length > 0) {
			output.push(
				this.renderDataTable(chartData.categories, chartData.series)
			);
		} else if (chartData.series.length > 0) {
			for (const series of chartData.series) {
				const values = series.values
					.map((value) => String(value))
					.join(', ');
				output.push(`- **${series.name}**: ${values}`);
			}
		}

		if (chartData.grouping) {
			output.push(`*Grouping: ${chartData.grouping}*`);
		}
		if (chartData.style?.legendPosition) {
			output.push(`*Legend: ${chartData.style.legendPosition}*`);
		}
		if (chartData.dataTable) {
			const flags: string[] = [];
			if (chartData.dataTable.showHorzBorder)
				flags.push('horizontal borders');
			if (chartData.dataTable.showVertBorder)
				flags.push('vertical borders');
			if (chartData.dataTable.showOutline) flags.push('outline');
			if (chartData.dataTable.showKeys) flags.push('keys');
			if (flags.length > 0) {
				output.push(`*Data table: ${flags.join(', ')}*`);
			}
		}

		const trendlines = chartData.series.flatMap((series) =>
			(series.trendlines ?? []).map(
				(trendline) => `${series.name} (${trendline.trendlineType})`
			)
		);
		if (trendlines.length > 0) {
			output.push(`*Trendlines: ${trendlines.join(', ')}*`);
		}

		return output.join('\n\n');
	}

	private renderDataTable(
		categories: string[],
		series: PptxChartData['series']
	): string {
		const headers = ['Category', ...series.map((entry) => entry.name)];
		const widths = headers.map((header) => Math.max(3, header.length));

		for (let rowIndex = 0; rowIndex < categories.length; rowIndex += 1) {
			widths[0] = Math.max(widths[0], categories[rowIndex]?.length ?? 0);
			for (
				let seriesIndex = 0;
				seriesIndex < series.length;
				seriesIndex += 1
			) {
				const value = String(
					series[seriesIndex].values[rowIndex] ?? ''
				);
				widths[seriesIndex + 1] = Math.max(
					widths[seriesIndex + 1],
					value.length
				);
			}
		}

		const formatRow = (cells: string[]): string => {
			const padded = cells.map((cell, index) =>
				cell.padEnd(widths[index])
			);
			return `| ${padded.join(' | ')} |`;
		};

		const separator = `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`;
		const rows = categories.map((category, rowIndex) => {
			const row = [
				category,
				...series.map((entry) => String(entry.values[rowIndex] ?? '')),
			];
			return formatRow(row);
		});
		return [formatRow(headers), separator, ...rows].join('\n');
	}

	private humanizeType(value: string): string {
		return value
			.replace(/([a-z])([A-Z0-9])/g, '$1 $2')
			.replace(/^./, (char) => char.toUpperCase());
	}
}
