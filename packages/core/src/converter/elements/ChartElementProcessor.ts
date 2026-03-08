import type {
	ChartPptxElement,
	PptxChartAxisFormatting,
	PptxChartData,
	PptxChartDataLabel,
	PptxChartErrBars,
	PptxChartSeries,
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

		const axisInfo = this.renderAxes(chartData.axes);
		if (axisInfo) {
			output.push(axisInfo);
		}

		const isPie = chartData.chartType === 'pie'
			|| chartData.chartType === 'pie3D'
			|| chartData.chartType === 'doughnut';

		if (chartData.categories.length > 0 && chartData.series.length > 0) {
			output.push(
				this.renderDataTable(
					chartData.categories,
					chartData.series,
					isPie
				)
			);
		} else if (chartData.series.length > 0) {
			for (const series of chartData.series) {
				const values = series.values
					.map((value) => String(value))
					.join(', ');
				output.push(`- **${series.name}**: ${values}`);
			}
		}

		const dataLabels = this.renderDataLabels(chartData.series);
		if (dataLabels) {
			output.push(dataLabels);
		}

		const errBars = this.renderErrorBars(chartData.series);
		if (errBars) {
			output.push(errBars);
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

		if (chartData.externalData?.targetPath) {
			output.push(`*External data: ${chartData.externalData.targetPath}*`);
		}

		return output.join('\n\n');
	}

	private renderAxes(
		axes: PptxChartAxisFormatting[] | undefined
	): string | null {
		if (!axes || axes.length === 0) return null;
		const parts: string[] = [];
		for (const axis of axes) {
			const label = this.humanizeAxisType(axis.axisType);
			const details: string[] = [];
			if (axis.titleText) {
				details.push(`"${axis.titleText}"`);
			}
			if (axis.numFmt?.formatCode) {
				details.push(`format: ${axis.numFmt.formatCode}`);
			}
			if (details.length > 0) {
				parts.push(`${label}: ${details.join(', ')}`);
			}
		}
		if (parts.length === 0) return null;
		return `*Axes: ${parts.join(' | ')}*`;
	}

	private humanizeAxisType(axisType: string): string {
		switch (axisType) {
			case 'catAx': return 'Category';
			case 'valAx': return 'Value';
			case 'dateAx': return 'Date';
			case 'serAx': return 'Series';
			default: return axisType;
		}
	}

	private renderDataLabels(
		series: PptxChartSeries[]
	): string | null {
		const labels: string[] = [];
		for (const s of series) {
			if (!s.dataLabels || s.dataLabels.length === 0) continue;
			for (const dl of s.dataLabels) {
				const desc = this.describeDataLabel(dl, s.name);
				if (desc) labels.push(desc);
			}
		}
		if (labels.length === 0) return null;
		return `*Data labels: ${labels.join('; ')}*`;
	}

	private describeDataLabel(
		dl: PptxChartDataLabel,
		seriesName: string
	): string | null {
		if (dl.text) {
			return `${seriesName}[${dl.idx}]: "${dl.text}"`;
		}
		const flags: string[] = [];
		if (dl.showVal) flags.push('value');
		if (dl.showCatName) flags.push('category');
		if (dl.showSerName) flags.push('series');
		if (dl.showPercent) flags.push('percent');
		if (flags.length === 0) return null;
		return `${seriesName}[${dl.idx}]: ${flags.join('+')}`;
	}

	private renderErrorBars(
		series: PptxChartSeries[]
	): string | null {
		const bars: string[] = [];
		for (const s of series) {
			if (!s.errBars || s.errBars.length === 0) continue;
			for (const eb of s.errBars) {
				bars.push(this.describeErrorBar(eb, s.name));
			}
		}
		if (bars.length === 0) return null;
		return `*Error bars: ${bars.join('; ')}*`;
	}

	private describeErrorBar(
		eb: PptxChartErrBars,
		seriesName: string
	): string {
		const valDesc = eb.val !== undefined
			? ` ${eb.val}`
			: '';
		return `${seriesName} ${eb.direction}-axis ${eb.valType}${valDesc} (${eb.barType})`;
	}

	private renderDataTable(
		categories: string[],
		series: PptxChartData['series'],
		includePctColumn: boolean
	): string {
		const totalForPct = includePctColumn
			? this.computeSeriesTotal(series)
			: 0;
		const showPct = includePctColumn && totalForPct > 0;

		const headers = ['Category', ...series.map((entry) => entry.name)];
		if (showPct) headers.push('%');
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
			if (showPct) {
				const pct = this.computeRowPct(series, rowIndex, totalForPct);
				widths[widths.length - 1] = Math.max(
					widths[widths.length - 1],
					pct.length
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
			if (showPct) {
				row.push(this.computeRowPct(series, rowIndex, totalForPct));
			}
			return formatRow(row);
		});
		return [formatRow(headers), separator, ...rows].join('\n');
	}

	private computeSeriesTotal(series: PptxChartData['series']): number {
		let total = 0;
		for (const s of series) {
			for (const v of s.values) {
				total += Math.abs(v ?? 0);
			}
		}
		return total;
	}

	private computeRowPct(
		series: PptxChartData['series'],
		rowIndex: number,
		total: number
	): string {
		let rowSum = 0;
		for (const s of series) {
			rowSum += Math.abs(s.values[rowIndex] ?? 0);
		}
		if (total === 0) return '0.0%';
		return `${((rowSum / total) * 100).toFixed(1)}%`;
	}

	private humanizeType(value: string): string {
		return value
			.replace(/([a-z])([A-Z0-9])/g, '$1 $2')
			.replace(/^./, (char) => char.toUpperCase());
	}
}
