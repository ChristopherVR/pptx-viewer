import { applyCustomGeometryGuideOverrides } from '../../geometry/custom-geometry-guide-writeback';
import { buildSaveTimeCustomGeometryXml } from '../../geometry/custom-geometry-live-eval';
import { filterValidShapeAdjustmentEntries } from '../../geometry/preset-adjustment-validation';
import { hasShapeProperties } from '../../types';
import type {
	XmlObject,
	PptxElement,
	PptxSlide,
	MediaPptxElement,
	PptxImageLikeElement,
	TablePptxElement,
	SmartArtPptxElement,
	ShapePptxElement,
	ImagePptxElement,
	PicturePptxElement,
	ShapeStyle,
} from '../../types';
import { applyDiagramRelationshipIds } from '../../utils/diagram-relationship-ids';
import {
	applyDrawingMediaReference,
	parseDrawingMediaReference,
} from '../../utils/drawing-media-reference';
import { ensureXmlChild } from '../../utils/xml-access';
import type { PptxSaveState, IPptxSlideRelationshipRegistry } from '../builders';
import type { GroupChildSpaceOwner } from './group-xfrm-preservation';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveTextWriter';

/** Context passed to per-element save processing. */
export interface SaveSlideContext {
	readonly slide: PptxSlide;
	readonly slideRelationships: XmlObject[];
	readonly slideRelationshipRegistry: IPptxSlideRelationshipRegistry;
	readonly resolveHyperlinkRelationshipId: (target: string) => string | undefined;
	readonly getSlideRelationshipMap: () => Map<string, string>;
	readonly resolvedMediaBytes: Map<string, { bytes: Uint8Array; extension: string }>;
	readonly saveSession: PptxSaveState;
	readonly slideImageRelationshipType: string;
	readonly slideMediaRelationshipType: string;
	readonly slideVideoRelationshipType: string;
	readonly slideAudioRelationshipType: string;
	/**
	 * The fill the enclosing group hands down to an `<a:grpFill/>` child, set
	 * only while serialising the children of a group (the group writer derives
	 * it per nesting level). Lets the fill writer re-emit authored `a:grpFill`
	 * instead of the colour the load pass resolved onto the child. Absent for a
	 * top-level element.
	 */
	readonly inheritedGroupFill?: ShapeStyle;
	/**
	 * The ENCLOSING group itself (the immediate parent whose children are
	 * currently being serialised), which already carries the
	 * `GroupChildSpaceOwner` shape `group-xfrm-preservation.ts` needs (its
	 * captured `a:chOff`/`a:chExt` paired with its OWN immutable
	 * `widthEmu`/`heightEmu`). Set only
	 * while serialising the direct children of a group (recomputed at each
	 * nesting level in `buildGroupShapeXml`, never inherited from an outer
	 * group), so `elementTransformUpdater.applyTransform` can invert this
	 * element's CURRENT relative-to-group geometry back into that space (its
	 * exact original child-space `a:off`/`a:ext` EMU verbatim when unchanged,
	 * otherwise the inverse of the parse-time mapping) instead of
	 * `resolveXfrmEmu`'s ordinary (parent-space) comparison. Absent for a
	 * top-level element, where there is no child space to preserve; also
	 * absent (or with no captured chOff/chExt) for a group with none of its
	 * own, in which case `invertChildIntoGroupSpace` returns `undefined` and
	 * the ordinary comparison applies.
	 */
	readonly preserveGroupChildSpace?: GroupChildSpaceOwner;
}

function getMediaReferenceContainer(shape: XmlObject | undefined): XmlObject | undefined {
	if (!shape) {
		return undefined;
	}
	const nvPr = (shape['p:nvPicPr'] as XmlObject | undefined)?.['p:nvPr'] as XmlObject | undefined;
	if (nvPr) {
		return nvPr;
	}
	return (shape['a:graphic'] as XmlObject | undefined)?.['a:graphicData'] as XmlObject | undefined;
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/** Serialize table, chart, and SmartArt data when applicable. */
	protected applyDataSerialization(shape: XmlObject, el: PptxElement, slideId: string): void {
		if (el.type === 'table' && 'tableData' in el && (el as TablePptxElement).tableData) {
			this.serializeTableDataToXml(shape, (el as TablePptxElement).tableData!);
		}
		if (el.type === 'chart' && 'chartData' in el && el.chartData) {
			this.serializeChartDataToXml(el.chartData, slideId);
		}
		if (el.type === 'smartArt' && 'smartArtData' in el) {
			const saEl = el as SmartArtPptxElement;
			if (saEl.smartArtData?.dataRelId) {
				applyDiagramRelationshipIds(shape, saEl.smartArtData);
				this.serializeSmartArtDataToXml(saEl, slideId);
			}
		}
	}

	/** Apply image crop, effects, and alt text for picture/image elements. */
	protected applyImageProperties(shape: XmlObject, el: PptxElement): void {
		if (el.type !== 'picture' && el.type !== 'image') {
			return;
		}
		const pictureBlipFill =
			(shape['p:blipFill'] as XmlObject | undefined) ||
			((shape['p:spPr'] as XmlObject | undefined)?.['a:blipFill'] as XmlObject | undefined);
		this.applyImageCropToBlipFill(pictureBlipFill, el);
		this.applyImageEffectsToBlip(pictureBlipFill, el.imageEffects);
		const cNvPrNode = (shape?.['p:nvPicPr'] as XmlObject | undefined)?.['p:cNvPr'] as
			| XmlObject
			| undefined;
		if (cNvPrNode) {
			const altText = String((el as PptxImageLikeElement).altText || '').trim();
			if (altText.length > 0) {
				cNvPrNode['@_descr'] = altText;
			} else {
				delete cNvPrNode['@_descr'];
			}
		}
	}

	/** Apply geometry preset or custom paths to spPr. */
	protected applyGeometryUpdate(shape: XmlObject, el: PptxElement): void {
		if (!hasShapeProperties(el)) {
			return;
		}
		// `<p:spPr/>` parses to the empty STRING, which a truthiness test reads as
		// absent; the custom-geometry write below then vanished, so a shape edited
		// into a freeform saved with its original geometry. See `ensureXmlChild`.
		const spPr = ensureXmlChild(shape, 'p:spPr');
		if (!spPr) {
			return;
		}
		const elWithPaths = el as ShapePptxElement | ImagePptxElement | PicturePptxElement;
		if (elWithPaths.customGeometryPaths && elWithPaths.customGeometryPaths.length > 0) {
			delete spPr['a:prstGeom'];
			// Re-derives a:pathLst from raw XML at the current shapeAdjustments so
			// it agrees with the a:avLst write below; see buildSaveTimeCustomGeometryXml.
			const custGeomXml = buildSaveTimeCustomGeometryXml(elWithPaths, el.shapeAdjustments);
			// Edited custGeom adjust handles live in `shapeAdjustments`; write them
			// back into `a:avLst` so the freeform keeps its dragged handle values.
			spPr['a:custGeom'] = applyCustomGeometryGuideOverrides(custGeomXml, el.shapeAdjustments);
		} else if (spPr['a:prstGeom']) {
			const presetGeometry =
				el.type === 'connector'
					? this.normalizePresetGeometry(el.shapeType || 'straightConnector1')
					: this.normalizePresetGeometry(el.shapeType);
			const prstGeom = spPr['a:prstGeom'] as XmlObject;
			prstGeom['@_prst'] = presetGeometry;
			if (el.shapeAdjustments) {
				// A `<a:gd>` name PowerPoint doesn't recognise for the RESOLVED preset
				// (e.g. `adj1` on `homePlate`, which only defines `adj`) makes the
				// whole file unopenable ("The file or directory is corrupted and
				// unreadable", 0x80070570), COM-verified, even though the XML is
				// otherwise schema-valid. `shapeAdjustments` is caller-supplied
				// (`ShapeBuilder.adjustments()` takes an arbitrary record with no
				// guardrails), so it must be filtered to this preset's real guide
				// names before it reaches the saved file; see
				// `filterValidShapeAdjustmentEntries` for the COM evidence.
				const entries = filterValidShapeAdjustmentEntries(presetGeometry, el.shapeAdjustments);
				if (entries.length < Object.keys(el.shapeAdjustments).length) {
					this.compatibilityService.reportWarning({
						code: 'SAVE_SHAPE_ADJUSTMENT_INVALID_GUIDE',
						message: `Shape '${el.id}' (preset '${presetGeometry}') had one or more shapeAdjustments keys that are not valid adjustment guides for this preset; they were dropped to avoid producing a file PowerPoint cannot open.`,
						scope: 'element',
						elementId: el.id,
					});
				}
				if (entries.length > 0) {
					prstGeom['a:avLst'] = {
						'a:gd': entries.map(([name, value]) => ({
							'@_name': name,
							'@_fmla': `val ${Math.round(value)}`,
						})),
					};
				} else if (!prstGeom['a:avLst']) {
					prstGeom['a:avLst'] = {};
				}
			} else if (!prstGeom['a:avLst']) {
				prstGeom['a:avLst'] = {};
			}
		}
	}

	/** Embed image data and create relationships for picture/image elements. */
	protected processImageEmbedding(
		el: PptxImageLikeElement,
		shape: XmlObject | undefined,
		ctx: SaveSlideContext,
	): XmlObject | undefined {
		const parsedImage = this.parseDataUrlToBytes(el.imageData!);
		if (parsedImage) {
			let targetImagePath = el.imagePath;
			if (!targetImagePath) {
				targetImagePath = ctx.saveSession.nextMediaPath(parsedImage.extension);
				const relationshipId = ctx.slideRelationshipRegistry.nextRelationshipId();
				const relativeMediaPath = targetImagePath.replace(/^ppt\//u, '../');
				ctx.slideRelationships.push({
					'@_Id': relationshipId,
					'@_Type': ctx.slideImageRelationshipType,
					'@_Target': relativeMediaPath,
				});
				shape = this.createPictureXml(el, relationshipId);
			}
			if (targetImagePath) {
				// Never write bytes of one format into a file with a different
				// extension. EMF/WMF parts are converted to PNG data URLs at
				// load time so the browser can render them; if we blindly wrote
				// those PNG bytes back to `image*.emf`, PowerPoint's GDI
				// metafile parser would reject the PNG signature with
				// ERROR_FILE_CORRUPT (0x80070570) and show the repair dialog.
				// The original metafile bytes are still in the zip from load,
				// so skipping the overwrite preserves them verbatim.
				const targetExt = targetImagePath.toLowerCase().match(/\.(?<ext>[^./\\]+)$/u)?.groups?.[
					'ext'
				];
				const parsedExt = parsedImage.extension.toLowerCase();
				const extensionMismatch =
					targetExt !== undefined &&
					targetExt !== parsedExt &&
					!(targetExt === 'jpg' && parsedExt === 'jpeg') &&
					!(targetExt === 'jpeg' && parsedExt === 'jpg');
				if (!extensionMismatch) {
					this.zip.file(targetImagePath, parsedImage.bytes);
				}
			}
		} else {
			this.compatibilityService.reportWarning({
				code: 'SAVE_IMAGE_PAYLOAD_UNSUPPORTED',
				message:
					'Image payload could not be converted to an embedded media part. Original image linkage was preserved when possible.',
				scope: 'save',
				slideId: ctx.slide.id,
				elementId: el.id,
			});
		}
		return shape;
	}

	/** Embed media data and manage relationships for media elements. */
	protected processMediaEmbedding(
		mediaElement: MediaPptxElement,
		shape: XmlObject | undefined,
		ctx: SaveSlideContext,
	): XmlObject | undefined {
		const mediaType = mediaElement.mediaType === 'audio' ? 'audio' : 'video';
		const originalReference = parseDrawingMediaReference(getMediaReferenceContainer(shape));
		let mediaRelationshipId =
			originalReference?.relationshipId ??
			this.slideMediaRelationshipBuilder.getMediaRelationshipIdFromShape(shape);
		const relTypes = {
			media: ctx.slideMediaRelationshipType,
			video: ctx.slideVideoRelationshipType,
			audio: ctx.slideAudioRelationshipType,
		};

		if (typeof mediaElement.mediaData === 'string') {
			const parsedMedia =
				ctx.resolvedMediaBytes.get(mediaElement.id) ??
				this.parseDataUrlToBytes(mediaElement.mediaData);
			if (parsedMedia) {
				let targetMediaPath = mediaElement.mediaPath;
				if (!targetMediaPath) {
					targetMediaPath = ctx.saveSession.nextMediaPath(parsedMedia.extension, mediaType);
				}
				this.zip.file(targetMediaPath, parsedMedia.bytes);
				const relationshipTarget = targetMediaPath.replace(/^ppt\//u, '../');
				if (!mediaRelationshipId) {
					mediaRelationshipId = ctx.slideRelationshipRegistry.nextRelationshipId();
				}
				// Embedded media (bytes written into the package) must use the
				// generic `media` relationship type regardless of media kind. The
				// type-specific `video`/`audio` types are for *externally linked*
				// media with TargetMode="External"; using them for embedded parts
				// makes the relationship schema-invalid and causes PowerPoint to
				// reject the file.
				ctx.slideRelationshipRegistry.upsertRelationship(
					mediaRelationshipId,
					relTypes.media,
					relationshipTarget,
				);
				if (!shape) {
					shape = this.createMediaGraphicFrameXml(mediaElement, mediaRelationshipId);
				} else if (getMediaReferenceContainer(shape)) {
					applyDrawingMediaReference(
						getMediaReferenceContainer(shape)!,
						mediaElement,
						mediaRelationshipId,
					);
				} else {
					this.slideMediaRelationshipBuilder.ensureGraphicFrameMediaReference(
						shape,
						mediaType,
						mediaRelationshipId,
					);
				}
				mediaElement.mediaPath = targetMediaPath;
				mediaElement.mediaMimeType =
					this.getMediaMimeType(targetMediaPath) || mediaElement.mediaMimeType;
			} else {
				this.compatibilityService.reportWarning({
					code: 'SAVE_MEDIA_PAYLOAD_UNSUPPORTED',
					message:
						'Media payload could not be converted to an embedded media part. Original media linkage was preserved when possible.',
					scope: 'save',
					slideId: ctx.slide.id,
					elementId: mediaElement.id,
				});
			}
		} else if (
			!shape &&
			typeof mediaElement.mediaPath === 'string' &&
			mediaElement.mediaPath.length > 0
		) {
			const relationshipTarget = mediaElement.mediaPath.replace(/^ppt\//u, '../');
			mediaRelationshipId ||= ctx.slideRelationshipRegistry.nextRelationshipId();
			// Linked media (external URL, isLinked=true) uses the type-specific
			// relationship. Package-internal paths (isLinked falsy) use `media`.
			const pathRelType = mediaElement.isLinked
				? this.slideMediaRelationshipBuilder.resolveMediaRelationshipType(mediaType, relTypes)
				: relTypes.media;
			ctx.slideRelationshipRegistry.upsertRelationship(
				mediaRelationshipId,
				pathRelType,
				relationshipTarget,
			);
			shape = this.createMediaGraphicFrameXml(mediaElement, mediaRelationshipId);
		}
		if (!shape && mediaElement.mediaReferenceKind === 'audioCd') {
			shape = this.createMediaGraphicFrameXml(mediaElement, '');
		}
		const referenceContainer = getMediaReferenceContainer(shape);
		if (referenceContainer) {
			applyDrawingMediaReference(referenceContainer, mediaElement, mediaRelationshipId);
		}
		return shape;
	}
}
