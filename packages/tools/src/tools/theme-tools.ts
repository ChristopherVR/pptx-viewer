import type {
	PptxThemeColorScheme,
	PptxThemeFontScheme,
	PptxTheme,
	ThemePresetName,
} from 'pptx-viewer-core';
import { getThemePreset, ThemePresets } from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';

// ── getThemeInfo ─────────────────────────────────────────────────────────────

export interface ThemeInfo {
	themeName?: string;
	colorScheme?: PptxThemeColorScheme;
	fontScheme?: PptxThemeFontScheme;
	availablePresets: string[];
}

export function getThemeInfo(ctx: ToolContext): ToolResult<ThemeInfo> {
	const theme = ctx.pptxData.theme;
	return {
		pptxData: ctx.pptxData,
		dirty: false,
		result: {
			themeName: theme?.name,
			colorScheme: theme?.colorScheme,
			fontScheme: theme?.fontScheme,
			availablePresets: Object.keys(ThemePresets),
		},
	};
}

// ── applyThemePreset ─────────────────────────────────────────────────────────

export interface ApplyThemePresetParams {
	presetName: string;
}

export interface ApplyThemePresetResult {
	appliedPreset: string;
	colorScheme: PptxThemeColorScheme;
}

export function applyThemePreset(
	ctx: ToolContext,
	params: ApplyThemePresetParams,
): ToolResult<ApplyThemePresetResult> {
	const preset = getThemePreset(params.presetName as ThemePresetName);
	if (!preset) {
		throw new Error(
			`Unknown theme preset: "${params.presetName}". Available: ${Object.keys(ThemePresets).join(', ')}`,
		);
	}

	if (!ctx.pptxData.theme) {
		(ctx.pptxData as unknown as { theme: PptxTheme }).theme = {};
	}
	const theme = ctx.pptxData.theme!;
	theme.name = preset.name;
	theme.colorScheme = preset.colors as unknown as PptxThemeColorScheme;
	if (preset.fonts) {
		theme.fontScheme = preset.fonts as unknown as PptxThemeFontScheme;
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: {
			appliedPreset: params.presetName,
			colorScheme: theme.colorScheme!,
		},
	};
}

// ── updateThemeColors ────────────────────────────────────────────────────────

export interface UpdateThemeColorsParams {
	dk1?: string;
	lt1?: string;
	dk2?: string;
	lt2?: string;
	accent1?: string;
	accent2?: string;
	accent3?: string;
	accent4?: string;
	accent5?: string;
	accent6?: string;
	hlink?: string;
	folHlink?: string;
}

export function updateThemeColors(
	ctx: ToolContext,
	params: UpdateThemeColorsParams,
): ToolResult<{ colorScheme: PptxThemeColorScheme }> {
	if (!ctx.pptxData.theme) {
		(ctx.pptxData as unknown as { theme: PptxTheme }).theme = {};
	}
	const theme = ctx.pptxData.theme!;
	if (!theme.colorScheme) {
		theme.colorScheme = {
			dk1: '#000000',
			lt1: '#FFFFFF',
			dk2: '#44546A',
			lt2: '#E7E6E6',
			accent1: '#4472C4',
			accent2: '#ED7D31',
			accent3: '#A5A5A5',
			accent4: '#FFC000',
			accent5: '#5B9BD5',
			accent6: '#70AD47',
			hlink: '#0563C1',
			folHlink: '#954F72',
		};
	}

	const cs = theme.colorScheme;
	for (const key of Object.keys(params) as (keyof UpdateThemeColorsParams)[]) {
		if (params[key] !== undefined) {
			cs[key] = params[key]!;
		}
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { colorScheme: cs },
	};
}

// ── updateThemeFonts ─────────────────────────────────────────────────────────

export interface UpdateThemeFontsParams {
	majorFont?: string;
	minorFont?: string;
}

export function updateThemeFonts(
	ctx: ToolContext,
	params: UpdateThemeFontsParams,
): ToolResult<{ fontScheme: PptxThemeFontScheme }> {
	if (!ctx.pptxData.theme) {
		(ctx.pptxData as unknown as { theme: PptxTheme }).theme = {};
	}
	const theme = ctx.pptxData.theme!;
	if (!theme.fontScheme) {
		theme.fontScheme = {};
	}

	if (params.majorFont !== undefined) {
		theme.fontScheme.majorFont = { latin: params.majorFont };
	}
	if (params.minorFont !== undefined) {
		theme.fontScheme.minorFont = { latin: params.minorFont };
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { fontScheme: theme.fontScheme },
	};
}
