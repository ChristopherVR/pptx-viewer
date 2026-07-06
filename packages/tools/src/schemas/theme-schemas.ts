import { z } from 'zod';

export const GetThemeInfoSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
});

export const ApplyThemePresetSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	presetName: z
		.string()
		.describe(
			'Theme preset name (e.g. "OFFICE", "MODERN_BLUE", "EARTH", "MONOCHROME", "VIBRANT", "CORPORATE", "MINIMAL", "DARK")',
		),
});

export const UpdateThemeColorsSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	dk1: z.string().optional().describe('Dark 1 color (hex)'),
	lt1: z.string().optional().describe('Light 1 color (hex)'),
	dk2: z.string().optional().describe('Dark 2 color (hex)'),
	lt2: z.string().optional().describe('Light 2 color (hex)'),
	accent1: z.string().optional().describe('Accent 1 color (hex)'),
	accent2: z.string().optional().describe('Accent 2 color (hex)'),
	accent3: z.string().optional().describe('Accent 3 color (hex)'),
	accent4: z.string().optional().describe('Accent 4 color (hex)'),
	accent5: z.string().optional().describe('Accent 5 color (hex)'),
	accent6: z.string().optional().describe('Accent 6 color (hex)'),
	hlink: z.string().optional().describe('Hyperlink color (hex)'),
	folHlink: z.string().optional().describe('Followed hyperlink color (hex)'),
});

export const UpdateThemeFontsSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	majorFont: z.string().optional().describe('Heading (major) font family'),
	minorFont: z.string().optional().describe('Body (minor) font family'),
});
