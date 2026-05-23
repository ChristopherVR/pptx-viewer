import { XmlObject } from '../../types';
import type { PptxThemeFillStyle, PptxThemeLineStyle, PptxThemeEffectStyle } from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeLayoutElements';

/**
 * Ordered fill-child tag tokens recognised inside `a:fillStyleLst` /
 * `a:bgFillStyleLst`. Used by {@link extractFillStyleListChildOrder} to
 * recover document order from raw XML when fast-xml-parser has merged
 * heterogeneous siblings into typed buckets.
 */
const FILL_LIST_CHILD_TAGS = [
	'a:solidFill',
	'a:gradFill',
	'a:pattFill',
	'a:noFill',
	'a:grpFill',
] as const;

type FillListChildTag = (typeof FILL_LIST_CHILD_TAGS)[number];

/**
 * Recover the document order of fill children in an `a:fillStyleLst` /
 * `a:bgFillStyleLst` block from a raw XML string by scanning the opening
 * tags between the list element's `<a:fillStyleLst[ \t\n>]` and its
 * closing tag. Returns an array of child tag names in source order.
 *
 * Returns an empty array when the listing tag isn't found or the raw XML
 * is unavailable.
 */
export function extractFillStyleListChildOrder(
	rawXml: string | undefined,
	listTag: 'a:fillStyleLst' | 'a:bgFillStyleLst',
): FillListChildTag[] {
	if (!rawXml) {
		return [];
	}
	const openRegex = new RegExp(`<${listTag.replace(':', '\\:')}\\b[^>]*>`);
	const closeRegex = new RegExp(`</${listTag.replace(':', '\\:')}\\s*>`);
	const openMatch = openRegex.exec(rawXml);
	if (!openMatch) {
		return [];
	}
	const startIdx = openMatch.index + openMatch[0].length;
	const closeMatch = closeRegex.exec(rawXml.slice(startIdx));
	if (!closeMatch) {
		return [];
	}
	const inner = rawXml.slice(startIdx, startIdx + closeMatch.index);
	const order: FillListChildTag[] = [];
	const childRegex = /<a:(solidFill|gradFill|pattFill|noFill|grpFill)\b/g;
	let match: RegExpExecArray | null;
	while ((match = childRegex.exec(inner)) !== null) {
		order.push(`a:${match[1]}` as FillListChildTag);
	}
	return order;
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Build a fill-style entry for one child node based on its tag.
	 */
	private buildFillStyleEntry(tag: FillListChildTag, node: XmlObject): PptxThemeFillStyle {
		switch (tag) {
			case 'a:solidFill':
				return {
					kind: 'solid',
					color: this.parseColor(node),
					opacity: this.extractColorOpacity(node),
					rawNode: node,
				};
			case 'a:gradFill':
				return {
					kind: 'gradient',
					color: this.extractGradientFillColor(node),
					opacity: this.extractGradientOpacity(node),
					gradientStops: this.extractGradientStops(node),
					gradientAngle: this.extractGradientAngle(node),
					gradientType: this.extractGradientType(node),
					gradientCss: this.extractGradientFillCss(node),
					rawNode: node,
				};
			case 'a:pattFill':
				return {
					kind: 'pattern',
					color:
						this.parseColor(node['a:fgClr'] as XmlObject | undefined) ||
						this.parseColor(node['a:bgClr'] as XmlObject | undefined),
					patternPreset: String(node['@_prst'] || '').trim() || undefined,
					patternBackgroundColor:
						this.parseColor(node['a:bgClr'] as XmlObject | undefined) || undefined,
					rawNode: node,
				};
			case 'a:noFill':
				return { kind: 'none', rawNode: node };
			case 'a:grpFill':
				return { kind: 'group', rawNode: node };
		}
	}

	/**
	 * Collect fill-style children from a style list node, preserving
	 * document order when an `orderHint` is supplied (extracted from the
	 * raw theme XML). Handles `a:solidFill`, `a:gradFill`, `a:pattFill`,
	 * `a:noFill`, `a:grpFill`.
	 *
	 * fast-xml-parser without `preserveOrder` collapses heterogeneous
	 * siblings into per-tag buckets and we lose the relative document
	 * order. When the caller supplies an `orderHint` (a list of tag names
	 * in source order recovered via {@link extractFillStyleListChildOrder})
	 * we walk the buckets in step with the hint and emit entries in true
	 * document order. Without a hint we fall back to the historical
	 * solid → gradient → pattern → noFill → grpFill grouping.
	 */
	protected collectFillChildren(
		listNode: XmlObject,
		orderHint?: readonly FillListChildTag[],
	): PptxThemeFillStyle[] {
		const buckets: Record<FillListChildTag, XmlObject[]> = {
			'a:solidFill': this.ensureArray(listNode['a:solidFill']) as XmlObject[],
			'a:gradFill': this.ensureArray(listNode['a:gradFill']) as XmlObject[],
			'a:pattFill': this.ensureArray(listNode['a:pattFill']) as XmlObject[],
			'a:noFill': this.ensureArray(listNode['a:noFill']) as XmlObject[],
			'a:grpFill': this.ensureArray(listNode['a:grpFill']) as XmlObject[],
		};

		if (orderHint && orderHint.length > 0) {
			const cursors: Record<FillListChildTag, number> = {
				'a:solidFill': 0,
				'a:gradFill': 0,
				'a:pattFill': 0,
				'a:noFill': 0,
				'a:grpFill': 0,
			};
			const ordered: PptxThemeFillStyle[] = [];
			for (const tag of orderHint) {
				const idx = cursors[tag];
				const node = buckets[tag][idx];
				if (node) {
					ordered.push(this.buildFillStyleEntry(tag, node));
					cursors[tag] = idx + 1;
				}
			}
			// Append any nodes the hint did not cover (defensive).
			for (const tag of FILL_LIST_CHILD_TAGS) {
				while (cursors[tag] < buckets[tag].length) {
					ordered.push(this.buildFillStyleEntry(tag, buckets[tag][cursors[tag]]));
					cursors[tag] += 1;
				}
			}
			return ordered;
		}

		// No order hint — fall back to typed grouping (legacy behaviour).
		const results: PptxThemeFillStyle[] = [];
		for (const tag of FILL_LIST_CHILD_TAGS) {
			for (const node of buckets[tag]) {
				results.push(this.buildFillStyleEntry(tag, node));
			}
		}
		return results;
	}

	/**
	 * Parse each child of a `a:fillStyleLst` (or `a:bgFillStyleLst`).
	 * Children can be `a:solidFill`, `a:gradFill`, `a:pattFill`,
	 * `a:noFill`, or `a:grpFill`. The list is ordered and 1-indexed by
	 * position; supply `orderHint` to recover document order when the
	 * parser collapsed heterogeneous siblings.
	 */
	protected parseFillStyleList(
		listNode: XmlObject | undefined,
		orderHint?: readonly FillListChildTag[],
	): PptxThemeFillStyle[] {
		if (!listNode) {
			return [];
		}
		return this.collectFillChildren(listNode, orderHint);
	}

	/**
	 * Parse `a:lnStyleLst` children (`a:ln` elements) into an array of
	 * {@link PptxThemeLineStyle} entries.
	 */
	protected parseLineStyleList(listNode: XmlObject | undefined): PptxThemeLineStyle[] {
		if (!listNode) {
			return [];
		}
		const lnNodes = this.ensureArray(listNode['a:ln']);
		return lnNodes.map((lnRaw) => {
			const ln = lnRaw as XmlObject;
			const style: PptxThemeLineStyle = { rawNode: ln };

			// Width
			if (ln['@_w']) {
				style.width = parseInt(String(ln['@_w'])) / PptxHandlerRuntime.EMU_PER_PX;
			}

			// Fill colour (solid, gradient first stop, pattern foreground)
			if (ln['a:solidFill']) {
				style.color = this.parseColor(ln['a:solidFill'] as XmlObject);
				style.opacity = this.extractColorOpacity(ln['a:solidFill'] as XmlObject);
			} else if (ln['a:gradFill']) {
				style.color = this.extractGradientFillColor(ln['a:gradFill'] as XmlObject);
			} else if (ln['a:pattFill']) {
				const pf = ln['a:pattFill'] as XmlObject;
				style.color =
					this.parseColor(pf['a:fgClr'] as XmlObject | undefined) ||
					this.parseColor(pf['a:bgClr'] as XmlObject | undefined);
			}

			// Dash style
			const dashVal = (ln['a:prstDash'] as XmlObject | undefined)?.['@_val'];
			const dashType = this.normalizeStrokeDashType(dashVal);
			if (dashType) {
				style.dash = dashType;
			}

			// Line join — self-closing tags (<a:round/>) are parsed as falsy by
			// fast-xml-parser, so check key existence instead of truthiness.
			if ('a:round' in ln) {
				style.lineJoin = 'round';
			} else if ('a:bevel' in ln) {
				style.lineJoin = 'bevel';
			} else if ('a:miter' in ln) {
				style.lineJoin = 'miter';
			}

			// Line cap
			const capVal = String(ln['@_cap'] || '')
				.trim()
				.toLowerCase();
			if (capVal === 'rnd' || capVal === 'sq' || capVal === 'flat') {
				style.lineCap = capVal as PptxThemeLineStyle['lineCap'];
			}

			// Compound line
			const cmpd = String(ln['@_cmpd'] || '').trim();
			if (
				cmpd === 'sng' ||
				cmpd === 'dbl' ||
				cmpd === 'thickThin' ||
				cmpd === 'thinThick' ||
				cmpd === 'tri'
			) {
				style.compoundLine = cmpd as PptxThemeLineStyle['compoundLine'];
			}

			return style;
		});
	}

	/**
	 * Parse `a:effectStyleLst` children (`a:effectStyle`) into an array
	 * of {@link PptxThemeEffectStyle} entries.  Each style wraps an
	 * `a:effectLst` node that can contain shadow, glow, soft-edge, etc.
	 */
	protected parseEffectStyleList(listNode: XmlObject | undefined): PptxThemeEffectStyle[] {
		if (!listNode) {
			return [];
		}
		const styleNodes = this.ensureArray(listNode['a:effectStyle']);
		return styleNodes.map((esRaw) => {
			const es = esRaw as XmlObject;
			const effectLst = (es['a:effectLst'] ?? es['a:effectDag']) as XmlObject | undefined;
			const result: PptxThemeEffectStyle = { rawNode: es };

			if (!effectLst) {
				return result;
			}

			// Outer shadow (a:outerShdw)
			const outerShdw = effectLst['a:outerShdw'] as XmlObject | undefined;
			if (outerShdw) {
				result.shadowColor = this.parseColor(outerShdw);
				result.shadowOpacity = this.extractColorOpacity(outerShdw);
				const blurRad = parseInt(String(outerShdw['@_blurRad'] || '0'));
				if (Number.isFinite(blurRad) && blurRad > 0) {
					result.shadowBlur = blurRad / PptxHandlerRuntime.EMU_PER_PX;
				}
				const dist = parseInt(String(outerShdw['@_dist'] || '0'));
				const dir = parseInt(String(outerShdw['@_dir'] || '0'));
				if (Number.isFinite(dist) && dist > 0 && Number.isFinite(dir)) {
					const angleRad = (dir / 60000) * (Math.PI / 180);
					result.shadowOffsetX = (Math.cos(angleRad) * dist) / PptxHandlerRuntime.EMU_PER_PX;
					result.shadowOffsetY = (Math.sin(angleRad) * dist) / PptxHandlerRuntime.EMU_PER_PX;
				}
			}

			// Inner shadow (a:innerShdw)
			const innerShdw = effectLst['a:innerShdw'] as XmlObject | undefined;
			if (innerShdw) {
				result.innerShadowColor = this.parseColor(innerShdw);
				result.innerShadowOpacity = this.extractColorOpacity(innerShdw);
				const blurRad = parseInt(String(innerShdw['@_blurRad'] || '0'));
				if (Number.isFinite(blurRad) && blurRad > 0) {
					result.innerShadowBlur = blurRad / PptxHandlerRuntime.EMU_PER_PX;
				}
				const dist = parseInt(String(innerShdw['@_dist'] || '0'));
				const dir = parseInt(String(innerShdw['@_dir'] || '0'));
				if (Number.isFinite(dist) && dist > 0 && Number.isFinite(dir)) {
					const angleRad = (dir / 60000) * (Math.PI / 180);
					result.innerShadowOffsetX = (Math.cos(angleRad) * dist) / PptxHandlerRuntime.EMU_PER_PX;
					result.innerShadowOffsetY = (Math.sin(angleRad) * dist) / PptxHandlerRuntime.EMU_PER_PX;
				}
			}

			// Glow (a:glow)
			const glow = effectLst['a:glow'] as XmlObject | undefined;
			if (glow) {
				result.glowColor = this.parseColor(glow);
				result.glowOpacity = this.extractColorOpacity(glow);
				const glowRad = parseInt(String(glow['@_rad'] || '0'));
				if (Number.isFinite(glowRad) && glowRad > 0) {
					result.glowRadius = glowRad / PptxHandlerRuntime.EMU_PER_PX;
				}
			}

			// Soft edge (a:softEdge)
			const softEdge = effectLst['a:softEdge'] as XmlObject | undefined;
			if (softEdge) {
				const rad = parseInt(String(softEdge['@_rad'] || '0'));
				if (Number.isFinite(rad) && rad > 0) {
					result.softEdgeRadius = rad / PptxHandlerRuntime.EMU_PER_PX;
				}
			}

			// Reflection (a:reflection)
			const reflection = effectLst['a:reflection'] as XmlObject | undefined;
			if (reflection) {
				const blurRad = parseInt(String(reflection['@_blurRad'] || '0'));
				if (Number.isFinite(blurRad) && blurRad >= 0) {
					result.reflectionBlurRadius = blurRad / PptxHandlerRuntime.EMU_PER_PX;
				}
				const stA = parseInt(String(reflection['@_stA'] || ''));
				if (Number.isFinite(stA)) {
					result.reflectionStartOpacity = stA / 100000;
				}
				const endA = parseInt(String(reflection['@_endA'] || ''));
				if (Number.isFinite(endA)) {
					result.reflectionEndOpacity = endA / 100000;
				}
				const endPos = parseInt(String(reflection['@_endPos'] || ''));
				if (Number.isFinite(endPos)) {
					result.reflectionEndPosition = endPos / 100000;
				}
				const dir = parseInt(String(reflection['@_dir'] || ''));
				if (Number.isFinite(dir)) {
					result.reflectionDirection = dir / 60000;
				}
				const rot = parseInt(String(reflection['@_rot'] || ''));
				if (Number.isFinite(rot)) {
					result.reflectionRotation = rot / 60000;
				}
				const dist = parseInt(String(reflection['@_dist'] || '0'));
				if (Number.isFinite(dist) && dist >= 0) {
					result.reflectionDistance = dist / PptxHandlerRuntime.EMU_PER_PX;
				}
			}

			// 3D scene (a:scene3d) — sits on the effectStyle node, not effectLst
			const scene3dNode = es['a:scene3d'] as XmlObject | undefined;
			if (scene3dNode) {
				const camera = scene3dNode['a:camera'] as XmlObject | undefined;
				const lightRig = scene3dNode['a:lightRig'] as XmlObject | undefined;
				result.scene3d = {
					cameraPreset: String(camera?.['@_prst'] || '').trim() || undefined,
					lightRigType: String(lightRig?.['@_rig'] || '').trim() || undefined,
					lightRigDirection: String(lightRig?.['@_dir'] || '').trim() || undefined,
				};
			}

			// 3D shape extrusion/bevel (a:sp3d) — sits on the effectStyle node
			const sp3dNode = es['a:sp3d'] as XmlObject | undefined;
			if (sp3dNode) {
				const bevelTop = sp3dNode['a:bevelT'] as XmlObject | undefined;
				const bevelBottom = sp3dNode['a:bevelB'] as XmlObject | undefined;
				result.shape3d = {
					extrusionHeight:
						sp3dNode['@_extrusionH'] !== undefined
							? parseInt(String(sp3dNode['@_extrusionH']), 10)
							: undefined,
					extrusionColor: this.parseColor(sp3dNode['a:extrusionClr'] as XmlObject | undefined),
					contourWidth:
						sp3dNode['@_contourW'] !== undefined
							? parseInt(String(sp3dNode['@_contourW']), 10)
							: undefined,
					contourColor: this.parseColor(sp3dNode['a:contourClr'] as XmlObject | undefined),
					presetMaterial: String(sp3dNode['@_prstMaterial'] || '').trim() || undefined,
					bevelTopType: bevelTop ? String(bevelTop['@_prst'] || 'circle').trim() : undefined,
					bevelTopWidth:
						bevelTop !== undefined && bevelTop['@_w'] !== undefined
							? parseInt(String(bevelTop['@_w']), 10)
							: undefined,
					bevelTopHeight:
						bevelTop !== undefined && bevelTop['@_h'] !== undefined
							? parseInt(String(bevelTop['@_h']), 10)
							: undefined,
					bevelBottomType: bevelBottom
						? String(bevelBottom['@_prst'] || 'circle').trim()
						: undefined,
					bevelBottomWidth:
						bevelBottom !== undefined && bevelBottom['@_w'] !== undefined
							? parseInt(String(bevelBottom['@_w']), 10)
							: undefined,
					bevelBottomHeight:
						bevelBottom !== undefined && bevelBottom['@_h'] !== undefined
							? parseInt(String(bevelBottom['@_h']), 10)
							: undefined,
				};
			}

			return result;
		});
	}
}
