import { XmlObject, PptxElement } from '../../types';
import type { MediaPptxElement } from '../../types';
import { parseDrawingMediaReference } from '../../utils/drawing-media-reference';
import { xmlAttr, xmlChild } from '../../utils/xml-access';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeShapeParsing';

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

			const x = Math.round(parseEmuInt(xmlAttr(off, 'x')) / PptxHandlerRuntime.EMU_PER_PX);
			const y = Math.round(parseEmuInt(xmlAttr(off, 'y')) / PptxHandlerRuntime.EMU_PER_PX);
			const width = Math.round(parseEmuInt(xmlAttr(ext, 'cx')) / PptxHandlerRuntime.EMU_PER_PX);
			const height = Math.round(parseEmuInt(xmlAttr(ext, 'cy')) / PptxHandlerRuntime.EMU_PER_PX);
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
					posterFramePath,
					posterFrameData,
					rawXml: pic,
				} as MediaPptxElement;
			}

			const prstGeom = xmlAttr(xmlChild(effectiveSpPr, 'a:prstGeom'), 'prst');
			const shapeAdjustments = this.parseGeometryAdjustments(
				effectiveSpPr?.['a:prstGeom'] as XmlObject | undefined,
			);
			let shapeType = prstGeom || 'rect';
			let pathData: string | undefined;
			let pathWidth: number | undefined;
			let pathHeight: number | undefined;

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
					svgPath = this.resolveImagePath(slidePath, svgTarget);
					if (this.eagerDecodeImages && svgPath) {
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

			return {
				id,
				name: picElementName || undefined,
				type: 'picture',
				x,
				y,
				width,
				height,
				imageData,
				imagePath,
				svgData,
				svgPath,
				altText: altTextRaw.length > 0 ? altTextRaw : undefined,
				imageEffects: imageEffects || undefined,
				...crop,
				...tileProps,
				shapeType,
				shapeAdjustments,
				adjustmentHandles,
				pathData,
				pathWidth,
				pathHeight,
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
			};
		} catch (e) {
			console.warn(`[pptx] Skipping picture element (${id}):`, e);
			return null;
		}
	}
}
