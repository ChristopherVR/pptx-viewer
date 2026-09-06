import { XmlObject, PptxElement } from '../../types';
import type { MediaPptxElement } from '../../types';
import { cropShapeForPresetGeometry } from '../../utils/crop-shape-geometry';
import { isCNvPrMarkedDecorative } from '../../utils/decorative-extension';
import { parseDrawingMediaReference } from '../../utils/drawing-media-reference';
import { xmlAttr, xmlChild } from '../../utils/xml-access';
import {
	resolveExternalOrPackagePath,
	resolveP14MediaForPicture,
} from './media-p14-extension-resolve';
import { parsePreferRelativeResize } from './picture-non-visual-parse';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeShapeParsing';
import { parseShapeLocksFromNode, SHAPE_LOCK_CONTAINERS } from './shape-lock-containers';

/** EMU values are int32 per ECMA-376 §22.1.2.4. Clamp parsed values to this range. */
const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;

/**
 * Parse a string as a base-10 integer with a finite-number guard and an
 * int32 clamp. Used for attacker-controlled EMU values from XML attributes.
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
	protected async parsePicture(
		pic: XmlObject,
		id: string,
		slidePath: string,
	): Promise<PptxElement | null> {
		try {
			const spPr = pic['p:spPr'] as XmlObject | undefined;
			const placeholderInfo = this.extractPlaceholderInfo(
				(pic?.['p:nvPicPr'] as XmlObject | undefined)?.['p:nvPr'] as XmlObject | undefined,
			);
			const inheritedPlaceholder = placeholderInfo
				? this.findPlaceholderContext(slidePath, placeholderInfo)
				: undefined;
			const inheritedSpPr = (inheritedPlaceholder?.picture?.['p:spPr'] ||
				inheritedPlaceholder?.shape?.['p:spPr']) as XmlObject | undefined;
			const effectiveSpPr = this.mergeXmlObjects(inheritedSpPr, spPr);
			const xfrm = (effectiveSpPr?.['a:xfrm'] || spPr?.['a:xfrm'] || inheritedSpPr?.['a:xfrm']) as
				| XmlObject
				| undefined;
			if (!xfrm) {
				return null;
			}

			const off = xmlChild(xfrm, 'a:off');
			const ext = xmlChild(xfrm, 'a:ext');
			if (!off || !ext) {
				return null;
			}

			// Exact EMU alongside the rounded pixel value; see the matching
			// comment in `PptxHandlerRuntimeShapeParsing.ts` and
			// `xfrm-emu-resolution.ts` for why this is safe to record even from
			// an inherited (placeholder-merged) transform.
			const xEmu = parseEmuInt(xmlAttr(off, 'x'));
			const yEmu = parseEmuInt(xmlAttr(off, 'y'));
			const widthEmu = parseEmuInt(xmlAttr(ext, 'cx'));
			const heightEmu = parseEmuInt(xmlAttr(ext, 'cy'));
			const x = Math.round(xEmu / PptxHandlerRuntime.EMU_PER_PX);
			const y = Math.round(yEmu / PptxHandlerRuntime.EMU_PER_PX);
			const width = Math.round(widthEmu / PptxHandlerRuntime.EMU_PER_PX);
			const height = Math.round(heightEmu / PptxHandlerRuntime.EMU_PER_PX);
			const rotation = xfrm['@_rot'] ? parseEmuInt(xfrm['@_rot']) / 60000 : undefined;
			const skewX = xfrm['@_skewX'] ? parseEmuInt(xfrm['@_skewX']) / 60000 : undefined;
			const skewY = xfrm['@_skewY'] ? parseEmuInt(xfrm['@_skewY']) / 60000 : undefined;
			const { flipHorizontal, flipVertical } = this.readFlipState(xfrm);

			// ── Check if this picture is actually a video/audio placeholder ──
			const nvPr = (pic?.['p:nvPicPr'] as XmlObject | undefined)?.['p:nvPr'] as
				| XmlObject
				| undefined;
			const mediaReference = parseDrawingMediaReference(nvPr, this.externalRelsMap.get(slidePath));

			if (mediaReference) {
				// `p:nvPicPr/p:cNvPr/@descr` / `@title`: the same alt-text pair a
				// picture's own `p:cNvPr` carries (see `altTextRaw` further below).
				// A `p:pic`-shaped media element (real PowerPoint's usual form, as
				// opposed to the SDK's `p:graphicFrame`-shaped media) never read
				// these, so accessibility text authored on a video/audio placeholder
				// was silently dropped on load even though the generic save writer
				// (`applyGraphicFrameAltTextToCnvPr`) already re-emits it for both
				// shapes.
				const mediaCNvPr = (pic?.['p:nvPicPr'] as XmlObject | undefined)?.['p:cNvPr'] as
					| XmlObject
					| undefined;
				const mediaAltText = String(mediaCNvPr?.['@_descr'] || '').trim() || undefined;
				const mediaTitle = String(mediaCNvPr?.['@_title'] || '').trim() || undefined;
				this.compatibilityService.inspectMediaReferenceCompatibility(
					mediaReference.kind,
					slidePath,
					id,
				);
				const mediaRelId = mediaReference.relationshipId;

				let mediaPath: string | undefined;
				let mediaMimeType: string | undefined;
				if (mediaRelId) {
					mediaPath = this.mediaDataParser.resolveRelationshipTarget(slidePath, mediaRelId);
					mediaMimeType = this.mediaDataParser.getMediaMimeType(mediaPath);
				}

				// `p14:media` (G18): read off the picture's own `p:nvPr/p:extLst`,
				// NOT the animation timing tree (see `walkMediaTimingTree` in
				// `PptxHandlerRuntimeMediaTimingParsing.ts`, which no longer reads
				// it), falling back to `@r:embed` when the legacy reference above
				// has no usable path.
				const p14Media = resolveP14MediaForPicture(
					nvPr,
					id,
					(v: unknown) => this.ensureArray(v),
					mediaPath,
					mediaMimeType,
					(relationshipId) =>
						this.mediaDataParser.resolveRelationshipTarget(slidePath, relationshipId),
					(path) => this.mediaDataParser.getMediaMimeType(path),
				);
				mediaPath = p14Media.mediaPath;
				mediaMimeType = p14Media.mediaMimeType;

				// Extract the poster frame from the picture's blipFill
				let posterFramePath: string | undefined;
				let posterFrameData: string | undefined;
				const posterBlipFill = pic['p:blipFill'] as XmlObject | undefined;
				const posterBlip = posterBlipFill?.['a:blip'] as XmlObject | undefined;
				const posterREmbed = posterBlip?.['@_r:embed'];
				const posterRLink = posterBlip?.['@_r:link'];
				const posterRelId = posterREmbed || posterRLink;
				if (posterRelId) {
					const slideRels = this.slideRelsMap.get(slidePath);
					const posterTarget = slideRels?.get(posterRelId);
					if (posterTarget) {
						const isExternal =
							posterTarget.startsWith('http://') || posterTarget.startsWith('https://');
						if (isExternal) {
							// Load H3: external URL gating. Drop unless explicitly allowed.
							if (this.allowExternalImages === true) {
								posterFramePath = posterTarget;
								posterFrameData = posterTarget;
							}
						} else if (posterTarget.startsWith('data:')) {
							posterFramePath = posterTarget;
							posterFrameData = posterTarget;
						} else {
							posterFramePath = this.resolveImagePath(slidePath, posterTarget);
							if (this.eagerDecodeImages && posterFramePath) {
								posterFrameData = await this.getImageData(posterFramePath);
							}
						}
					}
				}

				return {
					id,
					type: 'media',
					x,
					y,
					width,
					height,
					xEmu,
					yEmu,
					widthEmu,
					heightEmu,
					rotation,
					skewX,
					skewY,
					flipHorizontal,
					flipVertical,
					mediaType: mediaReference.mediaType,
					mediaPath,
					mediaMimeType,
					mediaReferenceKind: mediaReference.kind,
					mediaReferenceName: mediaReference.name,
					mediaReferenceContentType: mediaReference.contentType,
					audioCdStart: mediaReference.audioCdStart,
					audioCdEnd: mediaReference.audioCdEnd,
					rawMediaReferenceXml: mediaReference.rawXml,
					isLinked: mediaReference.isLinked,
					trimStartMs: p14Media.trimStartMs,
					trimEndMs: p14Media.trimEndMs,
					fadeInDuration: p14Media.fadeInDuration,
					fadeOutDuration: p14Media.fadeOutDuration,
					playbackSpeed: p14Media.playbackSpeed,
					bookmarks: p14Media.bookmarks,
					posterFramePath,
					posterFrameData,
					...(mediaAltText !== undefined ? { altText: mediaAltText } : {}),
					...(mediaTitle !== undefined ? { title: mediaTitle } : {}),
					...this.readImageCropFromBlipFill(posterBlipFill),
					// Real PowerPoint media is `p:pic`-shaped even though the
					// `media` type buckets as `p:graphicFrame`, so its locks live
					// in `a:picLocks`. The writer resolves the same container from
					// the markup; leaving this unparsed would hand it an empty bag
					// and delete the authored lock on the first save.
					locks: parseShapeLocksFromNode(pic, SHAPE_LOCK_CONTAINERS['p:pic']),
					rawXml: pic,
				} as MediaPptxElement;
			}

			const prstGeom = xmlAttr(xmlChild(effectiveSpPr, 'a:prstGeom'), 'prst');
			const shapeAdjustments = this.parseGeometryAdjustments(
				effectiveSpPr?.['a:prstGeom'] as XmlObject | undefined,
			);
			let shapeType = prstGeom || 'rect';
			const cropShape = xmlChild(effectiveSpPr, 'a:custGeom')
				? undefined
				: cropShapeForPresetGeometry(prstGeom);
			let pathData: string | undefined;
			let pathWidth: number | undefined;
			let pathHeight: number | undefined;
			let customGeometryRawData: ReturnType<typeof this.extractCustomGeometryRawData>;
			let customGeometryAdjustHandlesXY: ReturnType<
				typeof this.extractCustomGeometryAdjustHandles
			>['xy'];
			let customGeometryAdjustHandlesPolar: ReturnType<
				typeof this.extractCustomGeometryAdjustHandles
			>['polar'];
			let customGeometryConnectionSites: ReturnType<
				typeof this.extractCustomGeometryConnectionSites
			>;
			let customGeometryTextRect: ReturnType<typeof this.extractCustomGeometryTextRect>;
			let customGeometryPaths: ReturnType<typeof this.buildStructuredCustomGeometryPaths>;

			const custGeom = effectiveSpPr?.['a:custGeom'];
			if (custGeom) {
				const customPath = this.parseCustomGeometry(
					custGeom as XmlObject | undefined,
					width,
					height,
				);
				if (customPath) {
					shapeType = 'custom';
					pathData = customPath.pathData;
					pathWidth = customPath.pathWidth;
					pathHeight = customPath.pathHeight;
					customGeometryPaths = this.buildStructuredCustomGeometryPaths(
						custGeom as XmlObject,
						customPath.pathWidth,
						customPath.pathHeight,
					);
					customGeometryRawData = this.extractCustomGeometryRawData(custGeom as XmlObject);
					const typedHandles = this.extractCustomGeometryAdjustHandles(custGeom as XmlObject);
					customGeometryAdjustHandlesXY = typedHandles.xy;
					customGeometryAdjustHandlesPolar = typedHandles.polar;
					customGeometryConnectionSites = this.extractCustomGeometryConnectionSites(
						custGeom as XmlObject,
					);
					customGeometryTextRect = this.extractCustomGeometryTextRect(custGeom as XmlObject);
				}
			}

			const picGeomNode =
				(custGeom as XmlObject | undefined) ??
				(effectiveSpPr?.['a:prstGeom'] as XmlObject | undefined);
			const adjustmentHandles = this.parseAdjustmentHandles(
				picGeomNode,
				width,
				height,
				shapeAdjustments,
			);

			// Get image relationship ID
			const blipFill = pic['p:blipFill'] as XmlObject | undefined;
			const blip = blipFill?.['a:blip'] as XmlObject | undefined;
			const rEmbed = blip?.['@_r:embed'];
			const rLink = blip?.['@_r:link'];
			const relId = rEmbed || rLink;
			const crop = this.readImageCropFromBlipFill(blipFill as XmlObject | undefined);

			// Image tiling properties
			const tileNode = (blipFill as XmlObject | undefined)?.['a:tile'] as XmlObject | undefined;
			const tileProps: Record<string, unknown> = {};
			if (tileNode) {
				const txRaw = Number.parseInt(String(tileNode['@_tx'] || ''), 10);
				if (Number.isFinite(txRaw)) {
					tileProps.tileOffsetX = txRaw / PptxHandlerRuntime.EMU_PER_PX;
				}
				const tyRaw = Number.parseInt(String(tileNode['@_ty'] || ''), 10);
				if (Number.isFinite(tyRaw)) {
					tileProps.tileOffsetY = tyRaw / PptxHandlerRuntime.EMU_PER_PX;
				}
				const sxRaw = Number.parseInt(String(tileNode['@_sx'] || ''), 10);
				if (Number.isFinite(sxRaw)) {
					tileProps.tileScaleX = sxRaw / 100000;
				}
				const syRaw = Number.parseInt(String(tileNode['@_sy'] || ''), 10);
				if (Number.isFinite(syRaw)) {
					tileProps.tileScaleY = syRaw / 100000;
				}
				const flipStr = String(tileNode['@_flip'] || '').trim();
				if (flipStr === 'x' || flipStr === 'y' || flipStr === 'xy' || flipStr === 'none') {
					tileProps.tileFlip = flipStr;
				}
				const algnStr = String(tileNode['@_algn'] || '').trim();
				if (algnStr.length > 0) {
					tileProps.tileAlignment = algnStr;
				}
			}

			// Print-resolution hint (`a:blipFill/@dpi`): round-trip only, no
			// on-screen rendering effect. See `PptxImageProperties.dpi`.
			const dpiRaw = Number.parseInt(
				String((blipFill as XmlObject | undefined)?.['@_dpi'] || ''),
				10,
			);
			if (Number.isFinite(dpiRaw) && dpiRaw > 0) {
				tileProps.dpi = dpiRaw;
			}

			this.compatibilityService.inspectPictureCompatibility(
				blipFill as XmlObject | undefined,
				blip as XmlObject | undefined,
				slidePath,
				id,
			);
			this.inspectArtisticEffects(blip as XmlObject | undefined, slidePath, id);
			this.compatibilityService.inspectShapeCompatibility(effectiveSpPr, undefined, slidePath, id);

			// Check for SVG variant in blip extensions and load it
			const svgRelId = this.extractSvgBlipRelId(blip as XmlObject | undefined);
			let svgData: string | undefined;
			let svgPath: string | undefined;
			if (svgRelId) {
				const slideRelsForSvg = this.slideRelsMap.get(slidePath);
				const svgTarget = slideRelsForSvg?.get(svgRelId);
				if (svgTarget) {
					// G17: a LINKED (TargetMode="External") svgBlip variant is an
					// absolute URL, not a package-relative path; resolving it
					// through `resolveImagePath` produces the same nonsense join
					// the primary blip fix below guards against. Mirror that gate.
					const resolvedSvg = resolveExternalOrPackagePath(
						svgTarget,
						this.allowExternalImages === true,
						(target) => this.resolveImagePath(slidePath, target),
					);
					svgPath = resolvedSvg.path;
					svgData = resolvedSvg.data;
					if (!svgData && this.eagerDecodeImages && svgPath) {
						svgData = await this.getImageData(svgPath);
					}
				}
			}

			let imageData: string | undefined;
			let imagePath: string | undefined;
			if (relId) {
				const slideRels = this.slideRelsMap.get(slidePath);
				const target = slideRels?.get(relId);
				if (target) {
					const isExternal = target.startsWith('http://') || target.startsWith('https://');
					if (isExternal) {
						// Load H3: external URL gating. Drop unless explicitly allowed.
						if (this.allowExternalImages === true) {
							imagePath = target;
							imageData = target;
						}
					} else if (target.startsWith('data:')) {
						imagePath = target;
						imageData = target;
					} else {
						imagePath = this.resolveImagePath(slidePath, target);
						if (this.eagerDecodeImages && imagePath) {
							imageData = await this.getImageData(imagePath);
						}
					}
				}
			}

			const styleNode = (pic['p:style'] ||
				inheritedPlaceholder?.picture?.['p:style'] ||
				inheritedPlaceholder?.shape?.['p:style']) as XmlObject | undefined;
			const altTextRaw = String(
				((pic?.['p:nvPicPr'] as XmlObject | undefined)?.['p:cNvPr'] as XmlObject | undefined)?.[
					'@_descr'
				] || '',
			).trim();
			const imageEffects = this.extractImageEffects(blip as XmlObject | undefined);

			// Parse hyperlink / action for the picture element
			const picCNvPr = (pic?.['p:nvPicPr'] as XmlObject | undefined)?.['p:cNvPr'] as
				| XmlObject
				| undefined;
			const picSlideRels = this.slideRelsMap.get(slidePath);
			const { actionClick: picActionClick, actionHover: picActionHover } = this.parseElementActions(
				picCNvPr,
				picSlideRels,
				this.orderedSlidePaths,
			);

			// Extract element name from cNvPr/@name (used for morph !! matching)
			const picElementName = picCNvPr?.['@_name'] ? String(picCNvPr['@_name']).trim() : undefined;

			// Parse locks from p:nvPicPr/p:cNvPicPr/a:picLocks
			const picCNvPicPr = (pic?.['p:nvPicPr'] as XmlObject | undefined)?.['p:cNvPicPr'] as
				| XmlObject
				| undefined;
			const picLocks = this.parseShapeLocks(
				(picCNvPicPr?.['a:picLocks'] ?? picCNvPicPr?.['a:spLocks']) as XmlObject | undefined,
			);

			// `a:cNvPicPr/@preferRelativeResize` (issue G13): a picture-only
			// non-visual property, distinct from `a:picLocks`.
			const preferRelativeResize = parsePreferRelativeResize(
				picCNvPicPr?.['@_preferRelativeResize'],
			);

			// "Mark as decorative" (issue G16): PowerPoint writes
			// `p:cNvPr/a:extLst/a:ext[@uri='{C183D7F6-...}']/adec:decorative`.
			const isDecorative = isCNvPrMarkedDecorative(picCNvPr);

			return {
				id,
				name: picElementName || undefined,
				type: 'picture',
				x,
				y,
				width,
				height,
				xEmu,
				yEmu,
				widthEmu,
				heightEmu,
				imageData,
				imagePath,
				svgData,
				svgPath,
				altText: altTextRaw.length > 0 ? altTextRaw : undefined,
				imageEffects: imageEffects || undefined,
				...crop,
				...tileProps,
				shapeType,
				// "Crop to Shape" is the picture's own preset geometry; surface the
				// typed view only when the preset expresses one (never for custGeom).
				...(cropShape !== undefined ? { cropShape } : {}),
				shapeAdjustments,
				adjustmentHandles,
				pathData,
				pathWidth,
				pathHeight,
				customGeometryPaths,
				customGeometryRawData,
				customGeometryAdjustHandlesXY,
				customGeometryAdjustHandlesPolar,
				customGeometryConnectionSites,
				customGeometryTextRect,
				shapeStyle: this.extractShapeStyle(effectiveSpPr, styleNode),
				rotation,
				skewX,
				skewY,
				flipHorizontal,
				flipVertical,
				rawXml: pic,
				actionClick: picActionClick,
				actionHover: picActionHover,
				locks: picLocks,
				...(preferRelativeResize !== undefined ? { preferRelativeResize } : {}),
				...(isDecorative !== undefined ? { isDecorative } : {}),
			};
		} catch (e) {
			console.warn(`[pptx] Skipping picture element (${id}):`, e);
			return null;
		}
	}
}
