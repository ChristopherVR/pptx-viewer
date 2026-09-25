/**
 * PowerPoint's Chart Design > Quick Layout presets for a column / bar chart.
 *
 * Ground truth: `scripts/capture-data-galleries-com.ps1` calls
 * `Chart.ApplyLayout(1..11)` on a 4-series clustered column chart and reads
 * back HasTitle, HasLegend + Legend.Position, HasDataTable (+ ShowLegendKey),
 * series 1's data labels (ShowValue, Position = xlLabelPositionOutsideEnd),
 * each axis' HasTitle / HasMajorGridlines / HasMinorGridlines, HasAxis and the
 * chart group's GapWidth / Overlap. The table below is that read-back.
 *
 * @module render/ribbon-galleries/chart-quick-layout-catalog
 */
import type { ChartLayoutSketch } from './chart-gallery-tiles';

export interface ChartQuickLayout extends ChartLayoutSketch {
	/** 1-based `Chart.ApplyLayout` number. */
	n: number;
	/** `c:barChart/c:gapWidth` / `c:overlap` PowerPoint sets for bar/column charts. */
	gapWidth: number;
	overlap: number;
}

const L = (
	n: number,
	flags: Partial<ChartLayoutSketch>,
	gapWidth: number,
	overlap: number,
): ChartQuickLayout => ({
	n,
	title: false,
	legend: null,
	dataLabels: false,
	catAxisTitle: false,
	valAxisTitle: false,
	majorGridlines: false,
	minorGridlines: false,
	valueAxis: true,
	dataTable: false,
	...flags,
	gapWidth,
	overlap,
});

export const CHART_QUICK_LAYOUTS: readonly ChartQuickLayout[] = [
	L(1, { title: true, legend: 'r', majorGridlines: true }, 150, 0),
	L(2, { title: true, legend: 't', dataLabels: true, valueAxis: false }, 150, -25),
	L(3, { title: true, legend: 'b', majorGridlines: true }, 75, -25),
	L(4, { legend: 'b', dataLabels: true }, 75, 0),
	L(5, { title: true, dataTable: true, valAxisTitle: true, majorGridlines: true }, 150, 0),
	L(6, { title: true, valAxisTitle: true, majorGridlines: true }, 150, 0),
	L(
		7,
		{
			legend: 'r',
			catAxisTitle: true,
			valAxisTitle: true,
			majorGridlines: true,
			minorGridlines: true,
		},
		300,
		0,
	),
	L(8, { title: true, catAxisTitle: true, valAxisTitle: true }, 0, 0),
	L(
		9,
		{ title: true, legend: 'r', catAxisTitle: true, valAxisTitle: true, majorGridlines: true },
		150,
		0,
	),
	L(10, { title: true, legend: 'r', majorGridlines: true }, 75, 40),
	L(11, { legend: 'r', majorGridlines: true }, 150, 0),
];
