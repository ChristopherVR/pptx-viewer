import type { PptxImageProperties, PptxSlideBackgroundPattern, XmlObject } from '../../types';
import { partRelsPath } from '../../utils/part-rels-path';
import { stripParentDirSegments } from '../../utils/strip-parent-dir-segments';
import { xmlAttr, xmlAttrNumber, xmlChild, xmlPath } from '../../utils/xml-access';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeColorAndEffects';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Preserve the visual properties authored on a background `a:blipFill`.
	 *
	 * The decoded image URL alone is not enough to reproduce PowerPoint: crop,
	 * stretch/tile placement and blip effects such as `a:alphaModFix` live next
	 * to the relationship id and otherwise disappear during slide assembly.
	 */
	protected extractBackgroundImageProperties(
		slideXml: XmlObject,
		rootElement: string = 'p:sld',
	): PptxImageProperties | undefined {
		try {
			const blipFill = xmlPath(slideXml, rootElement, 'p:cSld', 'p:bg', 'p:bgPr', 'a:blipFill');
			const blip = xmlChild(blipFill, 'a:blip');
			if (!blipFill || !blip) {
				return undefined;
			}

			const properties: PptxImageProperties = {
				...this.readImageCropFromBlipFill(blipFill),
			};
			const imageEffects = this.extractImageEffects(blip);
			if (imageEffects) {
				properties.imageEffects = imageEffects;
			}

			const tileNode = xmlChild(blipFill, 'a:tile');
			if (tileNode) {
				const txRaw = Number.parseInt(String(tileNode['@_tx'] ?? ''), 10);
				const tyRaw = Number.parseInt(String(tileNode['@_ty'] ?? ''), 10);
				const sxRaw = Number.parseInt(String(tileNode['@_sx'] ?? ''), 10);
				const syRaw = Number.parseInt(String(tileNode['@_sy'] ?? ''), 10);
				properties.tileOffsetX = Number.isFinite(txRaw) ? txRaw / 9525 : 0;
				properties.tileOffsetY = Number.isFinite(tyRaw) ? tyRaw / 9525 : 0;
				properties.tileScaleX = Number.isFinite(sxRaw) ? sxRaw / 100000 : 1;
				properties.tileScaleY = Number.isFinite(syRaw) ? syRaw / 100000 : 1;
				const flip = String(tileNode['@_flip'] ?? 'none').trim();
				if (flip === 'x' || flip === 'y' || flip === 'xy' || flip === 'none') {
					properties.tileFlip = flip;
				}
				const alignment = String(tileNode['@_algn'] ?? 'tl').trim();
				if (alignment.length > 0) {
					properties.tileAlignment = alignment;
				}
			}

			return Object.keys(properties).length > 0 ? properties : undefined;
		} catch (error) {
			console.warn('Failed to extract background image properties:', error);
			return undefined;
		}
	}

	protected async extractBackgroundImage(
		slideXml: XmlObject,
		slidePath: string,
		rootElement: string = 'p:sld',
	): Promise<string | undefined> {
		try {
			const blip = xmlPath(
				slideXml,
				rootElement,
				'p:cSld',
				'p:bg',
				'p:bgPr',
				'a:blipFill',
				'a:blip',
			);
			const rEmbed = xmlAttr(blip, 'r:embed');
			if (!rEmbed) {
				return undefined;
			}

			const slideRels = this.slideRelsMap.get(slidePath);
			const target = slideRels?.get(rEmbed);
			if (!target) {
				return undefined;
			}

			// Load H3: external URL gating. Refuse to pass through
			// http(s):// background images unless allowExternalImages
			// is explicitly enabled.
			if (target.startsWith('http://') || target.startsWith('https://')) {
				if (this.allowExternalImages !== true) {
					return undefined;
				}
				return target;
			}
			const imagePath = this.resolveImagePath(slidePath, target);
			return this.getImageData(imagePath);
		} catch (e) {
			console.warn('Failed to extract background image:', e);
		}
		return undefined;
	}

	protected extractBackgroundColor(
		slideXml: XmlObject,
		rootElement: string = 'p:sld',
	): string | undefined {
		try {
			const bg = xmlPath(slideXml, rootElement, 'p:cSld', 'p:bg');
			if (!bg) {
				return undefined;
			}

			// Try solid fill from bgPr
			const bgPr = xmlChild(bg, 'p:bgPr');
			if (bgPr) {
				const solidFill = xmlChild(bgPr, 'a:solidFill');
				if (solidFill) {
					return this.parseColor(solidFill);
				}
				// Pattern fill foreground colour as fallback for solid rendering
				const pattFill = xmlChild(bgPr, 'a:pattFill');
				if (pattFill) {
					const fgClr = this.parseColor(xmlChild(pattFill, 'a:fgClr'));
					if (fgClr) {
						return fgClr;
					}
					const bgClr = this.parseColor(xmlChild(pattFill, 'a:bgClr'));
					if (bgClr) {
						return bgClr;
					}
				}
			}

			// Try bgRef (reference to theme background fill style list)
			const bgRef = xmlChild(bg, 'p:bgRef');
			if (bgRef) {
				return this.resolveBackgroundRefColor(bgRef);
			}
		} catch {
			// Ignore background parsing errors
		}
		return undefined;
	}

	/**
	 * Resolve a `<p:bgRef>` element to a flat colour string.
	 *
	 * Per ECMA-376 §20.1.4.2.10 the `@idx` attribute selects an entry
	 * from one of two style matrices on the active theme:
	 *
	 * - `idx == 0` → no fill (transparent / undefined)
	 * - `1 ≤ idx ≤ 999` → `fmtScheme/fillStyleLst[idx-1]`
	 * - `1001 ≤ idx ≤ 1003` → `fmtScheme/bgFillStyleLst[idx-1001]`
	 *
	 * When the resolved fill is a gradient or pattern we surface its
	 * primary colour; gradient CSS is handled separately by
	 * {@link extractBackgroundGradient}. The colour child of `bgRef`
	 * acts as the `phClr` placeholder for any `phClr` tokens inside the
	 * referenced fill definition.
	 */
	protected resolveBackgroundRefColor(bgRef: XmlObject): string | undefined {
		const idx = xmlAttrNumber(bgRef, 'idx') ?? 0;

		// idx == 0 → no fill
		if (idx === 0) {
			return undefined;
		}

		// Direct solid fill child overrides any matrix lookup
		const solidFill = xmlChild(bgRef, 'a:solidFill');
		if (solidFill) {
			return this.parseColor(solidFill);
		}

		// The colour choice on bgRef itself acts as the phClr supplier.
		const overrideColor = this.parseColor(bgRef);

		if (this.themeFormatScheme) {
			let fillDef = undefined as (typeof this.themeFormatScheme)['fillStyles'][number] | undefined;
			if (idx >= 1 && idx <= 999) {
				fillDef = this.themeFormatScheme.fillStyles[idx - 1];
			} else if (idx >= 1001 && idx <= 1003) {
				fillDef = this.themeFormatScheme.backgroundFillStyles[idx - 1001];
			}

			if (fillDef) {
				switch (fillDef.kind) {
					case 'none':
						return undefined;
					case 'solid':
						return overrideColor || fillDef.color;
					case 'gradient':
						return overrideColor || fillDef.color;
					case 'pattern':
						return overrideColor || fillDef.color || fillDef.patternBackgroundColor;
				}
			}
		}

		if (overrideColor) {
			return overrideColor;
		}

		// Out-of-range or missing scheme — log & fall through to white so the
		// renderer doesn't blank the slide.
		if (idx !== 0) {
			console.warn(
				`bgRef @idx=${idx} did not resolve to a fill style (theme has ${
					this.themeFormatScheme?.fillStyles.length ?? 0
				} fillStyleLst / ${
					this.themeFormatScheme?.backgroundFillStyles.length ?? 0
				} bgFillStyleLst entries); falling back to #FFFFFF.`,
			);
		}
		return '#FFFFFF';
	}

	/**
	 * Extract a structured pattern fill (`<a:pattFill>`) from a slide
	 * background. Returns the preset name plus resolved fg/bg colours so
	 * renderers can draw a real SVG pattern instead of a flat fill.
	 *
	 * ECMA-376 §20.1.8.47.
	 */
	protected extractBackgroundPattern(
		slideXml: XmlObject,
		rootElement: string = 'p:sld',
	): PptxSlideBackgroundPattern | undefined {
		try {
			const pattFill = xmlPath(slideXml, rootElement, 'p:cSld', 'p:bg', 'p:bgPr', 'a:pattFill');
			if (!pattFill) {
				return undefined;
			}
			const preset = (xmlAttr(pattFill, 'prst') ?? '').trim();
			if (!preset) {
				return undefined;
			}
			const fgColor = this.parseColor(xmlChild(pattFill, 'a:fgClr'));
			const bgColor = this.parseColor(xmlChild(pattFill, 'a:bgClr'));
			return {
				preset,
				fgColor,
				bgColor,
			};
		} catch {
			return undefined;
		}
	}

	/**
	 * Extract the `<p:bgPr/@shadeToTitle>` boolean attribute from a slide
	 * background. Captured here purely as a passthrough flag on the model;
	 * the actual "shade the gradient toward the title colour" effect is
	 * applied downstream by `pptx-viewer-shared`'s `getSlideBackgroundStyle`
	 * (`render/background-shade-to-title.ts`), not by core.
	 *
	 * ECMA-376 §19.3.1.2 (CT_BackgroundProperties).
	 */
	protected extractBackgroundShadeToTitle(
		slideXml: XmlObject,
		rootElement: string = 'p:sld',
	): boolean | undefined {
		try {
			const bgPr = xmlPath(slideXml, rootElement, 'p:cSld', 'p:bg', 'p:bgPr');
			if (!bgPr) {
				return undefined;
			}
			const raw = xmlAttr(bgPr, 'shadeToTitle');
			if (raw === undefined) {
				return undefined;
			}
			const normalized = raw.trim().toLowerCase();
			return normalized === '1' || normalized === 'true';
		} catch {
			return undefined;
		}
	}

	/**
	 * Extract a CSS gradient string from a slide/layout/master background.
	 * Handles `a:gradFill` within `p:bgPr` and gradient-based `p:bgRef`.
	 */
	protected extractBackgroundGradient(
		slideXml: XmlObject,
		rootElement: string = 'p:sld',
	): string | undefined {
		try {
			const bg = xmlPath(slideXml, rootElement, 'p:cSld', 'p:bg');
			if (!bg) {
				return undefined;
			}

			const gradFill = xmlPath(bg, 'p:bgPr', 'a:gradFill');
			if (gradFill) {
				return this.extractGradientFillCss(gradFill);
			}

			// bgRef may reference a theme background fill that is a gradient
			const bgRef = xmlChild(bg, 'p:bgRef');
			if (bgRef && this.themeFormatScheme) {
				const idx = xmlAttrNumber(bgRef, 'idx') ?? 0;
				if (idx >= 1001) {
					const offset = idx - 1001;
					const fillDef = this.themeFormatScheme.backgroundFillStyles[offset];
					if (fillDef?.kind === 'gradient' && fillDef.rawNode) {
						const overrideColor = this.parseColor(bgRef);
						if (overrideColor) {
							const result = this.reResolveGradientWithPhClr(
								fillDef.rawNode as XmlObject,
								overrideColor,
							);
							return result.css;
						}
						return fillDef.gradientCss;
					}
				}
			}
		} catch {
			// Ignore
		}
		return undefined;
	}

	/**
	 * Reuse the cached parse of a layout XML part, parsing (and caching) on a
	 * miss. Background resolution runs per slide but the layout/master parts are
	 * large (a themed master can be ~200 KB); re-parsing them for every slide
	 * dominated load time, so share the same parsed object `getLayoutElements`
	 * already populated.
	 */
	protected async resolveCachedLayoutXml(layoutPath: string): Promise<XmlObject | undefined> {
		const cached = this.layoutXmlMap.get(layoutPath);
		if (cached) {
			return cached;
		}
		const xml = await this.zip.file(layoutPath)?.async('string');
		if (!xml) {
			return undefined;
		}
		const parsed = this.parser.parse(xml) as XmlObject;
		this.layoutXmlMap.set(layoutPath, parsed);
		return parsed;
	}

	/** Reuse the cached parse of a master XML part, parsing (and caching) on a miss. */
	protected async resolveCachedMasterXml(masterPath: string): Promise<XmlObject | undefined> {
		const cached = this.masterXmlMap.get(masterPath);
		if (cached) {
			return cached;
		}
		const xml = await this.zip.file(masterPath)?.async('string');
		if (!xml) {
			return undefined;
		}
		const parsed = this.parser.parse(xml) as XmlObject;
		this.masterXmlMap.set(masterPath, parsed);
		return parsed;
	}

	protected async getMasterBackgroundImage(layoutPath: string): Promise<string | undefined> {
		const layoutRels = this.slideRelsMap.get(layoutPath);
		if (!layoutRels) {
			return undefined;
		}

		for (const [, target] of layoutRels.entries()) {
			if (target.includes('slideMaster')) {
				const layoutDir = layoutPath.substring(0, layoutPath.lastIndexOf('/') + 1);
				const masterPath = target.startsWith('/')
					? target.substring(1)
					: target.startsWith('..')
						? this.resolvePath(layoutDir, target)
						: `ppt/${stripParentDirSegments(target)}`;

				try {
					const masterXmlObj = await this.resolveCachedMasterXml(masterPath);
					if (masterXmlObj) {
						const masterRelsPath = partRelsPath(masterPath);
						await this.loadSlideRelationships(masterPath, masterRelsPath);

						return this.extractBackgroundImage(masterXmlObj, masterPath, 'p:sldMaster');
					}
				} catch {
					// Ignore
				}
				break;
			}
		}
		return undefined;
	}

	protected async getMasterBackgroundImageProperties(
		layoutPath: string,
	): Promise<PptxImageProperties | undefined> {
		const layoutRels = this.slideRelsMap.get(layoutPath);
		if (!layoutRels) {
			return undefined;
		}

		for (const [, target] of layoutRels.entries()) {
			if (!target.includes('slideMaster')) {
				continue;
			}
			const layoutDir = layoutPath.substring(0, layoutPath.lastIndexOf('/') + 1);
			const masterPath = target.startsWith('/')
				? target.substring(1)
				: target.startsWith('..')
					? this.resolvePath(layoutDir, target)
					: `ppt/${stripParentDirSegments(target)}`;
			try {
				const masterXmlObj = await this.resolveCachedMasterXml(masterPath);
				return masterXmlObj
					? this.extractBackgroundImageProperties(masterXmlObj, 'p:sldMaster')
					: undefined;
			} catch {
				return undefined;
			}
		}
		return undefined;
	}

	protected async getLayoutBackgroundImage(slidePath: string): Promise<string | undefined> {
		const slideRels = this.slideRelsMap.get(slidePath);
		if (!slideRels) {
			return undefined;
		}

		for (const [, target] of slideRels.entries()) {
			if (target.includes('slideLayout')) {
				const slideDir = slidePath.substring(0, slidePath.lastIndexOf('/') + 1);
				const layoutPath = target.startsWith('/')
					? target.substring(1)
					: target.startsWith('..')
						? this.resolvePath(slideDir, target)
						: `ppt/${stripParentDirSegments(target)}`;

				try {
					const layoutXmlObj = await this.resolveCachedLayoutXml(layoutPath);
					if (layoutXmlObj) {
						// We need to load layout rels to resolve images
						const layoutRelsPath = partRelsPath(layoutPath);
						await this.loadSlideRelationships(layoutPath, layoutRelsPath);

						const bg = await this.extractBackgroundImage(layoutXmlObj, layoutPath, 'p:sldLayout');

						if (bg) {
							return bg;
						}

						// Fallback to Master
						return this.getMasterBackgroundImage(layoutPath);
					}
				} catch {
					// Ignore
				}
				break;
			}
		}
		return undefined;
	}

	protected async getLayoutBackgroundImageProperties(
		slidePath: string,
	): Promise<PptxImageProperties | undefined> {
		const slideRels = this.slideRelsMap.get(slidePath);
		if (!slideRels) {
			return undefined;
		}

		for (const [, target] of slideRels.entries()) {
			if (!target.includes('slideLayout')) {
				continue;
			}
			const slideDir = slidePath.substring(0, slidePath.lastIndexOf('/') + 1);
			const layoutPath = target.startsWith('/')
				? target.substring(1)
				: target.startsWith('..')
					? this.resolvePath(slideDir, target)
					: `ppt/${stripParentDirSegments(target)}`;
			try {
				const layoutXmlObj = await this.resolveCachedLayoutXml(layoutPath);
				if (!layoutXmlObj) {
					return undefined;
				}
				const layoutRelsPath = partRelsPath(layoutPath);
				await this.loadSlideRelationships(layoutPath, layoutRelsPath);
				const layoutImage = await this.extractBackgroundImage(
					layoutXmlObj,
					layoutPath,
					'p:sldLayout',
				);
				return layoutImage
					? this.extractBackgroundImageProperties(layoutXmlObj, 'p:sldLayout')
					: this.getMasterBackgroundImageProperties(layoutPath);
			} catch {
				return undefined;
			}
		}
		return undefined;
	}

	protected async getLayoutBackgroundColor(slidePath: string): Promise<string | undefined> {
		const slideRels = this.slideRelsMap.get(slidePath);
		if (!slideRels) {
			return undefined;
		}

		for (const [, target] of slideRels.entries()) {
			if (target.includes('slideLayout')) {
				const slideDir = slidePath.substring(0, slidePath.lastIndexOf('/') + 1);
				const layoutPath = target.startsWith('/')
					? target.substring(1)
					: target.startsWith('..')
						? this.resolvePath(slideDir, target)
						: `ppt/${stripParentDirSegments(target)}`;

				try {
					const layoutXmlObj = await this.resolveCachedLayoutXml(layoutPath);
					if (layoutXmlObj) {
						const layoutBg = this.extractBackgroundColor(layoutXmlObj, 'p:sldLayout');
						if (layoutBg) {
							return layoutBg;
						}

						// Fallback to master background colour
						return this.getMasterBackgroundColor(layoutPath);
					}
				} catch {
					// Ignore
				}
				break;
			}
		}
		return undefined;
	}

	/**
	 * Resolve the slide master's background colour given a layout path.
	 */
	protected async getMasterBackgroundColor(layoutPath: string): Promise<string | undefined> {
		const layoutRels = this.slideRelsMap.get(layoutPath);
		if (!layoutRels) {
			return undefined;
		}

		for (const [, target] of layoutRels.entries()) {
			if (target.includes('slideMaster')) {
				const layoutDir = layoutPath.substring(0, layoutPath.lastIndexOf('/') + 1);
				const masterPath = target.startsWith('/')
					? target.substring(1)
					: target.startsWith('..')
						? this.resolvePath(layoutDir, target)
						: `ppt/${stripParentDirSegments(target)}`;

				try {
					const masterXmlObj = await this.resolveCachedMasterXml(masterPath);
					if (masterXmlObj) {
						return this.extractBackgroundColor(masterXmlObj, 'p:sldMaster');
					}
				} catch {
					// Ignore
				}
				break;
			}
		}
		return undefined;
	}
}
