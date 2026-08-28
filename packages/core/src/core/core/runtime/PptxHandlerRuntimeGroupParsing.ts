import {
	TEXT_ORIENTATION_IDENTITY,
	getElementOrientationMatrix,
	isTextOrientationMatrix,
	multiplyTextOrientationMatrices,
} from '../../geometry/transform-utils';
import { XmlObject, PptxElement, hasShapeProperties, hasTextProperties } from '../../types';
import type { GroupPptxElement } from '../../types';
import { xmlPath } from '../../utils/xml-access';
import { findGroupXmlOffset } from './group-child-order';
import type { GroupTransform } from './group-shape-geometry';
import {
	MAX_GROUP_DEPTH,
	parseEmuInt,
	readGroupTransform,
	transformGroupChild,
} from './group-shape-geometry';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSpTreeParsing';
import { parseShapeLockNode, SHAPE_LOCK_CONTAINERS } from './shape-lock-containers';

/** The resolved fill a group hands down to children whose fill is `a:grpFill`. */
type GroupFillStyle = NonNullable<GroupPptxElement['groupFill']>;

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
			this.groupXmlSlice(group, rawXmlStr),
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
					this.applyRawChildGeometry(element, childNode);
					transformGroupChild(element, transform);
					elements.push(element);
				}
			}
		}

		return elements;
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
	private groupXmlSlice(group: XmlObject, rawXmlStr: string | undefined): string | undefined {
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
	 * {@link parseGroupShapeAsGroup} at depth > 0.
	 */
	private applyRawChildGeometry(el: PptxElement, childNode: XmlObject | undefined): void {
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
			el.x = parseEmuInt(off['@_x']) / PptxHandlerRuntime.EMU_PER_PX;
			el.y = parseEmuInt(off['@_y']) / PptxHandlerRuntime.EMU_PER_PX;
		}
		if (ext) {
			el.width = parseEmuInt(ext['@_cx']) / PptxHandlerRuntime.EMU_PER_PX;
			el.height = parseEmuInt(ext['@_cy']) / PptxHandlerRuntime.EMU_PER_PX;
		}
	}

	private applyAncestorGroupTextTransform(
		children: PptxElement[],
		groupTransform: ReturnType<typeof getElementOrientationMatrix>,
	): void {
		for (const child of children) {
			if (child.type === 'group') {
				this.applyAncestorGroupTextTransform(child.children, groupTransform);
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
	private applyGroupFillInheritance(children: PptxElement[], fill: GroupFillStyle): void {
		for (const child of children) {
			if (child.type === 'group') {
				if (!child.groupFill || child.groupFill.fillMode === 'group') {
					this.applyGroupFillInheritance(child.children, fill);
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
	private async resolveGroupFillImage(
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
		const target = this.slideRelsMap.get(slidePath)?.get(relId);
		if (!target) {
			return undefined;
		}
		const fillImageMode = blipFill?.['a:tile'] !== undefined ? 'tile' : 'stretch';
		if (target.startsWith('http://') || target.startsWith('https://')) {
			return this.allowExternalImages === true
				? { fillImageUrl: target, fillImageMode }
				: undefined;
		}
		if (target.startsWith('data:')) {
			return { fillImageUrl: target, fillImageMode };
		}
		const imagePath = this.resolveImagePath(slidePath, target);
		if (!imagePath) {
			return undefined;
		}
		if (this.eagerDecodeImages) {
			const imageData = await this.getImageData(imagePath);
			if (imageData) {
				return { fillImageUrl: imageData, fillImageMode };
			}
		}
		return { fillImageUrl: imagePath, fillImageMode };
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
			const imageFill = await this.resolveGroupFillImage(blipFill, slidePath);
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
			this.applyGroupFillInheritance(children, grpFillStyle);
		}

		if (raw.rotation || raw.flipHorizontal || raw.flipVertical) {
			this.applyAncestorGroupTextTransform(
				children,
				getElementOrientationMatrix({
					rotation: raw.rotation,
					flipHorizontal: raw.flipHorizontal,
					flipVertical: raw.flipVertical,
				}),
			);
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
			locks: grpLocks,
		};

		return groupElement;
	}

	protected extractGradientFillColor(gradFill: XmlObject): string | undefined {
		return this.colorStyleCodec.extractGradientFillColor(gradFill);
	}
}
