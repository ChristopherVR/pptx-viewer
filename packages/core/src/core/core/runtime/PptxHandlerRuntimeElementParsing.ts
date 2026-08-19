/* oxlint-disable eslint/one-var -- each parse method declares its own
   independent locals; merging unrelated declarations across the many parse
   methods here would hurt readability, not help it. */
import { PptxElement, XmlObject } from '../../types';
import type {
	ContentPartPptxElement,
	MediaPptxElement,
	Model3DPptxElement,
	PptxTableData,
} from '../../types';
import { parseInkMlContent } from '../../utils';
import { normalizePlaceholderIndex } from '../../utils/placeholder-index';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSavePipeline';
import type { PlaceholderInfo } from './PptxHandlerRuntimeTypes';

/**
 * `p:ph/@type` values (CT_Placeholder, lowercased) whose slot carries
 * dedicated formatting (date, footer, header, slide number) rather than
 * authored slide content. These must never absorb an untyped placeholder,
 * even when their `idx` happens to agree with it.
 */
const SPECIAL_PLACEHOLDER_TYPES = new Set(['dt', 'ftr', 'hdr', 'sldnum']);

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Parse media data (video/audio path and MIME type) from graphic frame data.
	 */
	protected parseMediaData(graphicData: XmlObject, slidePath: string): Partial<MediaPptxElement> {
		return this.mediaDataParser.parseMediaData(graphicData, slidePath);
	}

	/**
	 * Parse table cell data from `a:tbl` XML inside a graphic frame.
	 */
	protected parseTableData(graphicData: XmlObject): PptxTableData | undefined {
		return this.tableDataParser.parseTableData(graphicData);
	}

	protected parseGraphicFrame(
		frame: XmlObject,
		id: string,
		slidePath?: string,
	): PptxElement | null {
		return this.graphicFrameParser.parseGraphicFrame(frame, id, slidePath);
	}

	/**
	 * Parse a `p:contentPart` element, typically containing ink strokes
	 * from modern PPTX files. The content-part references an external
	 * XML file via `@_r:id` which contains ink stroke data.
	 */
	protected async parseContentPart(
		contentPart: XmlObject,
		id: string,
		slidePath?: string,
	): Promise<PptxElement | null> {
		try {
			const rId = String(contentPart?.['@_r:id'] || '').trim();
			let inkStrokes: ContentPartPptxElement['inkStrokes'] = [];
			let inkPartPath: string | undefined;
			let inkPartRawXml: XmlObject | undefined;
			// PowerPoint qualifies EVERY child of a real `p:contentPart` with the
			// 2010 `p14` prefix, so reading `p:xfrm` alone sent every genuine ink
			// annotation to the hardcoded 0,0,120x80 default below.
			const xfrm = (contentPart['p14:xfrm'] ?? contentPart['p:xfrm']) as XmlObject | undefined;
			const off = xfrm?.['a:off'] as XmlObject | undefined;
			const ext = xfrm?.['a:ext'] as XmlObject | undefined;

			const rawX = parseInt(String(off?.['@_x'] ?? '0'), 10);
			const rawY = parseInt(String(off?.['@_y'] ?? '0'), 10);
			const rawCx = parseInt(String(ext?.['@_cx'] ?? '0'), 10);
			const rawCy = parseInt(String(ext?.['@_cy'] ?? '0'), 10);

			const x = Number.isFinite(rawX) ? rawX / PptxHandlerRuntime.EMU_PER_PX : 0;
			const y = Number.isFinite(rawY) ? rawY / PptxHandlerRuntime.EMU_PER_PX : 0;
			const width =
				Number.isFinite(rawCx) && rawCx > 0 ? rawCx / PptxHandlerRuntime.EMU_PER_PX : 120;
			const height =
				Number.isFinite(rawCy) && rawCy > 0 ? rawCy / PptxHandlerRuntime.EMU_PER_PX : 80;

			// Attempt to resolve and parse the ink XML part
			if (rId && slidePath) {
				const relsMap = this.slideRelsMap.get(slidePath);
				const inkTarget = relsMap?.get(rId);
				if (inkTarget) {
					inkPartPath = this.resolveImagePath(slidePath, inkTarget);
					const inkXml = await this.zip.file(inkPartPath)?.async('string');
					if (inkXml) {
						const inkData = this.parser.parse(inkXml) as XmlObject;
						const parsed = parseInkMlContent(inkData, { width, height });
						inkStrokes = parsed.strokes;
						inkPartRawXml = parsed.rawXml;
					}
				}
			}

			const nvPr = (contentPart['p14:nvContentPartPr'] ?? contentPart['p:nvContentPartPr']) as
				| XmlObject
				| undefined;
			const cNvPr = (nvPr?.['p14:cNvPr'] ?? nvPr?.['p:cNvPr']) as XmlObject | undefined;
			const shapeId = cNvPr?.['@_id'] === undefined ? undefined : String(cNvPr['@_id']);
			const name = cNvPr?.['@_name'] === undefined ? undefined : String(cNvPr['@_name']);

			return {
				id,
				type: 'contentPart',
				x,
				y,
				width,
				height,
				shapeId,
				name,
				inkStrokes: inkStrokes.length > 0 ? inkStrokes : undefined,
				inkPartPath,
				inkPartRawXml,
				rawXml: contentPart,
			} as ContentPartPptxElement;
		} catch (e) {
			console.warn('Skipping malformed content part:', e);
			return null;
		}
	}

	/**
	 * Parse a `p16:model3D` element — a 3D model object embedded via
	 * mc:AlternateContent in PowerPoint 365+. Extracts transform, model
	 * relationship, and poster/fallback image for display.
	 */
	protected async parseModel3DElement(
		model3d: XmlObject,
		id: string,
		slidePath?: string,
	): Promise<PptxElement | null> {
		try {
			const spPr = (model3d['p16:spPr'] ?? model3d['p:spPr']) as XmlObject | undefined;
			const xfrm = spPr?.['a:xfrm'] as XmlObject | undefined;
			const off = xfrm?.['a:off'] as XmlObject | undefined;
			const ext = xfrm?.['a:ext'] as XmlObject | undefined;

			const rawX = parseInt(String(off?.['@_x'] ?? '0'), 10);
			const rawY = parseInt(String(off?.['@_y'] ?? '0'), 10);
			const rawCx = parseInt(String(ext?.['@_cx'] ?? '0'), 10);
			const rawCy = parseInt(String(ext?.['@_cy'] ?? '0'), 10);

			const x = Number.isFinite(rawX) ? rawX / PptxHandlerRuntime.EMU_PER_PX : 0;
			const y = Number.isFinite(rawY) ? rawY / PptxHandlerRuntime.EMU_PER_PX : 0;
			const width =
				Number.isFinite(rawCx) && rawCx > 0 ? rawCx / PptxHandlerRuntime.EMU_PER_PX : 120;
			const height =
				Number.isFinite(rawCy) && rawCy > 0 ? rawCy / PptxHandlerRuntime.EMU_PER_PX : 80;
			const rotation = xfrm?.['@_rot'] ? parseInt(String(xfrm['@_rot'])) / 60000 : undefined;
			const skewX = xfrm?.['@_skewX'] ? parseInt(String(xfrm['@_skewX']), 10) / 60000 : undefined;
			const skewY = xfrm?.['@_skewY'] ? parseInt(String(xfrm['@_skewY']), 10) / 60000 : undefined;

			let modelPath: string | undefined;
			let modelData: string | undefined;
			let modelMimeType: string | undefined;
			let posterImage: string | undefined;
			let imagePath: string | undefined;
			let imageData: string | undefined;

			if (slidePath) {
				const relsMap = this.slideRelsMap.get(slidePath);

				// Resolve the 3D model binary from relationship
				const modelRId = String(
					(model3d['p16:model3Drel'] as XmlObject | undefined)?.['@_r:id'] ??
						model3d['@_r:embed'] ??
						'',
				).trim();
				if (modelRId && relsMap) {
					const modelTarget = relsMap.get(modelRId);
					if (modelTarget) {
						modelPath = this.resolveImagePath(slidePath, modelTarget);
						const modelExt = modelPath.split('.').pop()?.toLowerCase();
						if (modelExt === 'glb') {
							modelMimeType = 'model/gltf-binary';
						} else if (modelExt === 'gltf') {
							modelMimeType = 'model/gltf+json';
						}
						if (this.eagerDecodeImages) {
							modelData = await this.getImageData(modelPath);
						}
					}
				}

				// Extract poster/preview image from p16:posterImage or blipFill
				const posterNode = model3d['p16:posterImage'] as XmlObject | undefined;
				const posterRId = String(
					posterNode?.['@_r:embed'] ?? posterNode?.['@_r:link'] ?? '',
				).trim();
				if (posterRId && relsMap) {
					const posterTarget = relsMap.get(posterRId);
					if (posterTarget) {
						if (
							posterTarget.startsWith('http://') ||
							posterTarget.startsWith('https://') ||
							posterTarget.startsWith('data:')
						) {
							posterImage = posterTarget;
							imagePath = posterTarget;
							imageData = posterTarget;
						} else {
							const resolvedPoster = this.resolveImagePath(slidePath, posterTarget);
							posterImage = resolvedPoster;
							imagePath = resolvedPoster;
							if (this.eagerDecodeImages && resolvedPoster) {
								imageData = await this.getImageData(resolvedPoster);
								if (imageData) {
									posterImage = imageData;
								}
							}
						}
					}
				}
			}

			return {
				id,
				type: 'model3d',
				x,
				y,
				width,
				height,
				rotation,
				skewX,
				skewY,
				modelPath,
				modelData,
				modelMimeType,
				posterImage,
				imagePath,
				imageData,
				rawXml: model3d,
			} as Model3DPptxElement;
		} catch (e) {
			console.warn('Skipping malformed model3D element:', e);
			return null;
		}
	}

	protected parseConnector(conn: XmlObject, id: string, slidePath?: string): PptxElement | null {
		return this.connectorParser.parseConnector(conn, id, slidePath);
	}

	protected extractPlaceholderInfo(node: XmlObject | undefined): PlaceholderInfo | null {
		if (!node) {
			return null;
		}
		const placeholderNode = node['p:ph'] as XmlObject | undefined;
		if (!placeholderNode) {
			return null;
		}

		const idx = placeholderNode['@_idx'];
		const type = placeholderNode['@_type'];
		const sz = placeholderNode['@_sz'];
		const orientRaw = placeholderNode['@_orient'];
		const hasCustomPromptRaw = placeholderNode['@_hasCustomPrompt'];

		const orient =
			orientRaw !== undefined && String(orientRaw).trim().toLowerCase() === 'vert'
				? 'vert'
				: undefined;

		let hasCustomPrompt: boolean | undefined;
		if (hasCustomPromptRaw !== undefined) {
			const v = String(hasCustomPromptRaw).trim().toLowerCase();
			if (v === '1' || v === 'true') {
				hasCustomPrompt = true;
			} else if (v === '0' || v === 'false') {
				hasCustomPrompt = false;
			}
		}

		return {
			// `idx="4294967295"` is PowerPoint's unsigned encoding of -1: the
			// placeholder has no counterpart on the layout. Erasing it here lets
			// the shape match on `type` instead of chasing an index that cannot
			// exist, which used to fail the lookup and drop the shape outright.
			idx: normalizePlaceholderIndex(idx),
			type: type !== undefined ? String(type).toLowerCase() : undefined,
			sz: sz !== undefined ? String(sz).toLowerCase() : undefined,
			orient,
			hasCustomPrompt,
		};
	}

	protected placeholderMatches(
		source: PlaceholderInfo | null,
		target: PlaceholderInfo | null,
	): boolean {
		if (!source && !target) {
			return true;
		}
		if (!target) {
			return false;
		}
		if (!source) {
			return true;
		}

		const typesMatch =
			source.type === target.type ||
			(source.type === 'ctrtitle' && target.type === 'title') ||
			(source.type === 'subtitle' && target.type === 'body');

		// Per OOXML (CT_Placeholder/@idx), an absent idx defaults to 0. Normalise
		// so a slide placeholder with no idx matches a layout/master placeholder
		// that carries an explicit idx="0" (and vice-versa). idx remains the
		// primary key for multi-instance matching (content areas 1, 2, 3, ...).
		const sourceIdx = source.idx ?? '0';
		const targetIdx = target.idx ?? '0';
		if (sourceIdx !== targetIdx) {
			return false;
		}

		// idx agrees. When both sides carry a type they must be compatible.
		if (source.type && target.type && !typesMatch) {
			return false;
		}

		// A special placeholder (date/footer/header/slide-number) must never bind
		// to an untyped generic placeholder just because their idx happens to
		// agree: ordinary slide content would then inherit that slot's footer/date
		// styling. This overrides the idx-alone trust below.
		if (
			(source.type && SPECIAL_PLACEHOLDER_TYPES.has(source.type) && !target.type) ||
			(target.type && SPECIAL_PLACEHOLDER_TYPES.has(target.type) && !source.type)
		) {
			return false;
		}

		// When only one side has an explicit idx we relied on the default-0
		// above; keep the stricter heuristic that a typed source (e.g. a title)
		// must not bind to an untyped generic placeholder, so it does not swallow
		// the wrong slot. When both sides carry explicit idx values that agree we
		// trust the idx alone (a layout placeholder may omit its type).
		const bothHaveExplicitIdx = source.idx !== undefined && target.idx !== undefined;
		if (!bothHaveExplicitIdx && source.type && !target.type) {
			return false;
		}

		return true;
	}
}
