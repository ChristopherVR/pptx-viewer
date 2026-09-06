import {
	TEXT_ORIENTATION_IDENTITY,
	getElementOrientationMatrix,
	isTextOrientationMatrix,
	multiplyTextOrientationMatrices,
} from '../../geometry/transform-utils';
import { XmlObject, PptxElement, hasShapeProperties, hasTextProperties } from '../../types';
import type { GroupPptxElement } from '../../types';
import { findGroupXmlOffset } from './group-child-order';
import { parseEmuInt } from './group-shape-geometry';

/** The resolved fill a group hands down to children whose fill is `a:grpFill`. */
export type GroupFillStyle = NonNullable<GroupPptxElement['groupFill']>;

/** The instance surface `resolveGroupFillImagePure` needs, named without widening to `any`. */
export interface GroupFillImageHost {
	slideRelsMap: Map<string, Map<string, string>>;
	allowExternalImages: boolean;
	eagerDecodeImages: boolean;
	resolveImagePath(slidePath: string, target: string): string;
	getImageData(imagePath: string): Promise<string | undefined>;
}

/**
 * The slide's raw XML, re-based so it STARTS at this group's `<p:grpSp>`.
 *
 * `extractSpTreeChildOrder` recovers true document order by scanning from
 * the first occurrence of the container tag, which only works when the
 * container is unique in the string. A slide has many `p:grpSp`, so the
 * string is sliced to this one first. Without it the scan is skipped and
 * children come back tag-grouped (all `p:sp`, then all `p:pic`, ...),
 * which restacks the group: see {@link findGroupXmlOffset}.
 *
 * @returns The slice, or `undefined` to let the caller fall back.
 */
export function resolveGroupXmlSlice(
	group: XmlObject,
	rawXmlStr: string | undefined,
): string | undefined {
	if (!rawXmlStr) {
		return undefined;
	}
	const cNvPr = (group['p:nvGrpSpPr'] as XmlObject | undefined)?.['p:cNvPr'] as
		| XmlObject
		| undefined;
	const id = cNvPr?.['@_id'];
	if (id === undefined || id === null) {
		return undefined;
	}
	const offset = findGroupXmlOffset(rawXmlStr, String(id));
	return offset === undefined ? undefined : rawXmlStr.slice(offset);
}

/**
 * A child shape's own `a:xfrm` is expressed in the group's child coordinate
 * space, not EMU. `parseShape` converts it as if it were EMU (dividing by
 * EMU_PER_PX and rounding), so compact child units round to 0. Recover the
 * child's true position/size by re-reading its raw `a:off`/`a:ext` here
 * (unrounded) before the group scale is applied.
 *
 * A nested `p:grpSp` needs no such repair: it is read unrounded by
 * `parseGroupShapeAsGroup` at depth > 0.
 */
export function applyRawChildGeometry(
	el: PptxElement,
	childNode: XmlObject | undefined,
	emuPerPx: number,
): void {
	if (!childNode) {
		return;
	}
	const childXfrm =
		((childNode['p:spPr'] as XmlObject | undefined)?.['a:xfrm'] as XmlObject | undefined) ??
		(childNode['p:xfrm'] as XmlObject | undefined);
	if (!childXfrm) {
		return;
	}
	const off = childXfrm['a:off'] as XmlObject | undefined;
	const ext = childXfrm['a:ext'] as XmlObject | undefined;
	if (off) {
		const xEmu = parseEmuInt(off['@_x']);
		const yEmu = parseEmuInt(off['@_y']);
		el.x = xEmu / emuPerPx;
		el.y = yEmu / emuPerPx;
		// Exact EMU for `resolveXfrmEmu` (xfrm-emu-resolution.ts) to re-emit
		// byte-identical on save when the group and this child are both
		// unedited (1:1 scale, zero chOff -- see the module doc there). A
		// scaled or re-based group naturally fails the equality check this
		// value feeds and falls back to re-quantizing from pixels.
		el.xEmu = xEmu;
		el.yEmu = yEmu;
	}
	if (ext) {
		const widthEmu = parseEmuInt(ext['@_cx']);
		const heightEmu = parseEmuInt(ext['@_cy']);
		el.width = widthEmu / emuPerPx;
		el.height = heightEmu / emuPerPx;
		el.widthEmu = widthEmu;
		el.heightEmu = heightEmu;
	}
}

/** Recursively push an ancestor group's text-orientation transform onto every text descendant. */
export function applyAncestorGroupTextTransform(
	children: PptxElement[],
	groupTransform: ReturnType<typeof getElementOrientationMatrix>,
): void {
	for (const child of children) {
		if (child.type === 'group') {
			applyAncestorGroupTextTransform(child.children, groupTransform);
			continue;
		}
		if (!hasTextProperties(child)) {
			continue;
		}
		const existing = child.textStyle?.ancestorGroupTransform;
		const nestedTransform = isTextOrientationMatrix(existing)
			? existing
			: TEXT_ORIENTATION_IDENTITY;
		child.textStyle = {
			...child.textStyle,
			ancestorGroupTransform: multiplyTextOrientationMatrices(groupTransform, nestedTransform),
		};
	}
}

/**
 * Push a group fill down to every descendant whose own fill is `a:grpFill`
 * ("inherit from my group").
 *
 * `a:grpFill` resolves against the nearest ANCESTOR group that actually has
 * a fill, so the walk descends through a nested group that has none of its
 * own. Two things count as "none of its own", and they are the same two the
 * render side applies in `getGroupChildParentFill` (`pptx-viewer-shared`,
 * `render/group-fill.ts`):
 *
 * - the group declares no fill at all;
 * - the group's own fill is ITSELF `a:grpFill` (`fillMode === 'group'`),
 *   i.e. it inherits too, so the ancestor's fill passes straight through.
 *   Stopping there left the leaves under it carrying an unresolved
 *   `fillMode: 'group'` in the MODEL. Render compensated by chaining, but
 *   the MCP tools, the exporters and the Markdown converter read the model,
 *   not the DOM, so they saw an unpainted shape.
 *
 * A nested group that declares a REAL fill has already resolved its own
 * subtree against that fill, so the walk stops there.
 */
export function applyGroupFillInheritance(children: PptxElement[], fill: GroupFillStyle): void {
	for (const child of children) {
		if (child.type === 'group') {
			if (!child.groupFill || child.groupFill.fillMode === 'group') {
				applyGroupFillInheritance(child.children, fill);
			}
			continue;
		}
		if (hasShapeProperties(child) && child.shapeStyle?.fillMode === 'group') {
			child.shapeStyle = {
				...child.shapeStyle,
				fillMode: fill.fillMode,
				fillColor: fill.fillColor,
				fillOpacity: fill.fillOpacity,
				fillGradient: fill.fillGradient,
				fillGradientStops: fill.fillGradientStops,
				fillGradientAngle: fill.fillGradientAngle,
				fillGradientType: fill.fillGradientType,
				fillPatternPreset: fill.fillPatternPreset,
				fillPatternBackgroundColor: fill.fillPatternBackgroundColor,
				fillImageUrl: fill.fillImageUrl,
				fillImageMode: fill.fillImageMode,
			};
		}
	}
}

/**
 * Resolve a group's own `p:grpSpPr/a:blipFill` (`fillMode: 'image'`) to a
 * displayable `fillImageUrl` plus tiling mode, mirroring the blip
 * resolution `parseShapeWithImageFill` does for a shape's own image fill.
 *
 * Like a picture parsed with `eagerDecodeImages: false`, an unresolved
 * archive-relative path is left in `fillImageUrl` as-is rather than a
 * displayable URL: `ShapeStyle.fillImageUrl` is a single field (unlike
 * `PptxImageProperties.imagePath`/`imageData`'s pair), so there is no
 * lazy-load patch target for it yet. A load pipeline that wants this case
 * resolved must either pass `eagerDecodeImages: true`, or extend the
 * loader's image-path collector to also walk `GroupPptxElement.groupFill`.
 */
export async function resolveGroupFillImagePure(
	host: GroupFillImageHost,
	blipFill: XmlObject | undefined,
	slidePath: string,
): Promise<{ fillImageUrl: string; fillImageMode: 'stretch' | 'tile' } | undefined> {
	const blip = blipFill?.['a:blip'] as XmlObject | undefined;
	const rEmbed = blip?.['@_r:embed'] ? String(blip['@_r:embed']) : undefined;
	const rLink = blip?.['@_r:link'] ? String(blip['@_r:link']) : undefined;
	const relId = rEmbed || rLink;
	if (!relId) {
		return undefined;
	}
	const target = host.slideRelsMap.get(slidePath)?.get(relId);
	if (!target) {
		return undefined;
	}
	const fillImageMode = blipFill?.['a:tile'] !== undefined ? 'tile' : 'stretch';
	if (target.startsWith('http://') || target.startsWith('https://')) {
		return host.allowExternalImages === true ? { fillImageUrl: target, fillImageMode } : undefined;
	}
	if (target.startsWith('data:')) {
		return { fillImageUrl: target, fillImageMode };
	}
	const imagePath = host.resolveImagePath(slidePath, target);
	if (!imagePath) {
		return undefined;
	}
	if (host.eagerDecodeImages) {
		const imageData = await host.getImageData(imagePath);
		if (imageData) {
			return { fillImageUrl: imageData, fillImageMode };
		}
	}
	return { fillImageUrl: imagePath, fillImageMode };
}
