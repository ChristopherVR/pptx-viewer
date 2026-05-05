/**
 * @fileoverview Save-side theme.xml writer.
 *
 * Phase 4 Stream A / C-H3.
 *
 * Round-trip strategy:
 *
 * 1. On parse, the original `theme*.xml` body is captured into
 *    {@link PptxHandlerRuntime#originalThemeXmlByPath}. The full set of
 *    fields a PPTX theme can carry — `bgFillStyleLst`, `fillStyleLst`,
 *    `lnStyleLst`, `effectStyleLst`, `objectDefaults`, `extLst`,
 *    `extraClrSchemeLst`, `custClrLst`, … — is large; the in-memory
 *    model (`themeColorMap`, `themeFontMap`, `themeFormatScheme`) only
 *    captures a subset.
 *
 * 2. On save, if the theme has been marked dirty
 *    ({@link PptxHandlerRuntime#dirtyThemePaths}) — the codec will
 *    regenerate the theme from in-memory state, preserving the
 *    captured raw subtrees for the parts the model doesn't own
 *    (objectDefaults, extraClrSchemeLst, fmtScheme details, …).
 *    Otherwise the original XML is re-emitted verbatim, which guarantees
 *    byte-stable round-trip in the common (no-mutation) case.
 *
 * The writer hooks into `PptxHandlerRuntimeSavePipeline.save` between
 * the master / layout persistence and the presentation persistence.
 */

import { XmlObject } from '../../types';
import type { PptxThemeColorScheme } from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveSlideWriter';

/**
 * Public mutation API for theme state. Marking a theme dirty causes the
 * save pipeline to regenerate the theme part instead of re-emitting the
 * original XML.
 */
export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Mark a theme path as dirty so the save pipeline will regenerate
	 * the theme XML from in-memory state. Optional — without this the
	 * original XML is preserved verbatim on save (C-H3).
	 */
	public markThemeDirty(themePath: string): void {
		this.dirtyThemePaths.add(themePath);
	}

	/**
	 * Mark all known theme paths dirty in one call.
	 */
	public markAllThemesDirty(): void {
		for (const themePath of this.originalThemeXmlByPath.keys()) {
			this.dirtyThemePaths.add(themePath);
		}
		for (const themePath of this.masterThemePaths.values()) {
			this.dirtyThemePaths.add(themePath);
		}
	}

	/**
	 * Persist all theme parts during save. Called from the save pipeline
	 * after master / layout XML have been flushed and before
	 * presentation.xml is serialized.
	 *
	 * Order of operations per theme path:
	 *
	 * 1. If the path is *not* in {@link dirtyThemePaths}, the existing
	 *    ZIP entry is already correct — no-op. (Original XML was placed
	 *    into the ZIP at load time.)
	 * 2. If the path is dirty, build a fresh `<a:theme>` document from
	 *    in-memory state and the captured raw subtrees, then overwrite
	 *    the ZIP entry.
	 */
	protected async persistThemeParts(): Promise<void> {
		// Build a list of (masterPath, themePath) pairs to persist. A master
		// without an entry in masterThemePaths inherited the global theme
		// path; in that case the per-master maps are empty and the global
		// themeColorMap / themeFontMap / themeFormatScheme are the source.
		const seenThemePaths = new Set<string>();

		for (const [masterPath, themePath] of this.masterThemePaths.entries()) {
			if (!themePath) {
				continue;
			}
			seenThemePaths.add(themePath);
			if (!this.dirtyThemePaths.has(themePath)) {
				continue;
			}
			const themeXml = this.buildThemeXml(themePath, masterPath);
			if (themeXml) {
				this.zip.file(themePath, themeXml);
			}
		}

		// Catch any theme paths that have an original captured but no master
		// pointing at them (e.g. orphan themes in the ZIP). Re-emit dirty ones
		// from the global state.
		for (const [themePath] of this.originalThemeXmlByPath.entries()) {
			if (seenThemePaths.has(themePath)) {
				continue;
			}
			if (!this.dirtyThemePaths.has(themePath)) {
				continue;
			}
			const themeXml = this.buildThemeXml(themePath, undefined);
			if (themeXml) {
				this.zip.file(themePath, themeXml);
			}
		}
	}

	/**
	 * Build a complete `<a:theme>` XML document from in-memory state.
	 * Returns the serialized XML string (with XML prolog), or `undefined`
	 * if there is no source data to emit.
	 *
	 * - Color scheme: built from per-master color map (or global fallback).
	 * - Font scheme: built from per-master font map + per-script entries.
	 * - Format scheme: re-emit the original XML subtree if available; else
	 *   build a minimal scheme from {@link themeFormatScheme}.
	 * - objectDefaults / extraClrSchemeLst / custClrLst / extLst: re-emit
	 *   captured raw subtrees.
	 */
	protected buildThemeXml(themePath: string, masterPath: string | undefined): string | undefined {
		const colorMap =
			(masterPath && this.masterThemeColorMaps.get(masterPath)) ||
			this.globalThemeColorMapSnapshot ||
			this.themeColorMap;
		const fontMap =
			(masterPath && this.masterThemeFontMaps.get(masterPath)) ||
			this.globalThemeFontMapSnapshot ||
			this.themeFontMap;

		const themeName = this.masterThemeNames.get(themePath) || 'Office Theme';
		const colorSchemeName = this.masterThemeColorSchemeNames.get(themePath) || themeName;
		const fontSchemeName = this.masterThemeFontSchemeNames.get(themePath) || themeName;

		const majorScripts = this.masterThemeMajorFontScripts.get(themePath) || {};
		const minorScripts = this.masterThemeMinorFontScripts.get(themePath) || {};

		// Build colour scheme XML object.
		const clrScheme = this.buildClrSchemeObject(colorSchemeName, colorMap);
		const fontScheme = this.buildFontSchemeObject(
			fontSchemeName,
			fontMap,
			majorScripts,
			minorScripts,
		);

		// Format scheme: prefer the original raw subtree (kept on the parsed
		// theme via originalThemeXmlByPath) since the in-memory
		// PptxThemeFormatScheme is a lossy representation. Re-extract it from
		// the original XML by parsing once and grabbing `a:fmtScheme` verbatim.
		const fmtScheme = this.extractRawSubtreeFromOriginal(themePath, [
			'a:theme',
			'a:themeElements',
			'a:fmtScheme',
		]);

		const themeElements: XmlObject = {
			'a:clrScheme': clrScheme,
			'a:fontScheme': fontScheme,
		};
		if (fmtScheme !== undefined) {
			themeElements['a:fmtScheme'] = fmtScheme as XmlObject;
		} else {
			// Last-resort minimal placeholder so PowerPoint doesn't reject
			// the theme. (Required child per CT_BaseStyles.)
			themeElements['a:fmtScheme'] = this.buildMinimalFmtScheme(themeName);
		}

		const themeRoot: XmlObject = {
			'@_xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
			'@_name': themeName,
			'a:themeElements': themeElements,
		};

		// objectDefaults — M5.
		const objectDefaults = this.masterThemeObjectDefaults.get(themePath);
		if (objectDefaults && (objectDefaults.spDef || objectDefaults.lnDef || objectDefaults.txDef)) {
			const od: XmlObject = {};
			if (objectDefaults.spDef !== undefined) {
				od['a:spDef'] = objectDefaults.spDef as XmlObject;
			}
			if (objectDefaults.lnDef !== undefined) {
				od['a:lnDef'] = objectDefaults.lnDef as XmlObject;
			}
			if (objectDefaults.txDef !== undefined) {
				od['a:txDef'] = objectDefaults.txDef as XmlObject;
			}
			themeRoot['a:objectDefaults'] = od;
		} else {
			// Empty objectDefaults is canonical per Office output.
			themeRoot['a:objectDefaults'] = {};
		}

		// extraClrSchemeLst.
		const extraClr = this.masterThemeExtraClrSchemeLst.get(themePath);
		themeRoot['a:extraClrSchemeLst'] =
			extraClr !== undefined ? (extraClr as XmlObject) : ({} as XmlObject);

		// custClrLst.
		const custClr = this.masterThemeCustClrLst.get(themePath);
		if (custClr !== undefined) {
			themeRoot['a:custClrLst'] = custClr as XmlObject;
		}

		// extLst.
		const themeExt = this.masterThemeExtLst.get(themePath);
		if (themeExt !== undefined) {
			themeRoot['a:extLst'] = themeExt as XmlObject;
		}

		const doc: XmlObject = {
			'?xml': { '@_version': '1.0', '@_encoding': 'UTF-8', '@_standalone': 'yes' },
			'a:theme': themeRoot,
		};

		try {
			return this.builder.build(doc);
		} catch (error) {
			console.warn(`Failed to build theme XML for ${themePath}:`, error);
			return undefined;
		}
	}

	/**
	 * Build the `a:clrScheme` XmlObject from a colour map. Each slot
	 * value is interpreted as either a `#RRGGBB` srgb hex or a known
	 * sysClr token (currently always emitted as srgbClr — the in-memory
	 * map is hex-typed; sysClr round-trip belongs to the broader C-H3
	 * fix to preserve original color XML and is out of scope here).
	 */
	protected buildClrSchemeObject(schemeName: string, colorMap: Record<string, string>): XmlObject {
		const slot = (key: keyof PptxThemeColorScheme): XmlObject => {
			const hex = String(colorMap[key as string] || '').replace(/^#/, '');
			const srgb = hex.length === 6 ? hex.toUpperCase() : '000000';
			return { 'a:srgbClr': { '@_val': srgb } };
		};

		// dk1/lt1 typically use sysClr in real Office themes (windowText /
		// window). When the original theme's <a:dk1> (or <a:lt1>) was a
		// sysClr we lose that nuance through the hex-only colour map. Emit
		// srgbClr unconditionally; downstream consumers that load this file
		// see the same resolved colour values.
		return {
			'@_name': schemeName,
			'a:dk1': slot('dk1'),
			'a:lt1': slot('lt1'),
			'a:dk2': slot('dk2'),
			'a:lt2': slot('lt2'),
			'a:accent1': slot('accent1'),
			'a:accent2': slot('accent2'),
			'a:accent3': slot('accent3'),
			'a:accent4': slot('accent4'),
			'a:accent5': slot('accent5'),
			'a:accent6': slot('accent6'),
			'a:hlink': slot('hlink'),
			'a:folHlink': slot('folHlink'),
		};
	}

	/**
	 * Build the `a:fontScheme` XmlObject from a font map plus per-script
	 * font tables.
	 *
	 * Phase 4 Stream A / M4.
	 */
	protected buildFontSchemeObject(
		schemeName: string,
		fontMap: Record<string, string>,
		majorScripts: Record<string, string>,
		minorScripts: Record<string, string>,
	): XmlObject {
		const buildFontGroup = (
			latinKey: string,
			eaKey: string,
			csKey: string,
			scripts: Record<string, string>,
		): XmlObject => {
			const group: XmlObject = {
				'a:latin': { '@_typeface': fontMap[latinKey] || 'Calibri' },
				'a:ea': { '@_typeface': fontMap[eaKey] || '' },
				'a:cs': { '@_typeface': fontMap[csKey] || '' },
			};
			const scriptKeys = Object.keys(scripts);
			if (scriptKeys.length > 0) {
				const fontEntries = scriptKeys.map((script) => ({
					'@_script': script,
					'@_typeface': scripts[script],
				}));
				group['a:font'] = fontEntries.length === 1 ? fontEntries[0] : fontEntries;
			}
			return group;
		};

		return {
			'@_name': schemeName,
			'a:majorFont': buildFontGroup('mj-lt', 'mj-ea', 'mj-cs', majorScripts),
			'a:minorFont': buildFontGroup('mn-lt', 'mn-ea', 'mn-cs', minorScripts),
		};
	}

	/**
	 * Re-parse the original theme XML and pluck out a subtree by path,
	 * returning the raw parser object. Returns `undefined` when the
	 * original is missing or the path doesn't exist.
	 *
	 * Used to preserve `a:fmtScheme` byte-for-byte through a regenerate
	 * round-trip, since the in-memory PptxThemeFormatScheme is lossy.
	 */
	protected extractRawSubtreeFromOriginal(themePath: string, path: string[]): unknown | undefined {
		const original = this.originalThemeXmlByPath.get(themePath);
		if (!original) {
			return undefined;
		}
		try {
			const parsed = this.parser.parse(original) as XmlObject;
			let cursor: unknown = parsed;
			for (const segment of path) {
				if (cursor && typeof cursor === 'object' && segment in (cursor as XmlObject)) {
					cursor = (cursor as XmlObject)[segment];
				} else {
					return undefined;
				}
			}
			return cursor;
		} catch {
			return undefined;
		}
	}

	/**
	 * Last-resort minimal `<a:fmtScheme>` body. Mirrors the SDK new-deck
	 * builder's output for new presentations, scaled down to the smallest
	 * schema-valid form.
	 */
	protected buildMinimalFmtScheme(name: string): XmlObject {
		const phClrSolid = { 'a:solidFill': { 'a:schemeClr': { '@_val': 'phClr' } } };
		return {
			'@_name': name,
			'a:fillStyleLst': {
				'a:solidFill': [{ 'a:schemeClr': { '@_val': 'phClr' } }],
				'a:gradFill': [],
			},
			'a:lnStyleLst': {
				'a:ln': [
					{
						'@_w': '6350',
						'@_cap': 'flat',
						'@_cmpd': 'sng',
						'@_algn': 'ctr',
						...phClrSolid,
						'a:prstDash': { '@_val': 'solid' },
						'a:miter': { '@_lim': '800000' },
					},
					{
						'@_w': '12700',
						'@_cap': 'flat',
						'@_cmpd': 'sng',
						'@_algn': 'ctr',
						...phClrSolid,
						'a:prstDash': { '@_val': 'solid' },
						'a:miter': { '@_lim': '800000' },
					},
					{
						'@_w': '19050',
						'@_cap': 'flat',
						'@_cmpd': 'sng',
						'@_algn': 'ctr',
						...phClrSolid,
						'a:prstDash': { '@_val': 'solid' },
						'a:miter': { '@_lim': '800000' },
					},
				],
			},
			'a:effectStyleLst': {
				'a:effectStyle': [{ 'a:effectLst': {} }, { 'a:effectLst': {} }, { 'a:effectLst': {} }],
			},
			'a:bgFillStyleLst': {
				'a:solidFill': [{ 'a:schemeClr': { '@_val': 'phClr' } }],
				'a:gradFill': [],
			},
		};
	}
}
