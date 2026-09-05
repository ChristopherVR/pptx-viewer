import { z } from 'zod';

const MarkerSymbolSchema = z.enum([
	'circle',
	'dash',
	'diamond',
	'dot',
	'none',
	'picture',
	'plus',
	'square',
	'star',
	'triangle',
	'x',
	'auto',
]);

const DataLabelPositionSchema = z.enum([
	'bestFit',
	'b',
	'ctr',
	'inBase',
	'inEnd',
	'l',
	'outEnd',
	'r',
	't',
]);

export const FormatChartDataPointSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('Chart element ID'),
	seriesIndex: z.number().int().min(0).describe('Zero-based series index'),
	pointIndex: z.number().int().min(0).describe('Zero-based data point (category) index'),
	fillColor: z.string().optional().describe('Fill colour (hex) for this point only'),
	strokeColor: z.string().optional().describe('Outline colour (hex) for this point only'),
	strokeWidth: z.number().optional().describe('Outline width in points'),
	strokeDashStyle: z
		.string()
		.optional()
		.describe('Outline dash style, e.g. solid, dash, dashDot, sysDot'),
	clearStyle: z.boolean().optional().describe('Remove all per-point shape formatting'),
	explosion: z
		.number()
		.nullable()
		.optional()
		.describe('Pie/doughnut slice pull-out distance 0-100; null clears it'),
	marker: z
		.object({
			symbol: MarkerSymbolSchema.optional(),
			size: z.number().optional(),
			fillColor: z.string().optional(),
		})
		.nullable()
		.optional()
		.describe('Per-point marker override (line/scatter/bubble); null clears it'),
});

export const FormatChartDataLabelSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('Chart element ID'),
	seriesIndex: z.number().int().min(0).describe('Zero-based series index'),
	pointIndex: z.number().int().min(0).describe('Zero-based data point (category) index'),
	remove: z.boolean().optional().describe('Remove the per-point label override entirely'),
	showValue: z.boolean().optional(),
	showCategory: z.boolean().optional(),
	showSeriesName: z.boolean().optional(),
	showPercent: z.boolean().optional(),
	showLegendKey: z.boolean().optional(),
	position: DataLabelPositionSchema.optional(),
	text: z.string().optional().describe("Custom label text override; '' clears it"),
	spPr: z
		.object({
			fillColor: z.string().optional(),
			strokeColor: z.string().optional(),
			strokeWidth: z.number().optional(),
			strokeDashStyle: z.string().optional(),
		})
		.nullable()
		.optional()
		.describe("This label's own fill/line formatting; null removes it"),
	txPr: z
		.object({
			fontFamily: z.string().optional(),
			fontSize: z.number().optional(),
			bold: z.boolean().optional(),
			italic: z.boolean().optional(),
			color: z.string().optional(),
		})
		.nullable()
		.optional()
		.describe("This label's own font; null removes it"),
});

export const FormatChartSeriesSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('Chart element ID'),
	seriesIndex: z.number().int().min(0).describe('Zero-based series index'),
	marker: z
		.object({
			symbol: MarkerSymbolSchema.optional(),
			size: z.number().optional(),
			fillColor: z.string().optional(),
			strokeColor: z.string().optional(),
			strokeWidth: z.number().optional(),
			strokeDashStyle: z.string().optional(),
		})
		.nullable()
		.optional()
		.describe('Series marker (line/scatter/bubble/radar); null removes it'),
	trendline: z
		.object({
			trendlineType: z.enum([
				'linear',
				'exponential',
				'logarithmic',
				'polynomial',
				'power',
				'movingAvg',
			]),
			color: z.string().optional(),
			lineWidth: z.number().optional().describe('Trendline width in points'),
			lineDashStyle: z.string().optional(),
			order: z.number().optional().describe('Polynomial order, 2-6'),
			period: z.number().optional().describe('Moving-average period'),
			displayEq: z.boolean().optional(),
			displayRSq: z.boolean().optional(),
		})
		.nullable()
		.optional()
		.describe('Series trendline; null removes it'),
	errorBars: z
		.object({
			direction: z.enum(['x', 'y']),
			barType: z.enum(['both', 'minus', 'plus']),
			valType: z.enum(['cust', 'fixedVal', 'percentage', 'stdDev', 'stdErr']),
			val: z.number().optional(),
			customPlus: z.array(z.number()).optional(),
			customMinus: z.array(z.number()).optional(),
			noEndCap: z.boolean().optional(),
			color: z.string().optional(),
			width: z.number().optional().describe('Error-bar line width in points'),
			dashStyle: z.string().optional(),
		})
		.nullable()
		.optional()
		.describe('Series error bars; null removes them'),
});

export const SetChartHelperLineSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('Chart element ID'),
	line: z.enum(['dropLines', 'hiLowLines']).describe('Which helper line to set'),
	style: z
		.object({
			color: z.string().optional(),
			width: z.number().optional(),
			dashStyle: z.string().optional(),
		})
		.nullable()
		.describe('Line colour/width/dash; {} shows the line with defaults, null removes it'),
});

export const SetChartColorMapOverrideSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('Chart element ID'),
	overrides: z
		.record(z.string(), z.string())
		.nullable()
		.describe(
			'Theme colour role remap (bg1/tx1/bg2/tx2/accent1-6/hlink/folHlink -> role), e.g. { "accent1": "accent2" }; null removes the override',
		),
});
