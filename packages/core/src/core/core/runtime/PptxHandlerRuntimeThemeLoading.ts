import { XmlObject } from '../../types';
import type {
	PptxTheme,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
	PptxThemeFormatScheme,
	PptxThemeOption,
} from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeThemeRefResolution';

export function isPresentationThemePartPath(path: string): boolean {
	return /^ppt\/theme\/(?!themeOverride)[^/]+\.xml$/iu.test(path);
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected async resolvePrimaryThemePath(): Promise<string | undefined> {
		const masterFiles = this.zip.file(/^ppt\/slideMasters\/slideMaster\d+\.xml$/);
		if (!masterFiles || masterFiles.length === 0) {
			return undefined;
		}
		const masterPath = masterFiles[0].name;
		const relsPath = masterPath.replace(
			/ppt\/slideMasters\/(slideMaster\d+)\.xml/,
			'ppt/slideMasters/_rels/$1.xml.rels',
		);
		const relsXml = this.zip.file(relsPath);
		if (!relsXml) {
			return undefined;
		}
		const relsData = this.parser.parse(
			// eslint-disable-next-line no-await-in-loop
			await relsXml.async('string'),
		) as XmlObject;
		const relNodes = this.ensureArray(
			(relsData?.Relationships as XmlObject | undefined)?.Relationship,
		) as XmlObject[];
		for (const rel of relNodes) {
			const target = String(rel['@_Target'] || '');
			if (!target.includes('theme')) {
				continue;
			}
			const themePath = target.startsWith('..')
				? this.resolvePath(masterPath.substring(0, masterPath.lastIndexOf('/') + 1), target)
				: target.startsWith('/')
					? target.slice(1)
					: `ppt/${target.replace(/^\.?\//, '')}`;
			if (themePath.startsWith('ppt/theme/')) {
				return themePath;
			}
		}
		return undefined;
	}

	protected async parseThemeOptions(): Promise<PptxThemeOption[]> {
		const themeFiles = Object.values(this.zip.files).filter(
			(file) => !file.dir && isPresentationThemePartPath(file.name),
		);
		if (!themeFiles || themeFiles.length === 0) {
			return [];
		}
		const options: PptxThemeOption[] = [];
		for (const file of themeFiles) {
			try {
				const xml = await file.async('string');
				const data = this.parser.parse(xml) as XmlObject;
				const root = data['a:theme'] as XmlObject | undefined;
				const name = String(root?.['@_name'] || '').trim();
				options.push({
					path: file.name,
					name: name.length > 0 ? name : undefined,
				});
			} catch {
				options.push({ path: file.name });
			}
		}
		return options;
	}

	/**
	 * Public API — scan the in-memory ZIP for `ppt/theme/theme*.xml` parts
	 * and return their paths and display names.  Delegates to the
	 * protected {@link parseThemeOptions}.
	 */
	public async getAvailableThemes(): Promise<PptxThemeOption[]> {
		return this.parseThemeOptions();
	}

	/**
	 * Build a structured PptxTheme object from the already-parsed
	 * themeColorMap and themeFontMap for consumption by renderers / UI.
	 */
	protected buildThemeObject(): PptxTheme | undefined {
		const hasColors = Object.keys(this.themeColorMap).length > 0;
		const hasFonts = Object.keys(this.themeFontMap).length > 0;
		if (!hasColors && !hasFonts) {
			return undefined;
		}

		let colorScheme: PptxThemeColorScheme | undefined;
		if (hasColors) {
			colorScheme = {
				dk1: this.themeColorMap['dk1'] || '',
				lt1: this.themeColorMap['lt1'] || '',
				dk2: this.themeColorMap['dk2'] || '',
				lt2: this.themeColorMap['lt2'] || '',
				accent1: this.themeColorMap['accent1'] || '',
				accent2: this.themeColorMap['accent2'] || '',
				accent3: this.themeColorMap['accent3'] || '',
				accent4: this.themeColorMap['accent4'] || '',
				accent5: this.themeColorMap['accent5'] || '',
				accent6: this.themeColorMap['accent6'] || '',
				hlink: this.themeColorMap['hlink'] || '',
				folHlink: this.themeColorMap['folHlink'] || '',
			};
		}

		let fontScheme: PptxThemeFontScheme | undefined;
		if (hasFonts) {
			// #83: surface the parsed per-script overrides (`<a:font script=...>`)
			// on the theme object so font resolution can consult them. The maps
			// are keyed by theme path; aggregate across every parsed theme (a
			// single-master deck has one entry) into one script -> face lookup.
			const majorByScript = this.aggregateFontScriptOverrides(this.masterThemeMajorFontScripts);
			const minorByScript = this.aggregateFontScriptOverrides(this.masterThemeMinorFontScripts);
			fontScheme = {
				majorFont: {
					latin: this.themeFontMap['mj-lt'],
					eastAsia: this.themeFontMap['mj-ea'],
					complexScript: this.themeFontMap['mj-cs'],
					...(Object.keys(majorByScript).length > 0 ? { byScript: majorByScript } : {}),
				},
				minorFont: {
					latin: this.themeFontMap['mn-lt'],
					eastAsia: this.themeFontMap['mn-ea'],
					complexScript: this.themeFontMap['mn-cs'],
					...(Object.keys(minorByScript).length > 0 ? { byScript: minorByScript } : {}),
				},
			};
		}

		return {
			colorScheme,
			fontScheme,
			formatScheme: this.themeFormatScheme,
		};
	}

	/**
	 * Parse every slide master's `<p:clrMap>` element and store the alias
	 * dictionaries on {@link masterClrMaps}. Do *not* mutate
	 * {@link themeColorMap} — alias resolution happens at colour-lookup
	 * time so that:
	 *
	 * 1. The raw theme scheme stays the source of truth (clrMap is a
	 *    routing layer, not a colour table).
	 * 2. Multi-master decks resolve each slide against its own master's
	 *    clrMap rather than always against `masterFiles[0]`.
	 * 3. Layout `clrMapOvr` semantics work correctly when a slide's master
	 *    differs from the deck's first master.
	 *
	 * Phase 2 Stream B / C-H4.
	 */
	protected async applySlideMasterColorMap(_defaultMap: Record<string, string>): Promise<void> {
		const masterFiles = this.zip.file(/^ppt\/slideMasters\/slideMaster\d+\.xml$/);
		if (!masterFiles || masterFiles.length === 0) {
			return;
		}

		const aliasKeys = [
			'bg1',
			'tx1',
			'bg2',
			'tx2',
			'accent1',
			'accent2',
			'accent3',
			'accent4',
			'accent5',
			'accent6',
			'hlink',
			'folHlink',
		];

		for (const file of masterFiles) {
			try {
				// eslint-disable-next-line no-await-in-loop
				const masterXml = await file.async('string');
				const masterData = this.parser.parse(masterXml) as XmlObject;
				const clrMap = (masterData?.['p:sldMaster'] as XmlObject | undefined)?.['p:clrMap'] as
					| XmlObject
					| undefined;
				if (!clrMap) {
					continue;
				}

				const aliasMap: Record<string, string> = {};
				for (const aliasKey of aliasKeys) {
					const mappedKey = String(clrMap[`@_${aliasKey}`] || '')
						.trim()
						.toLowerCase();
					if (mappedKey) {
						aliasMap[aliasKey] = mappedKey;
					}
				}
				if (Object.keys(aliasMap).length > 0) {
					this.masterClrMaps.set(file.name, aliasMap);
				}
			} catch (error) {
				console.warn(`Failed to parse slide master color map for ${file.name}:`, error);
			}
		}
	}

	/**
	 * Parse a single theme part into structured colour, font, and format
	 * scheme dictionaries. Used both for the global default theme and for
	 * each master's per-master theme (multi-master support).
	 *
	 * Phase 2 Stream B / C-H4.
	 */
	protected async parseThemePart(themePath: string): Promise<{
		colorMap: Record<string, string>;
		fontMap: Record<string, string>;
		formatScheme: PptxThemeFormatScheme | undefined;
	} | null> {
		const themeFile = this.zip.file(themePath);
		if (!themeFile) {
			return null;
		}
		const themeXml = await themeFile.async('string');
		// Capture original XML for byte-stable passthrough on save (C-H3).
		this.originalThemeXmlByPath.set(themePath, themeXml);

		const themeData = this.parser.parse(themeXml) as XmlObject;
		const themeRoot = themeData['a:theme'] as XmlObject | undefined;
		const themeElements = themeRoot?.['a:themeElements'] as XmlObject | undefined;
		const colorScheme = themeElements?.['a:clrScheme'] as XmlObject | undefined;
		const fontScheme = themeElements?.['a:fontScheme'] as XmlObject | undefined;
		const fmtScheme = themeElements?.['a:fmtScheme'] as XmlObject | undefined;

		const themeName = String(themeRoot?.['@_name'] || '').trim();
		if (themeName) {
			this.masterThemeNames.set(themePath, themeName);
		}
		const colorSchemeName = String(colorScheme?.['@_name'] || '').trim();
		if (colorSchemeName) {
			this.masterThemeColorSchemeNames.set(themePath, colorSchemeName);
		}
		const fontSchemeName = String(fontScheme?.['@_name'] || '').trim();
		if (fontSchemeName) {
			this.masterThemeFontSchemeNames.set(themePath, fontSchemeName);
		}

		const defaultMap = this.getDefaultSchemeColorMap();
		const colorMap: Record<string, string> = { ...defaultMap };

		if (colorScheme) {
			const schemeKeys = [
				'dk1',
				'lt1',
				'dk2',
				'lt2',
				'accent1',
				'accent2',
				'accent3',
				'accent4',
				'accent5',
				'accent6',
				'hlink',
				'folHlink',
			];
			for (const key of schemeKeys) {
				const colorNode = colorScheme[`a:${key}`] as XmlObject | undefined;
				const parsed = this.parseColorChoice(colorNode);
				if (parsed) {
					colorMap[key] = parsed;
				}
			}
		}

		// Aliases (`tx1`/`bg1`/`tx2`/`bg2`) are resolved LAZILY through the
		// active master's `<p:clrMap>` at colour-lookup time (see
		// `resolveThemeColor`). Eagerly baking them as `tx1 = dk1` etc. here
		// would leak the default mapping even when a master remaps them
		// (e.g. dark themes that swap `bg1 ↔ tx1`). The defaults registered
		// via `getDefaultSchemeColorMap()` provide the final fallback when
		// no master clrMap exists for the slide. Phase 2 Stream B / C-H4.

		const majorFontNode = fontScheme?.['a:majorFont'] as XmlObject | undefined;
		const minorFontNode = fontScheme?.['a:minorFont'] as XmlObject | undefined;
		const majorLatin = majorFontNode?.['a:latin'] as XmlObject | undefined;
		const minorLatin = minorFontNode?.['a:latin'] as XmlObject | undefined;

		const majorFont = this.normalizeTypefaceToken(String(majorLatin?.['@_typeface'] || ''));
		const minorFont = this.normalizeTypefaceToken(String(minorLatin?.['@_typeface'] || ''));

		const fontMap: Record<string, string> = {};
		if (majorFont) {
			fontMap['mj-lt'] = majorFont;
			fontMap['mj-ea'] = majorFont;
			fontMap['mj-cs'] = majorFont;
		}
		if (minorFont) {
			fontMap['mn-lt'] = minorFont;
			fontMap['mn-ea'] = minorFont;
			fontMap['mn-cs'] = minorFont;
		}

		// Capture EA / CS font when explicitly specified; only override when
		// the typeface is non-empty (the common Office layout has empty
		// `typeface=""` placeholders we should not stomp the latin fallback).
		const majorEa = this.normalizeTypefaceToken(
			String((majorFontNode?.['a:ea'] as XmlObject | undefined)?.['@_typeface'] || ''),
		);
		if (majorEa) {
			fontMap['mj-ea'] = majorEa;
		}
		const majorCs = this.normalizeTypefaceToken(
			String((majorFontNode?.['a:cs'] as XmlObject | undefined)?.['@_typeface'] || ''),
		);
		if (majorCs) {
			fontMap['mj-cs'] = majorCs;
		}
		const minorEa = this.normalizeTypefaceToken(
			String((minorFontNode?.['a:ea'] as XmlObject | undefined)?.['@_typeface'] || ''),
		);
		if (minorEa) {
			fontMap['mn-ea'] = minorEa;
		}
		const minorCs = this.normalizeTypefaceToken(
			String((minorFontNode?.['a:cs'] as XmlObject | undefined)?.['@_typeface'] || ''),
		);
		if (minorCs) {
			fontMap['mn-cs'] = minorCs;
		}

		// Per-script fonts (`<a:font script="Hans|Hant|Arab|…">`) — M4.
		const majorScripts = this.collectFontScriptOverrides(majorFontNode);
		if (Object.keys(majorScripts).length > 0) {
			this.masterThemeMajorFontScripts.set(themePath, majorScripts);
		}
		const minorScripts = this.collectFontScriptOverrides(minorFontNode);
		if (Object.keys(minorScripts).length > 0) {
			this.masterThemeMinorFontScripts.set(themePath, minorScripts);
		}

		// objectDefaults — M5.
		const objectDefaultsNode = themeRoot?.['a:objectDefaults'] as XmlObject | undefined;
		if (objectDefaultsNode) {
			const od = {
				spDef: objectDefaultsNode['a:spDef'] as unknown,
				lnDef: objectDefaultsNode['a:lnDef'] as unknown,
				txDef: objectDefaultsNode['a:txDef'] as unknown,
			};
			if (od.spDef !== undefined || od.lnDef !== undefined || od.txDef !== undefined) {
				this.masterThemeObjectDefaults.set(themePath, od);
			}
		}

		// extraClrSchemeLst, custClrLst, theme-level extLst.
		const extraClrSchemeLst = themeRoot?.['a:extraClrSchemeLst'] as unknown;
		if (extraClrSchemeLst !== undefined) {
			this.masterThemeExtraClrSchemeLst.set(themePath, extraClrSchemeLst);
		}
		const custClrLst = themeRoot?.['a:custClrLst'] as unknown;
		if (custClrLst !== undefined) {
			this.masterThemeCustClrLst.set(themePath, custClrLst);
		}
		const themeExtLst = themeRoot?.['a:extLst'] as unknown;
		if (themeExtLst !== undefined) {
			this.masterThemeExtLst.set(themePath, themeExtLst);
		}

		const formatScheme = fmtScheme ? this.parseFormatScheme(fmtScheme) : undefined;
		return { colorMap, fontMap, formatScheme };
	}

	/**
	 * Parse `<a:font script="…" typeface="…"/>` children of a major or
	 * minor font node into a `script -> typeface` dictionary.
	 *
	 * fast-xml-parser collapses repeated tags into arrays, so iterate
	 * over the array form regardless of how many siblings are present.
	 *
	 * Phase 4 Stream A / M4.
	 */
	/**
	 * Flatten a per-theme-path script-override map (`themePath -> {script ->
	 * typeface}`) into a single `{script -> typeface}` lookup for
	 * {@link buildThemeObject}. Earlier entries win on collision, which matches
	 * the primary-theme-first parse order. Phase 4 Stream A / M4 (#83).
	 */
	protected aggregateFontScriptOverrides(
		perPathMap: Map<string, Record<string, string>>,
	): Record<string, string> {
		const aggregate: Record<string, string> = {};
		for (const overrides of perPathMap.values()) {
			for (const [script, typeface] of Object.entries(overrides)) {
				if (!(script in aggregate)) {
					aggregate[script] = typeface;
				}
			}
		}
		return aggregate;
	}

	protected collectFontScriptOverrides(fontNode: XmlObject | undefined): Record<string, string> {
		const overrides: Record<string, string> = {};
		if (!fontNode) {
			return overrides;
		}
		const fontEntries = this.ensureArray(fontNode['a:font']) as XmlObject[];
		for (const entry of fontEntries) {
			const script = String(entry?.['@_script'] || '').trim();
			const typeface = this.normalizeTypefaceToken(String(entry?.['@_typeface'] || ''));
			if (script && typeface) {
				overrides[script] = typeface;
			}
		}
		return overrides;
	}

	/**
	 * Resolve the theme file path referenced by a given master's `.rels`.
	 * Returns `undefined` when the master has no theme relationship.
	 */
	protected async resolveThemePathForMaster(masterPath: string): Promise<string | undefined> {
		const relsPath = masterPath.replace(
			/ppt\/slideMasters\/(slideMaster\d+)\.xml/,
			'ppt/slideMasters/_rels/$1.xml.rels',
		);
		const relsXml = this.zip.file(relsPath);
		if (!relsXml) {
			return undefined;
		}
		const relsData = this.parser.parse(await relsXml.async('string')) as XmlObject;
		const relNodes = this.ensureArray(
			(relsData?.Relationships as XmlObject | undefined)?.Relationship,
		) as XmlObject[];
		for (const rel of relNodes) {
			const target = String(rel['@_Target'] || '');
			if (!target.includes('theme')) {
				continue;
			}
			const themePath = target.startsWith('..')
				? this.resolvePath(masterPath.substring(0, masterPath.lastIndexOf('/') + 1), target)
				: target.startsWith('/')
					? target.slice(1)
					: `ppt/${target.replace(/^\.?\//, '')}`;
			if (themePath.startsWith('ppt/theme/')) {
				return themePath;
			}
		}
		return undefined;
	}

	/**
	 * Populate {@link masterThemeColorMaps}, {@link masterThemeFontMaps},
	 * and {@link masterThemeFormatSchemes} for every slide master in the
	 * deck. Multi-master support — Phase 2 Stream B / C-H4.
	 */
	protected async loadPerMasterThemes(): Promise<void> {
		const masterFiles = this.zip.file(/^ppt\/slideMasters\/slideMaster\d+\.xml$/);
		if (!masterFiles || masterFiles.length === 0) {
			return;
		}
		for (const file of masterFiles) {
			try {
				// eslint-disable-next-line no-await-in-loop
				const themePath = await this.resolveThemePathForMaster(file.name);
				if (!themePath) {
					continue;
				}
				this.masterThemePaths.set(file.name, themePath);
				// eslint-disable-next-line no-await-in-loop
				const parsed = await this.parseThemePart(themePath);
				if (!parsed) {
					continue;
				}
				this.masterThemeColorMaps.set(file.name, parsed.colorMap);
				this.masterThemeFontMaps.set(file.name, parsed.fontMap);
				if (parsed.formatScheme) {
					this.masterThemeFormatSchemes.set(file.name, parsed.formatScheme);
				}
			} catch (error) {
				console.warn(`Failed to load per-master theme for ${file.name}:`, error);
			}
		}
	}

	protected async loadThemeData(): Promise<void> {
		const themeFiles = this.zip.file(/^ppt\/theme\/theme\d+\.xml$/);
		if (!themeFiles || themeFiles.length === 0) {
			return;
		}

		const preferredThemePath = await this.resolvePrimaryThemePath();
		const themeFile = preferredThemePath
			? (themeFiles.find((file) => file.name === preferredThemePath) ?? themeFiles[0])
			: themeFiles[0];

		const parsed = await this.parseThemePart(themeFile.name);
		if (parsed) {
			this.themeColorMap = parsed.colorMap;
			this.themeFontMap = parsed.fontMap;
			if (parsed.formatScheme) {
				this.themeFormatScheme = parsed.formatScheme;
			}
		}
		// Parse master clrMaps and per-master themes. These layer on top of
		// {@link themeColorMap} during slide rendering rather than mutating it.
		await this.applySlideMasterColorMap(this.getDefaultSchemeColorMap());
		await this.loadPerMasterThemes();

		// Snapshot the post-load global theme so per-slide master switching
		// can restore it when a slide has no per-master entry. Phase 2
		// Stream B / C-H4.
		this.globalThemeColorMapSnapshot = { ...this.themeColorMap };
		this.globalThemeFontMapSnapshot = { ...this.themeFontMap };
		this.globalThemeFormatSchemeSnapshot = this.themeFormatScheme;
	}
}
