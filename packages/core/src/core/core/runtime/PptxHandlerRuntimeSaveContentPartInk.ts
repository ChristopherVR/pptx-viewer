import type {
	ContentPartInkStroke,
	ContentPartPptxElement,
	InkPptxElement,
	XmlObject,
} from '../../types';
import { buildInkMlContent, parseInkMlContent } from '../../utils';
import { ensureXmlChildOrCreate } from '../../utils/xml-access';
import type { SaveSlideContext } from './PptxHandlerRuntimeSaveElementEmbedding';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveModel3D';

const CUSTOM_XML_RELATIONSHIP_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml';
// Verified against PowerPoint's own SaveAs output (see `mc-capabilities.ts`):
// a real ink `p:contentPart` sits inside `mc:Choice Requires="p14"`, and every
// CHILD of `p:contentPart` (nvContentPartPr, cNvPr, cNvContentPartPr, nvPr,
// xfrm) is itself `p14:`-qualified, not `p:`-qualified. Authoring it with the
// `a14` drawing-2010 namespace instead (a real, but unrelated, MC namespace)
// produces a package PowerPoint's own reader treats as corrupted
// ("The file or directory is corrupted and unreadable.", 0x80070570): this
// project's lenient internal reader silently accepted it because the `a14`
// `Requires` declared a namespace no descendant tag actually used, which is
// exactly the gap real PowerPoint's stricter schema validation does not share.
const P14_NAMESPACE = 'http://schemas.microsoft.com/office/powerpoint/2010/main';
const MC_NAMESPACE = 'http://schemas.openxmlformats.org/markup-compatibility/2006';

/** Structural comparison of two decoded stroke lists (paths, colour, geometry). */
function strokeListsEqual(
	left: readonly ContentPartInkStroke[],
	right: readonly ContentPartInkStroke[],
): boolean {
	if (left.length !== right.length) {
		return false;
	}
	return left.every((stroke, index) => {
		const other = right[index];
		return (
			stroke.path === other.path &&
			stroke.color === other.color &&
			stroke.width === other.width &&
			stroke.opacity === other.opacity &&
			(stroke.pressures ?? []).length === (other.pressures ?? []).length
		);
	});
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	private readonly newContentPartFallbackByXml = new Map<XmlObject, XmlObject>();

	/**
	 * Convert a Draw-tab pen/highlighter element (no `rawXml`) into the
	 * standard PresentationML content-part representation PowerPoint's own
	 * pen writes: a `p:contentPart` referencing a related InkML part, wrapped
	 * in `mc:AlternateContent` with a `custGeom` fallback shape. Routes into
	 * the same `createOrUpdateContentPartInkXml` path used for ink parsed back
	 * off disk, so authored strokes round-trip as editable ink rather than
	 * downgrading to a static freeform shape on reload.
	 */
	protected createContentPartInkFromInkElement(
		el: InkPptxElement,
		ctx: SaveSlideContext,
	): XmlObject | undefined {
		const strokes = el.inkPaths.flatMap((path, index) => {
			if (!path.trim()) {
				return [];
			}
			const width = el.inkWidths?.[index] ?? 2;
			const opacity = el.inkOpacities?.[index] ?? 1;
			return [
				{
					path,
					color: el.inkColors?.[index] ?? '#000000',
					width: Number.isFinite(width) && width > 0 ? width : 2,
					opacity: Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1,
					...(el.inkPointPressures?.[index]?.length
						? { pressures: el.inkPointPressures[index] }
						: {}),
				},
			];
		});
		if (strokes.length === 0) {
			return undefined;
		}
		const contentPart: ContentPartPptxElement = {
			...el,
			type: 'contentPart',
			inkStrokes: strokes,
			rawXml: undefined,
		};
		return this.createOrUpdateContentPartInkXml(contentPart, undefined, ctx);
	}

	/** Author or update a p:contentPart and its related InkML package part. */
	protected createOrUpdateContentPartInkXml(
		el: ContentPartPptxElement,
		shape: XmlObject | undefined,
		ctx: SaveSlideContext,
	): XmlObject | undefined {
		if (!el.inkStrokes?.length) {
			if (shape) {
				this.applyContentPartTransform(shape, el);
			}
			return shape;
		}
		let relationshipId = String(shape?.['@_r:id'] ?? '').trim() || undefined;
		let inkPath = el.inkPartPath ?? this.inkPathForRelationship(ctx, relationshipId);
		if (!inkPath) {
			inkPath = ctx.saveSession.nextInkPath();
		} else {
			ctx.saveSession.activateInkPath(inkPath);
		}
		relationshipId ??= ctx.slideRelationshipRegistry.nextRelationshipId();
		ctx.slideRelationshipRegistry.upsertRelationship(
			relationshipId,
			CUSTOM_XML_RELATIONSHIP_TYPE,
			inkPath.replace(/^ppt\//u, '../'),
		);
		// A loaded PowerPoint ink part must survive an untouched save byte for
		// byte. `buildInkMlContent` rebuilds every brush and trace from the model
		// in the library's own authored dialect, which would throw away
		// PowerPoint's difference-encoded traces, its `definitions` block and its
		// brush units on a save that changed nothing about the ink. Only rewrite
		// when the strokes actually differ from what the part decodes to.
		if (!this.inkPartMatchesStrokes(el)) {
			const inkData = buildInkMlContent(el.inkStrokes, el.inkPartRawXml);
			this.zip.file(inkPath, this.builder.build(inkData));
			el.inkPartRawXml = inkData;
		}
		el.inkPartPath = inkPath;

		if (!shape) {
			shape = this.buildContentPartXml(el, relationshipId);
			this.newContentPartFallbackByXml.set(shape, this.buildContentPartFallback(el));
			el.rawXml = shape;
			return shape;
		}
		shape['@_r:id'] = relationshipId;
		this.applyContentPartTransform(shape, el);
		this.updateContentPartFallback(shape, el);
		return shape;
	}

	/** Wrap newly authored content parts with a visible shape fallback. */
	protected wrapNewContentPartEnvelopes(
		spTree: XmlObject,
		contentParts: readonly XmlObject[],
	): void {
		const envelopes: XmlObject[] = [];
		for (const part of contentParts) {
			const fallback = this.newContentPartFallbackByXml.get(part);
			if (!fallback || this.alternateContentBlockByRawXml.has(part)) {
				continue;
			}
			envelopes.push({
				'@_xmlns:mc': MC_NAMESPACE,
				// PowerPoint's own SaveAs declares `xmlns:p14` on the wrapping
				// `mc:AlternateContent`, alongside `xmlns:mc`, not on the nested
				// `mc:Choice`. Both are legal XML (the declaration is in scope
				// either way), but matching the exact placement removes one more
				// variable when a produced file fails to open in real PowerPoint.
				'@_xmlns:p14': P14_NAMESPACE,
				'mc:Choice': {
					'@_Requires': 'p14',
					'p:contentPart': part,
				},
				'mc:Fallback': { 'p:sp': fallback },
			});
		}
		if (envelopes.length === 0) {
			return;
		}
		delete spTree['p:contentPart'];
		const existing = this.ensureArray(spTree['mc:AlternateContent']) as XmlObject[];
		spTree['mc:AlternateContent'] = [...existing, ...envelopes];
	}

	/** True when the loaded ink part still decodes to exactly the model strokes. */
	private inkPartMatchesStrokes(el: ContentPartPptxElement): boolean {
		if (!el.inkPartRawXml || !el.inkStrokes?.length) {
			return false;
		}
		const decoded = parseInkMlContent(el.inkPartRawXml, {
			width: el.width,
			height: el.height,
		}).strokes;
		return strokeListsEqual(decoded, el.inkStrokes);
	}

	private inkPathForRelationship(
		ctx: SaveSlideContext,
		relationshipId: string | undefined,
	): string | undefined {
		if (!relationshipId) {
			return undefined;
		}
		const relationship = ctx.slideRelationships.find(
			(entry) => String(entry['@_Id'] ?? '') === relationshipId,
		);
		const target = String(relationship?.['@_Target'] ?? '');
		if (target.startsWith('../')) {
			return `ppt/${target.slice(3)}`;
		}
		return target.startsWith('ppt/') ? target : undefined;
	}

	private buildContentPartXml(el: ContentPartPptxElement, relationshipId: string): XmlObject {
		const result: XmlObject = {
			'@_r:id': relationshipId,
			'@_p14:bwMode': 'auto',
			'p14:nvContentPartPr': {
				'p14:cNvPr': { '@_id': el.shapeId ?? '2', '@_name': el.name || el.id },
				'p14:cNvContentPartPr': {},
				'p14:nvPr': {},
			},
		};
		this.applyContentPartTransform(result, el);
		return result;
	}

	/**
	 * Write the transform onto whichever `xfrm` key the shape already carries
	 * (`p14:xfrm` for a real PowerPoint-authored or previously-authored part,
	 * legacy `p:xfrm` only defensively), falling back to `p14:xfrm` for a
	 * brand-new content part so it matches PowerPoint's own qualification.
	 */
	private applyContentPartTransform(shape: XmlObject, el: ContentPartPptxElement): void {
		const emu = PptxHandlerRuntime.EMU_PER_PX;
		const xfrmKey = Object.hasOwn(shape, 'p:xfrm') ? 'p:xfrm' : 'p14:xfrm';
		const transform = ensureXmlChildOrCreate(shape, xfrmKey);
		transform['a:off'] = {
			'@_x': String(Math.round(el.x * emu)),
			'@_y': String(Math.round(el.y * emu)),
		};
		transform['a:ext'] = {
			'@_cx': String(Math.round(Math.max(el.width, 1) * emu)),
			'@_cy': String(Math.round(Math.max(el.height, 1) * emu)),
		};
	}

	private buildContentPartFallback(el: ContentPartPptxElement): XmlObject {
		return this.createInkShapeXml(this.asInkElement(el));
	}

	private updateContentPartFallback(shape: XmlObject, el: ContentPartPptxElement): void {
		const block = this.alternateContentBlockByRawXml.get(shape);
		const fallback = block?.rawAc['mc:Fallback'] as XmlObject | undefined;
		if (fallback) {
			fallback['p:sp'] = this.buildContentPartFallback(el);
		}
	}

	private asInkElement(el: ContentPartPptxElement): InkPptxElement {
		return {
			...el,
			type: 'ink',
			inkPaths: el.inkStrokes?.map((stroke) => stroke.path) ?? [],
			inkColors: el.inkStrokes?.map((stroke) => stroke.color),
			inkWidths: el.inkStrokes?.map((stroke) => stroke.width),
			inkOpacities: el.inkStrokes?.map((stroke) => stroke.opacity),
			inkPointPressures: el.inkStrokes?.map((stroke) => stroke.pressures ?? []),
		};
	}
}
