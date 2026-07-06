import { z } from 'zod';

export const UpdateChartSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('Chart element ID'),
	chartType: z
		.string()
		.optional()
		.describe('New chart type (bar, line, pie, scatter, area, doughnut, radar)'),
	title: z.string().optional().describe('Chart title'),
	grouping: z
		.enum(['clustered', 'stacked', 'percentStacked'])
		.optional()
		.describe('Bar/column grouping'),
	legend: z
		.object({
			show: z.boolean().optional(),
			position: z.string().optional().describe('Legend position: b, t, l, r, tr'),
		})
		.optional()
		.describe('Legend configuration'),
	dataLabels: z
		.object({
			show: z.boolean().optional(),
			showValue: z.boolean().optional(),
			showCategory: z.boolean().optional(),
			showSeriesName: z.boolean().optional(),
			showPercent: z.boolean().optional(),
		})
		.optional()
		.describe('Data label configuration'),
	axis: z
		.object({
			type: z.string().describe('Axis type: valAx, catAx, dateAx, serAx'),
			edit: z.object({
				min: z.number().nullable().optional(),
				max: z.number().nullable().optional(),
				majorUnit: z.number().nullable().optional(),
				title: z.string().nullable().optional(),
				numberFormat: z.string().optional(),
				majorGridlines: z.boolean().optional(),
				minorGridlines: z.boolean().optional(),
			}),
		})
		.optional()
		.describe('Axis configuration'),
	categories: z.array(z.string()).optional().describe('Category axis labels'),
});

export const AddChartSeriesSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('Chart element ID'),
	name: z.string().describe('Series name'),
	values: z.array(z.number()).describe('Data values'),
	color: z.string().optional().describe('Series color (hex)'),
});

export const RemoveChartSeriesSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('Chart element ID'),
	seriesIndex: z.number().int().min(0).describe('Zero-based series index to remove'),
});

export const UpdateChartSeriesDataSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('Chart element ID'),
	seriesIndex: z.number().int().min(0).describe('Zero-based series index'),
	values: z.array(z.number()).describe('New data values'),
});

export const CreateChartSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	chartType: z.string().describe('Chart type (bar, line, pie, scatter, area, doughnut, radar)'),
	x: z.number().optional().describe('X position in points'),
	y: z.number().optional().describe('Y position in points'),
	width: z.number().optional().describe('Width in points'),
	height: z.number().optional().describe('Height in points'),
	title: z.string().optional().describe('Chart title'),
	categories: z.array(z.string()).optional().describe('Category labels'),
	series: z
		.array(
			z.object({
				name: z.string(),
				values: z.array(z.number()),
				color: z.string().optional(),
			}),
		)
		.optional()
		.describe('Data series'),
	legend: z
		.object({
			show: z.boolean(),
			position: z.string().optional(),
		})
		.optional()
		.describe('Legend configuration'),
});
