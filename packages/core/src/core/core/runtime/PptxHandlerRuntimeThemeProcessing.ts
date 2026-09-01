import { XmlObject } from '../../types';
import type { PptxThemeColorScheme, PptxThemeFontScheme } from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeThemeLoading';
import {
	applyColorSchemeToMap,
	applyColorSchemeToThemeXml,
	applyFontSchemeToMap,
	applyFontSchemeToThemeXml,
} from './theme-scheme-edit';

const THEME_PART_PATTERN = /^ppt\/theme\/theme\d+\.xml$/;

/**
 * Theme editing: update colour scheme, font scheme, and name in the zip.
 *
 * A deck may carry one theme part per slide master. Every edit therefore
 * targets ALL theme parts the masters point at (the same set the save
 * pipeline's `persistThemeParts` walks), unless the caller narrows it with an
 * explicit `themePaths` list. The in-memory maps are refreshed alongside:
 * the per-master maps, the deck-wide snapshots, and the currently active
 * `themeColorMap` / `themeFontMap`.
 */
export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * The theme parts an edit should touch, primary theme first.
	 *
	 * Defaults to every theme referenced by a slide master. A deck whose
	 * masters were never resolved (nothing loaded yet, or a bare zip) falls
	 * back to the primary theme part so the legacy single-theme behaviour is
	 * preserved.
	 */
	private async resolveThemeEditTargets(themePaths?: readonly string[]): Promise<string[]> {
		const existing = (path: string): boolean => this.zip.file(path) !== null;
		if (themePaths) {
			return [...new Set(themePaths)].filter(existing);
		}
		const primary = await this.resolvePrimaryThemePath();
		const targets = new Set<string>();
		if (primary && existing(primary)) {
			targets.add(primary);
		}
		for (const themePath of this.masterThemePaths.values()) {
			if (themePath && existing(themePath)) {
				targets.add(themePath);
			}
		}
		if (targets.size === 0) {
			const first = this.zip.file(THEME_PART_PATTERN)[0];
			if (first) {
				targets.add(first.name);
			}
		}
		return [...targets];
	}

	private async readThemePart(path: string): Promise<XmlObject | undefined> {
		const file = this.zip.file(path);
		if (!file) {
			return undefined;
		}
		const xml = await file.async('string');
		return this.parser.parse(xml) as XmlObject;
	}

	/**
	 * Parse, edit, and write back every target theme part. Parts the edit
	 * cannot apply to (no `a:themeElements`) are left untouched.
	 *
	 * @returns the paths that were rewritten
	 */
	private async rewriteThemeParts(
		themePaths: readonly string[] | undefined,
		edit: (data: XmlObject) => boolean,
	): Promise<string[]> {
		const written: string[] = [];
		for (const path of await this.resolveThemeEditTargets(themePaths)) {
			const data = await this.readThemePart(path);
			if (!data || !edit(data)) {
				continue;
			}
			this.zip.file(path, this.builder.build(data));
			written.push(path);
		}
		return written;
	}

	/** Masters whose theme part is among the rewritten paths. */
	private mastersUsingThemes(themePaths: readonly string[]): string[] {
		const targets = new Set(themePaths);
		const masters: string[] = [];
		for (const [masterPath, themePath] of this.masterThemePaths.entries()) {
			if (targets.has(themePath)) {
				masters.push(masterPath);
			}
		}
		return masters;
	}

	/**
	 * Update the theme's colour scheme in-memory and in the zip.
	 *
	 * Refreshes `themeColorMap`, the deck-wide snapshot, and every per-master
	 * colour map whose theme was rewritten. The `tx1` / `bg1` / `tx2` / `bg2`
	 * alias slots are routed through each master's own `p:clrMap` rather than
	 * assuming the default `tx1 = dk1` mapping, so a master that swaps light
	 * and dark keeps its swap after the edit.
	 *
	 * @param themePaths optional explicit theme parts to edit; defaults to
	 *   every theme a slide master references
	 */
	public async updateThemeColorScheme(
		colorScheme: PptxThemeColorScheme,
		themePaths?: readonly string[],
	): Promise<void> {
		const written = await this.rewriteThemeParts(themePaths, (data) =>
			applyColorSchemeToThemeXml(data, colorScheme),
		);
		if (written.length === 0) {
			return;
		}
		for (const masterPath of this.mastersUsingThemes(written)) {
			const map = this.masterThemeColorMaps.get(masterPath);
			if (map) {
				applyColorSchemeToMap(map, colorScheme, this.masterClrMaps.get(masterPath));
			}
		}
		applyColorSchemeToMap(this.globalThemeColorMapSnapshot, colorScheme, null);
		applyColorSchemeToMap(this.themeColorMap, colorScheme, this.currentMasterClrMap);
	}

	/**
	 * Update the theme's font scheme in-memory and in the zip, across every
	 * target theme part and the matching per-master font maps.
	 *
	 * @param themePaths optional explicit theme parts to edit; defaults to
	 *   every theme a slide master references
	 */
	public async updateThemeFontScheme(
		fontScheme: PptxThemeFontScheme,
		themePaths?: readonly string[],
	): Promise<void> {
		const written = await this.rewriteThemeParts(themePaths, (data) =>
			applyFontSchemeToThemeXml(data, fontScheme),
		);
		if (written.length === 0) {
			return;
		}
		for (const masterPath of this.mastersUsingThemes(written)) {
			const map = this.masterThemeFontMaps.get(masterPath);
			if (map) {
				applyFontSchemeToMap(map, fontScheme);
			}
		}
		applyFontSchemeToMap(this.globalThemeFontMapSnapshot, fontScheme);
		applyFontSchemeToMap(this.themeFontMap, fontScheme);
	}

	/**
	 * Update the theme name in the zip, on every target theme part.
	 *
	 * @param themePaths optional explicit theme parts to edit; defaults to
	 *   every theme a slide master references
	 */
	public async updateThemeName(name: string, themePaths?: readonly string[]): Promise<void> {
		await this.rewriteThemeParts(themePaths, (data) => {
			const root = data['a:theme'] as XmlObject | undefined;
			if (!root) {
				return false;
			}
			root['@_name'] = name;
			return true;
		});
	}

	/**
	 * Apply a complete theme (both colors and fonts) to the presentation.
	 * This is a convenience method that combines updateThemeColorScheme
	 * and updateThemeFontScheme.
	 */
	public async applyTheme(
		colorScheme: PptxThemeColorScheme,
		fontScheme: PptxThemeFontScheme,
		themeName?: string,
	): Promise<void> {
		await this.updateThemeColorScheme(colorScheme);
		await this.updateThemeFontScheme(fontScheme);
		if (themeName) {
			await this.updateThemeName(themeName);
		}
	}
}
