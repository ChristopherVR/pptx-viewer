import { getElementOrientationMatrix } from '../../geometry/transform-utils';
import { XmlObject, PptxElement } from '../../types';
import type { GroupPptxElement } from '../../types';
import { xmlPath } from '../../utils/xml-access';
import {
	applyAncestorGroupTextTransform,
	applyGroupFillInheritance,
	applyRawChildGeometry,
	resolveGroupFillImagePure,
	resolveGroupXmlSlice,
} from './group-parsing-helpers';
import type { GroupFillImageHost } from './group-parsing-helpers';
import type { GroupTransform } from './group-shape-geometry';
import { MAX_GROUP_DEPTH, readGroupTransform, transformGroupChild } from './group-shape-geometry';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSpTreeParsing';
import { parseShapeLockNode, SHAPE_LOCK_CONTAINERS } from './shape-lock-containers';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Parse the children of a `<p:grpSp>` into the group's own pixel space.
	 *
	 * A nested `<p:grpSp>` becomes a nested {@link GroupPptxElement}, NOT a
	 * flattened run of its descendants. Flattening kept the content but
	 * destroyed the wrapper: its `p:cNvPr/@name`, its `p:grpSpPr` fill and
	 * locks, its animation identity and the user-visible grouping all vanished
	 * from the saved file, silently degrading a two-level group into one.
	 */
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
		const transform = readGroupTransform(grpSpPr?.['a:xfrm'], PptxHandlerRuntime.EMU_PER_PX);

		this.unwrapAlternateContent(group as Record<string, unknown>);

		const childOrder = this.extractSpTreeChildOrder(
			resolveGroupXmlSlice(group, rawXmlStr),
			group as Record<string, unknown>,
			'p:grpSp',
		);
		const elements: PptxElement[] = [];

		for (const entry of childOrder) {
			if (entry.tag === 'p:grpSp') {
				const subGroup = this.ensureArray(group['p:grpSp'])[entry.indexInType] as
					| XmlObject
					| undefined;
				if (!subGroup) {
					continue;
				}
				const nested = await this.parseGroupShapeAsGroup(
					subGroup,
					`${baseId}-group-${entry.indexInType}`,
					slidePath,
					rawXmlStr,
					depth + 1,
				);
				if (nested) {
					transformGroupChild(nested, transform);
					elements.push(nested);
				}
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
					applyRawChildGeometry(element, childNode, PptxHandlerRuntime.EMU_PER_PX);
					transformGroupChild(element, transform);
					elements.push(element);
				}
			}
		}

		return elements;
	}

	/**
	 * Parse a p:grpSp element into a GroupPptxElement with children.
	 * Children have coordinates relative to the group's position.
	 *
	 * `depth` is the group's nesting level: 0 for a `<p:spTree>` child. Only a
	 * top-level group rounds its transform to whole pixels; a nested one stays
	 * unrounded, because its parent is still going to map it through
	 * `ext / chExt` and rounding first collapses a compact child space to 0.
	 */
	protected override async parseGroupShapeAsGroup(
		group: XmlObject,
		baseId: string,
		slidePath: string,
		rawXmlStr?: string,
		depth: number = 0,
	): Promise<PptxElement | null> {
		const grpSpPr = group['p:grpSpPr'] as XmlObject | undefined;
		const raw: GroupTransform = readGroupTransform(
			grpSpPr?.['a:xfrm'],
			PptxHandlerRuntime.EMU_PER_PX,
		);
		const round = depth === 0 ? Math.round : (value: number) => value;
		const parentX = round(raw.parentX);
		const parentY = round(raw.parentY);
		const parentW = round(raw.parentW);
		const parentH = round(raw.parentH);

		const grpFillStyle = grpSpPr
			? this.extractShapeStyle(grpSpPr as XmlObject | undefined)
			: undefined;
		// `extractShapeStyle` only records `fillMode: 'image'` for a group's own
		// `p:grpSpPr/a:blipFill` - it has no zip/relationship access, so the blip
		// itself (r:embed/r:link) is resolved here, mirroring the identical
		// resolution `parseShapeWithImageFill` does for a shape's own image fill.
		// PowerPoint's own UI never authors this (a group's Format Shape fill
		// applies to its CHILDREN via `a:grpFill`, not to the group's own box),
		// but a hand-authored or tool-authored deck can, and the fill was
		// silently dropped: `fillImageUrl` stayed unresolved even though
		// `fillMode` claimed 'image'.
		if (grpFillStyle?.fillMode === 'image' && grpSpPr) {
			const blipFill = grpSpPr['a:blipFill'] as XmlObject | undefined;
			const imageFill = await resolveGroupFillImagePure(
				this as unknown as GroupFillImageHost,
				blipFill,
				slidePath,
			);
			if (imageFill) {
				grpFillStyle.fillImageUrl = imageFill.fillImageUrl;
				grpFillStyle.fillImageMode = imageFill.fillImageMode;
			}
		}
		const hasGroupFill = grpFillStyle && grpFillStyle.fillMode && grpFillStyle.fillMode !== 'none';

		const children = await this.parseGroupShape(group, baseId, slidePath, rawXmlStr, depth);
		if (children.length === 0) {
			return null;
		}

		// Only a fill that RESOLVES to paint can be pushed down. A group whose
		// own fill is `a:grpFill` inherits from its own ancestor, so its subtree
		// is left for that ancestor's pass to resolve (see
		// {@link applyGroupFillInheritance}); pushing the group-mode style down
		// here would just re-stamp `fillMode: 'group'` on the leaves.
		if (hasGroupFill && grpFillStyle.fillMode !== 'group') {
			applyGroupFillInheritance(children, grpFillStyle);
		}

		if (raw.rotation || raw.flipHorizontal || raw.flipVertical) {
			applyAncestorGroupTextTransform(
				children,
				getElementOrientationMatrix({
					rotation: raw.rotation,
					flipHorizontal: raw.flipHorizontal,
					flipVertical: raw.flipVertical,
				}),
			);
		}

		// Convert children to group-relative coordinates.
		//
		// Subtracts the UNROUNDED `raw.parentX`/`raw.parentY`, not the rounded
		// `parentX`/`parentY` computed above for the group's OWN `x`/`y` field.
		// `parseGroupShape` (called just above) already placed every child via
		// `transformGroupChild`, which adds the group's UNROUNDED `parentX`/
		// `parentY` (freshly read via its own `readGroupTransform` call) as the
		// translation term. Subtracting the ROUNDED value here instead leaves a
		// residual of up to +/-0.5px baked into every child's relative
		// coordinate (`unrounded - rounded`), invisible at render time (the
		// group's own rounded position and the residual cancel back out to the
		// exact original absolute pixel value when composited), but it breaks
		// the invariant `group-xfrm-preservation.ts`'s `isGroupChildUnchanged`
		// depends on: that "the value subtracted from a child IS `group.x`".
		// The residual is usually small enough not to cross a rounding
		// boundary, but a compounding one (e.g. a `p:grpSp` nested inside this
		// group, whose OWN relativization runs the same arithmetic on top of
		// this group's residual) can cross it, permanently defeating
		// byte-identical save for that nested group's children even though
		// nothing moved. See `xfrm-emu-precision-roundtrip.test.ts`'s
		// "nested/scaled groups" describe block.
		for (const child of children) {
			child.x -= raw.parentX;
			child.y -= raw.parentY;
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

		// `a:grpSpLocks` hangs off `p:cNvGrpSpPr`, not `p:grpSpPr`. Reading it is
		// what makes the save side safe: the writer treats a missing
		// `element.locks` as "the user cleared the locks" and deletes the node,
		// so a lock that is never parsed would be erased on the first save.
		const grpLocks = parseShapeLockNode(
			xmlPath(group, 'p:nvGrpSpPr', 'p:cNvGrpSpPr', 'a:grpSpLocks'),
			SHAPE_LOCK_CONTAINERS['p:grpSp'],
		);

		const groupElement: GroupPptxElement = {
			type: 'group',
			id: baseId,
			name: grpElementName || undefined,
			x: parentX,
			y: parentY,
			width: parentW || Math.max(...children.map((c) => c.x + c.width)),
			height: parentH || Math.max(...children.map((c) => c.y + c.height)),
			// Exact EMU for `resolveXfrmEmu` (xfrm-emu-resolution.ts) to re-emit
			// byte-identical on save for an unmoved/unresized TOP-LEVEL group.
			// `width`/`height` fall back to a computed bounding box when the
			// group carries no usable `a:ext` (`parentW`/`parentH` are 0), in
			// which case there is no exact source EMU either.
			//
			// A NESTED group (depth > 0) is also a "child" of its ancestor: its
			// x/y/width/height get rebased by `transformGroupChild` just like a
			// leaf shape's, so this value legitimately fails `resolveXfrmEmu`'s
			// equality check whenever the ancestor uses PowerPoint's common
			// `a:chOff == a:off` ("children keep slide-absolute coordinates")
			// authoring convention -- see `applyRawChildGeometry`'s comment and
			// `xfrm-emu-precision-roundtrip.test.ts`'s module doc.
			xEmu: raw.parentXEmu,
			yEmu: raw.parentYEmu,
			widthEmu: parentW ? raw.parentWEmu : undefined,
			heightEmu: parentH ? raw.parentHEmu : undefined,
			// Exact EMU for the group's own `a:chOff`/`a:chExt` (the CHILDREN's
			// coordinate space), for `group-xfrm-preservation.ts` to decide
			// whether an unmodified group can re-emit its original child space
			// byte-identical instead of the normalized `chOff 0,0` / `chExt ==
			// ext` space `save-group-shape-xml.ts` falls back to. `chExtWidthEmu`/
			// `chExtHeightEmu` are gated on `chW`/`chH` (mirroring the
			// `widthEmu`/`heightEmu` gate above) since a zero `chExt` has no real
			// source ext to re-emit either.
			chOffXEmu: raw.chOffXEmu,
			chOffYEmu: raw.chOffYEmu,
			chExtWidthEmu: raw.chW > 0 ? raw.chExtWEmu : undefined,
			chExtHeightEmu: raw.chH > 0 ? raw.chExtHEmu : undefined,
			// Group-level rotation/flip live on `p:grpSpPr/a:xfrm` and must be
			// carried onto the GroupPptxElement so the renderer can wrap the
			// whole group in a single rotate/flip transform (issue #70).
			rotation: raw.rotation,
			flipHorizontal: raw.flipHorizontal || undefined,
			flipVertical: raw.flipVertical || undefined,
			children,
			rawXml: group as XmlObject,
			actionClick: grpActionClick,
			actionHover: grpActionHover,
			groupFill: hasGroupFill ? grpFillStyle : undefined,
			// The SAME `extractShapeStyle` result as `groupFill`, but kept whenever
			// `p:grpSpPr` exists at all, regardless of whether it resolved to a
			// paintable fill. `groupFill` is gated on `hasGroupFill` because
			// `getGroupChildParentFill`/`groupChildInheritedFill` (the `a:grpFill`
			// inheritance chain) must keep chaining through an ancestor's fill
			// when THIS group has none of its own - a group whose `p:grpSpPr`
			// authors only `a:effectLst/a:reflection` (no fill) still needs that
			// reflection to reach the renderer (`getComputedEffectStyle` reads
			// this field, never `groupFill`, for exactly that reason), but must
			// not be mistaken for "this group has a fill to hand down".
			groupEffectStyle: grpFillStyle,
			locks: grpLocks,
		};

		return groupElement;
	}

	protected extractGradientFillColor(gradFill: XmlObject): string | undefined {
		return this.colorStyleCodec.extractGradientFillColor(gradFill);
	}
}
