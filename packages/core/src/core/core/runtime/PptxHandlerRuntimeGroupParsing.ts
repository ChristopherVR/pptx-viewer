import { XmlObject, PptxElement, hasShapeProperties, hasTextProperties } from '../../types';
import type { GroupPptxElement } from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSpTreeParsing';

/**
 * Maximum nesting depth for `p:grpSp` recursion (Load H1).
 *
 * PowerPoint itself does not document a hard limit, but legitimate decks
 * almost never nest more than a handful of levels (typical max < 10). A
 * depth of 64 is well above any plausible authoring use while still
 * preventing stack-overflow DoS from a maliciously deep group tree
 * (`<p:grpSp><p:grpSp>...</p:grpSp></p:grpSp>` chain).
 */
const MAX_GROUP_DEPTH = 64;

/** EMU values are int32 per ECMA-376 §22.1.2.4. Clamp parsed values to this range. */
const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;

/**
 * Parse a string as a base-10 integer with a finite-number guard and an
 * int32 clamp. Used for attacker-controlled EMU values from XML attributes.
 * Returns 0 for malformed/non-finite inputs (matching previous fallback
 * behaviour from `parseInt(... || '0')` while rejecting `'1e308'` and
 * similar finite-overflow values).
 */
function parseEmuInt(value: unknown): number {
	const parsed = parseInt(String(value ?? ''), 10);
	if (!Number.isFinite(parsed)) {
		return 0;
	}
	if (parsed < INT32_MIN) {
		return INT32_MIN;
	}
	if (parsed > INT32_MAX) {
		return INT32_MAX;
	}
	return parsed;
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected async parseGroupShape(
		group: XmlObject,
		baseId: string,
		slidePath: string,
		rawXmlStr?: string,
		depth: number = 0,
	): Promise<PptxElement[]> {
		// Load H1: cap recursion depth to prevent stack-overflow DoS from a
		// maliciously deep `<p:grpSp>` chain.
		if (depth > MAX_GROUP_DEPTH) {
			this.compatibilityService.reportWarning({
				code: 'group-depth-exceeded',
				severity: 'warning',
				scope: 'element',
				message: `Group nesting exceeded ${MAX_GROUP_DEPTH} levels; truncating subtree (baseId=${baseId})`,
				slideId: slidePath,
				elementId: baseId,
			});
			return [];
		}

		const grpSpPr = group['p:grpSpPr'] as XmlObject | undefined;
		const xfrm = grpSpPr?.['a:xfrm'] as XmlObject | undefined;

		// Keep the group transform in UNROUNDED pixels. A themed background
		// often uses a compact child coordinate space (e.g. `chExt` of a few
		// thousand EMU for a full-slide group); rounding `chExt`/child offsets
		// to whole pixels early collapses them to 0, which both zeroes the
		// child geometry and makes the scale fall back to 1. Float math keeps
		// the ratio (`parentExt / chExt`) accurate no matter the units.
		const EMU_PX = PptxHandlerRuntime.EMU_PER_PX;
		let parentX = 0,
			parentY = 0,
			parentW = 0,
			parentH = 0;
		let chX = 0,
			chY = 0,
			chW = 0,
			chH = 0;

		if (xfrm) {
			const off = xfrm['a:off'] as XmlObject | undefined;
			if (off) {
				parentX = parseEmuInt(off['@_x']) / EMU_PX;
				parentY = parseEmuInt(off['@_y']) / EMU_PX;
			}
			const ext = xfrm['a:ext'] as XmlObject | undefined;
			if (ext) {
				parentW = parseEmuInt(ext['@_cx']) / EMU_PX;
				parentH = parseEmuInt(ext['@_cy']) / EMU_PX;
			}
			const chOff = xfrm['a:chOff'] as XmlObject | undefined;
			if (chOff) {
				chX = parseEmuInt(chOff['@_x']) / EMU_PX;
				chY = parseEmuInt(chOff['@_y']) / EMU_PX;
			}
			const chExt = xfrm['a:chExt'] as XmlObject | undefined;
			if (chExt) {
				chW = parseEmuInt(chExt['@_cx']) / EMU_PX;
				chH = parseEmuInt(chExt['@_cy']) / EMU_PX;
			}
		}

		const scaleX = chW > 0 ? parentW / chW : 1;
		const scaleY = chH > 0 ? parentH / chH : 1;

		// A child shape's own `a:xfrm` is expressed in the group's child
		// coordinate space, not EMU. `parseShape` converts it as if it were
		// EMU (dividing by EMU_PER_PX and rounding), so compact child units
		// round to 0. Recover the child's true position/size by re-reading its
		// raw `a:off`/`a:ext` here (unrounded) before the group scale is
		// applied, so the transform below produces the correct pixels.
		const rawChildXfrm = (childNode: XmlObject | undefined): XmlObject | undefined => {
			if (!childNode) {
				return undefined;
			}
			const childXfrm =
				((childNode['p:spPr'] as XmlObject | undefined)?.['a:xfrm'] as XmlObject | undefined) ??
				(childNode['p:xfrm'] as XmlObject | undefined);
			return childXfrm;
		};
		const applyRawChildGeometry = (el: PptxElement, childNode: XmlObject | undefined): void => {
			const childXfrm = rawChildXfrm(childNode);
			if (!childXfrm) {
				return;
			}
			const off = childXfrm['a:off'] as XmlObject | undefined;
			const ext = childXfrm['a:ext'] as XmlObject | undefined;
			if (off) {
				el.x = parseEmuInt(off['@_x']) / EMU_PX;
				el.y = parseEmuInt(off['@_y']) / EMU_PX;
			}
			if (ext) {
				el.width = parseEmuInt(ext['@_cx']) / EMU_PX;
				el.height = parseEmuInt(ext['@_cy']) / EMU_PX;
			}
		};

		const transformElement = (el: PptxElement) => {
			const relativeX = el.x - chX;
			const relativeY = el.y - chY;
			el.x = parentX + relativeX * scaleX;
			el.y = parentY + relativeY * scaleY;
			el.width *= scaleX;
			el.height *= scaleY;

			const avgScale = (Math.abs(scaleX) + Math.abs(scaleY)) / 2;
			if (hasShapeProperties(el) && el.shapeStyle?.strokeWidth) {
				el.shapeStyle.strokeWidth *= avgScale;
			}
			if (hasTextProperties(el)) {
				if (el.textStyle?.fontSize) {
					el.textStyle.fontSize *= Math.abs(scaleY);
				}
				if (el.textSegments) {
					el.textSegments.forEach((seg) => {
						if (seg.style.fontSize) {
							seg.style.fontSize *= Math.abs(scaleY);
						}
					});
				}
			}
			return el;
		};

		this.unwrapAlternateContent(group as Record<string, unknown>);

		const childOrder = this.extractSpTreeChildOrder(
			undefined,
			group as Record<string, unknown>,
			'p:grpSp',
		);
		const elements: PptxElement[] = [];

		for (const entry of childOrder) {
			if (entry.tag === 'p:grpSp') {
				const subArr = this.ensureArray(group['p:grpSp']);
				const subGroup = subArr[entry.indexInType];
				if (!subGroup) {
					continue;
				}
				const subElements = await this.parseGroupShape(
					subGroup,
					`${baseId}-group-${entry.indexInType}`,
					slidePath,
					rawXmlStr,
					depth + 1,
				);
				subElements.forEach((el) => transformElement(el));
				elements.push(...subElements);
			} else {
				const element = await this.parseSpTreeChild(
					entry.tag,
					entry.indexInType,
					group as Record<string, unknown>,
					slidePath,
					`${baseId}-`,
				);
				if (element) {
					const childNode = this.ensureArray(group[entry.tag])[entry.indexInType] as
						| XmlObject
						| undefined;
					applyRawChildGeometry(element, childNode);
					transformElement(element);
					elements.push(element);
				}
			}
		}

		return elements;
	}

	/**
	 * Parse a p:grpSp element into a GroupPptxElement with children.
	 * Children have coordinates relative to the group's position.
	 */
	protected override async parseGroupShapeAsGroup(
		group: XmlObject,
		baseId: string,
		slidePath: string,
		rawXmlStr?: string,
	): Promise<PptxElement | null> {
		const grpSpPr = group['p:grpSpPr'] as XmlObject | undefined;
		const xfrm = grpSpPr?.['a:xfrm'] as XmlObject | undefined;

		let parentX = 0,
			parentY = 0,
			parentW = 0,
			parentH = 0;

		// Group-level rotation/flip live on `p:grpSpPr/a:xfrm` and must be
		// carried onto the GroupPptxElement so the renderer can wrap the whole
		// group in a single rotate/flip transform (issue #70). `@_rot` is in
		// 60000ths of a degree (ECMA-376 ST_Angle), matching shape parsing.
		let groupRotation: number | undefined;
		let flipHorizontal = false;
		let flipVertical = false;

		if (xfrm) {
			const off = xfrm['a:off'] as XmlObject | undefined;
			if (off) {
				parentX = Math.round(parseEmuInt(off['@_x']) / PptxHandlerRuntime.EMU_PER_PX);
				parentY = Math.round(parseEmuInt(off['@_y']) / PptxHandlerRuntime.EMU_PER_PX);
			}
			const ext = xfrm['a:ext'] as XmlObject | undefined;
			if (ext) {
				parentW = Math.round(parseEmuInt(ext['@_cx']) / PptxHandlerRuntime.EMU_PER_PX);
				parentH = Math.round(parseEmuInt(ext['@_cy']) / PptxHandlerRuntime.EMU_PER_PX);
			}
			if (xfrm['@_rot'] !== undefined && xfrm['@_rot'] !== null) {
				const rot = parseInt(String(xfrm['@_rot']), 10) / 60000;
				groupRotation = Number.isFinite(rot) && rot !== 0 ? rot : undefined;
			}
			flipHorizontal = this.parseBooleanAttr(xfrm['@_flipH']);
			flipVertical = this.parseBooleanAttr(xfrm['@_flipV']);
		}

		const grpFillStyle = grpSpPr
			? this.extractShapeStyle(grpSpPr as XmlObject | undefined)
			: undefined;
		const hasGroupFill = grpFillStyle && grpFillStyle.fillMode && grpFillStyle.fillMode !== 'none';

		const children = await this.parseGroupShape(group, baseId, slidePath, rawXmlStr);
		if (children.length === 0) {
			return null;
		}

		// Apply group fill inheritance
		if (hasGroupFill) {
			for (const child of children) {
				if (hasShapeProperties(child) && child.shapeStyle?.fillMode === 'group') {
					child.shapeStyle = {
						...child.shapeStyle,
						fillMode: grpFillStyle.fillMode,
						fillColor: grpFillStyle.fillColor,
						fillOpacity: grpFillStyle.fillOpacity,
						fillGradient: grpFillStyle.fillGradient,
						fillGradientStops: grpFillStyle.fillGradientStops,
						fillGradientAngle: grpFillStyle.fillGradientAngle,
						fillGradientType: grpFillStyle.fillGradientType,
						fillPatternPreset: grpFillStyle.fillPatternPreset,
						fillPatternBackgroundColor: grpFillStyle.fillPatternBackgroundColor,
					};
				}
			}
		}

		// Convert children to group-relative coordinates
		for (const child of children) {
			child.x -= parentX;
			child.y -= parentY;
		}

		const grpCNvPr = (group?.['p:nvGrpSpPr'] as XmlObject | undefined)?.['p:cNvPr'] as
			| XmlObject
			| undefined;
		const grpSlideRels = this.slideRelsMap.get(slidePath);
		const { actionClick: grpActionClick, actionHover: grpActionHover } = this.parseElementActions(
			grpCNvPr,
			grpSlideRels,
			this.orderedSlidePaths,
		);

		// Extract element name from cNvPr/@name (used for morph !! matching)
		const grpElementName = grpCNvPr?.['@_name'] ? String(grpCNvPr['@_name']).trim() : undefined;

		const groupElement: GroupPptxElement = {
			type: 'group',
			id: baseId,
			name: grpElementName || undefined,
			x: parentX,
			y: parentY,
			width: parentW || Math.max(...children.map((c) => c.x + c.width)),
			height: parentH || Math.max(...children.map((c) => c.y + c.height)),
			rotation: groupRotation,
			flipHorizontal: flipHorizontal || undefined,
			flipVertical: flipVertical || undefined,
			children,
			rawXml: group as XmlObject,
			actionClick: grpActionClick,
			actionHover: grpActionHover,
			groupFill: hasGroupFill ? grpFillStyle : undefined,
		};

		return groupElement;
	}

	protected extractGradientFillColor(gradFill: XmlObject): string | undefined {
		return this.colorStyleCodec.extractGradientFillColor(gradFill);
	}
}
