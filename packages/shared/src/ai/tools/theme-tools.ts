/**
 * Theme tool executors: apply a named preset, or patch individual scheme
 * colours / fonts. Theme edits are not slide mutations, so they route through
 * {@link PptxAiBridge.applyTheme} (a single undoable history entry) rather than
 * the slides-oriented proposal store.
 *
 * Because these apply IMMEDIATELY (not staged), each executor returns a
 * `previous` snapshot of the fields it overwrote plus a human `summary`, so the
 * host can render an inline "Applied: ... (Undo)" confirmation that restores the
 * prior values via {@link PptxAiBridge.applyTheme}.
 */

import { getThemePreset, ThemePresets } from 'pptx-viewer-core';
import type {
	PptxTheme,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
	ThemePresetName,
} from 'pptx-viewer-core';

import type { AiToolContext, AiToolExecutor } from './executor-base';

type ColorKey = keyof PptxThemeColorScheme;

/** Shape returned by every theme executor (drives the inline "Applied" chip). */
export interface ThemeApplyResult {
	applied: true;
	/** Discriminates the confirmation copy. */
	themeEdit: 'preset' | 'colors' | 'fonts';
	/** One-line human summary, e.g. `Applied theme preset "Vermilion"`. */
	summary: string;
	/** Fields to pass back to `applyTheme` to undo this edit. */
	previous: Partial<PptxTheme>;
	/** Preset name, when a preset was applied. */
	appliedPreset?: string;
}

const applyThemePreset: AiToolExecutor = (ctx: AiToolContext, input: unknown): ThemeApplyResult => {
	const p = input as { presetName: string };
	const preset = getThemePreset(p.presetName as ThemePresetName);
	if (!preset) {
		throw new Error(
			`Unknown theme preset "${p.presetName}". Available: ${Object.keys(ThemePresets).join(', ')}`,
		);
	}
	const current = ctx.bridge.getTheme();
	const previous: Partial<PptxTheme> = {};
	if (current?.colorScheme) {
		previous.colorScheme = { ...current.colorScheme };
	}
	if (current?.fontScheme) {
		previous.fontScheme = { ...current.fontScheme };
	}
	const updates: Partial<PptxTheme> = {
		name: preset.name,
		colorScheme: preset.colors as unknown as PptxThemeColorScheme,
	};
	if (preset.fonts) {
		updates.fontScheme = preset.fonts as unknown as PptxThemeFontScheme;
	}
	ctx.bridge.applyTheme(updates);
	return {
		applied: true,
		themeEdit: 'preset',
		summary: `Applied theme preset "${preset.name}"`,
		previous,
		appliedPreset: p.presetName,
	};
};

const updateThemeColors: AiToolExecutor = (
	ctx: AiToolContext,
	input: unknown,
): ThemeApplyResult => {
	const p = input as Partial<Record<ColorKey, string>>;
	const current = ctx.bridge.getTheme()?.colorScheme;
	const colorScheme: PptxThemeColorScheme = { ...(current ?? DEFAULT_SCHEME) };
	const changedKeys: ColorKey[] = [];
	for (const key of Object.keys(p) as ColorKey[]) {
		const value = p[key];
		if (typeof value === 'string') {
			colorScheme[key] = value;
			changedKeys.push(key);
		}
	}
	if (changedKeys.length === 0) {
		throw new Error('No colour fields supplied.');
	}
	ctx.bridge.applyTheme({ colorScheme });
	return {
		applied: true,
		themeEdit: 'colors',
		summary:
			changedKeys.length === 1
				? `Applied theme colour ${changedKeys[0]}`
				: `Applied ${changedKeys.length} theme colours`,
		previous: { colorScheme: { ...(current ?? DEFAULT_SCHEME) } },
	};
};

const updateThemeFonts: AiToolExecutor = (ctx: AiToolContext, input: unknown): ThemeApplyResult => {
	const p = input as { majorFont?: string; minorFont?: string };
	if (!p.majorFont && !p.minorFont) {
		throw new Error('Supply majorFont and/or minorFont.');
	}
	const currentFonts = ctx.bridge.getTheme()?.fontScheme;
	const fontScheme: PptxThemeFontScheme = { ...(currentFonts ?? {}) };
	if (p.majorFont) {
		fontScheme.majorFont = { latin: p.majorFont };
	}
	if (p.minorFont) {
		fontScheme.minorFont = { latin: p.minorFont };
	}
	ctx.bridge.applyTheme({ fontScheme });
	const changed = [p.majorFont && 'heading', p.minorFont && 'body'].filter(Boolean).join(' + ');
	return {
		applied: true,
		themeEdit: 'fonts',
		summary: `Applied theme ${changed} font${changed.includes('+') ? 's' : ''}`,
		previous: { fontScheme: { ...(currentFonts ?? {}) } },
	};
};

const DEFAULT_SCHEME: PptxThemeColorScheme = {
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

/** Theme executors keyed by tool name. */
export const themeExecutors = {
	apply_theme_preset: applyThemePreset,
	update_theme_colors: updateThemeColors,
	update_theme_fonts: updateThemeFonts,
} satisfies Record<string, AiToolExecutor>;
