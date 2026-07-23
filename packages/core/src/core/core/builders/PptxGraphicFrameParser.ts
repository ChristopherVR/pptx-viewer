import type {
	InkPptxElement,
	MediaPptxElement,
	OlePptxElement,
	PptxElement,
	PptxGraphicFrameExtension,
	PptxTableData,
	TablePptxElement,
	XmlObject,
} from '../../types';
import { detectOleObjectType, inferOleExtensionFromTarget } from '../../utils/ole-utils';

/**
 * Recognised `a:graphicData/a:extLst/a:ext` URIs that map to first-class
 * element types and therefore should NOT be captured as opaque extensions.
 * Anything else (e.g. `p15:` future-feature extensions) is preserved
 * verbatim on the typed element via `extensionXml` so it can round-trip.
 */
const KNOWN_GRAPHIC_FRAME_EXT_URIS = new Set<string>([
	// Office 365+ 3D model envelope; handled by parseModel3DElement.
	'{D42C27E5-1956-4C4D-AC15-FE9D03D7D63E}',
]);

function ensureArrayLike<T>(value: T | T[] | undefined): T[] {
	if (value === undefined || value === null) {
		return [];
	}
	return Array.isArray(value) ? value : [value];
}

/**
 * Walk `<a:graphicData>/<a:extLst>/<a:ext>` and capture each unrecognised
 * extension verbatim so the save layer can re-emit it.
 *
 * Recognised URIs (currently the 3D model envelope) are skipped because
 * dedicated parsers already model them; all other extensions are captured
 * with their full XML so future-feature markup (e.g. `p15:` extensions)
 * survives the round-trip.
 */
export function collectGraphicFrameExtensions(
	graphicData: XmlObject | undefined,
): PptxGraphicFrameExtension[] {
	if (!graphicData) {
		return [];
	}
	const extLst = graphicData['a:extLst'] as XmlObject | undefined;
	if (!extLst) {
		return [];
	}
	const exts = ensureArrayLike(extLst['a:ext'] as XmlObject | XmlObject[] | undefined);
	const captured: PptxGraphicFrameExtension[] = [];
	for (const ext of exts) {
		const uri = String(ext?.['@_uri'] ?? '').trim();
		if (uri.length === 0) {
			continue;
		}
		if (KNOWN_GRAPHIC_FRAME_EXT_URIS.has(uri)) {
			continue;
		}
		captured.push({ uri, xml: ext });
	}
	return captured;
}

/**
 * Parse a single `aink:trace` payload into an SVG path string.
 *
 * The `aink:trace` element from Office 2010+ ink (`aink` namespace) carries
 * a whitespace-separated list of `x,y` point pairs as element text content.
 * The first pair becomes an `M` (moveto) and subsequent pairs become `L`
 * (lineto) commands. Returns `undefined` when the payload yields no usable
 * points.
 */
export function parseAinkTraceText(raw: string): string | undefined {
	const cleaned = raw.replace(/\s+/g, ' ').trim();
	if (cleaned.length === 0) {
		return undefined;
	}
	// Split on whitespace; each token should be an `x,y` pair. Tolerate a
	// few formatting variants: comma- or space-separated, and leading
	// command letters (`M`/`L`) carried over from earlier conversions.
	const tokens = cleaned.split(/\s+/);
	const coords: Array<{ x: number; y: number }> = [];
	for (const token of tokens) {
		const cleanedToken = token.replace(/^[MLml]/, '');
		const parts = cleanedToken.split(',');
		if (parts.length < 2) {
			continue;
		}
		const x = Number(parts[0]);
		const y = Number(parts[1]);
		if (!Number.isFinite(x) || !Number.isFinite(y)) {
			continue;
		}
		coords.push({ x, y });
	}
	if (coords.length === 0) {
		return undefined;
	}
	const segments = coords.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x},${p.y}`);
	return segments.join(' ');
}

/**
 * Extract per-point pressure values from an `aink:trace` payload.
 *
 * Mirrors {@link parseAinkTraceText}'s tokenisation, but reads the optional
 * third comma-separated component of each `x,y[,pressure]` point (as
 * `p:contentPart` InkML does). Pressure is clamped to 0-1. Returns an empty
 * array when no point carries a usable pressure value, so constant-width
 * strokes stay constant-width.
 */
export function parseAinkTracePressures(raw: string): number[] {
	const cleaned = raw.replace(/\s+/g, ' ').trim();
	if (cleaned.length === 0) {
		return [];
	}
	const tokens = cleaned.split(/\s+/);
	const pressures: number[] = [];
	let sawPressure = false;
	for (const token of tokens) {
		const cleanedToken = token.replace(/^[MLml]/, '');
		const parts = cleanedToken.split(',');
		if (parts.length < 2) {
			continue;
		}
		const x = Number(parts[0]);
		const y = Number(parts[1]);
		if (!Number.isFinite(x) || !Number.isFinite(y)) {
			continue;
		}
		const rawPressure = parts.length > 2 ? Number(parts[2]) : NaN;
		if (Number.isFinite(rawPressure)) {
			sawPressure = true;
			pressures.push(Math.max(0, Math.min(1, rawPressure)));
		} else {
			pressures.push(0.5);
		}
	}
	return sawPressure ? pressures : [];
}

/**
 * Locate the `<aink:ink>` payload inside a graphicData node. Modern files
 * wrap it under `mc:AlternateContent > mc:Choice@Requires="aink"`; older
 * files place it directly under `<a:graphicData>`.
 */
function findAinkInkPayload(graphicData: XmlObject | undefined): XmlObject | undefined {
	if (!graphicData) {
		return undefined;
	}
	const direct = graphicData['aink:ink'] as XmlObject | undefined;
	if (direct) {
		return direct;
	}
	const altContent = graphicData['mc:AlternateContent'] as XmlObject | undefined;
	if (!altContent) {
		return undefined;
	}
	const choices = ensureArrayLike(altContent['mc:Choice'] as XmlObject | XmlObject[] | undefined);
	for (const choice of choices) {
		const requires = String(choice?.['@_Requires'] ?? '').toLowerCase();
		if (requires.includes('aink')) {
			const node = choice?.['aink:ink'] as XmlObject | undefined;
			if (node) {
				return node;
			}
		}
	}
	return undefined;
}

/**
 * Locate the `<p:oleObj>` payload inside a graphicData node.
 *
 * Real PowerPoint (verified via COM-authored fixtures, not just the spec)
 * wraps the OLE object in `mc:AlternateContent`: an `mc:Choice
 * Requires="v"` branch carrying only a VML preview, and the actual
 * `<p:oleObj>` (with its `p:pic` PNG/EMF fallback preview) inside
 * `mc:Fallback`. Older/simpler files place `<p:oleObj>` directly under
 * `<a:graphicData>`. A handful of producers may also put it inside an
 * `mc:Choice` instead of `mc:Fallback`, so both are checked.
 */
function findOleObjPayload(graphicData: XmlObject | undefined): XmlObject | undefined {
	if (!graphicData) {
		return undefined;
	}
	const direct = graphicData['p:oleObj'] as XmlObject | undefined;
	if (direct) {
		return direct;
	}
	const altContent = graphicData['mc:AlternateContent'] as XmlObject | undefined;
	if (!altContent) {
		return undefined;
	}
	const fallback = altContent['mc:Fallback'] as XmlObject | undefined;
	const fallbackOleObj = fallback?.['p:oleObj'] as XmlObject | undefined;
	if (fallbackOleObj) {
		return fallbackOleObj;
	}
	const choices = ensureArrayLike(altContent['mc:Choice'] as XmlObject | XmlObject[] | undefined);
	for (const choice of choices) {
		const node = choice?.['p:oleObj'] as XmlObject | undefined;
		if (node) {
			return node;
		}
	}
	return undefined;
}

/**
 * Decode the `<aink:ink>` payload into stroke arrays for an
 * {@link InkPptxElement}. Reads `<aink:inkBrush>` for the default colour
 * and width (`@_brushColor`, `@_brushSize`) and walks each `<aink:trace>`
 * to produce SVG path data. Returns empty arrays when the payload has no
 * usable strokes.
 */
export function decodeAinkInk(inkRoot: XmlObject): {
	inkPaths: string[];
	inkColors: string[];
	inkWidths: number[];
	inkPointPressures: number[][];
} {
	const inkPaths: string[] = [];
	const inkColors: string[] = [];
	const inkWidths: number[] = [];
	const inkPointPressures: number[][] = [];

	const brush = inkRoot['aink:inkBrush'] as XmlObject | undefined;
	const defaultColor = (() => {
		const raw = String(brush?.['@_brushColor'] ?? '').trim();
		if (raw.length === 0) {
			return '#000000';
		}
		// Spec form is hex w/o leading `#`; tolerate `#RRGGBB` and `RRGGBB`.
		return raw.startsWith('#') ? raw : `#${raw}`;
	})();
	const defaultWidth = (() => {
		const raw = String(brush?.['@_brushSize'] ?? '').trim();
		if (raw.length === 0) {
			return 2;
		}
		const num = Number(raw);
		return Number.isFinite(num) && num > 0 ? num : 2;
	})();

	const traces = ensureArrayLike(inkRoot['aink:trace'] as unknown as XmlObject | XmlObject[]);
	for (const trace of traces) {
		const text = (() => {
			if (typeof trace === 'string') {
				return trace as string;
			}
			const childText = (trace as XmlObject | undefined)?.['#text'];
			if (typeof childText === 'string') {
				return childText;
			}
			if (childText !== undefined && childText !== null) {
				return String(childText);
			}
			return '';
		})();
		const path = parseAinkTraceText(text);
		if (!path) {
			continue;
		}
		inkPaths.push(path);
		inkPointPressures.push(parseAinkTracePressures(text));
		// Per-trace colour/size override (`@_brushColor`, `@_brushSize`)
		// when the trace itself is an XmlObject.
		const traceObj = typeof trace === 'string' ? undefined : (trace as XmlObject);
		const traceColor = traceObj ? String(traceObj['@_brushColor'] ?? '').trim() : '';
		const traceWidthRaw = traceObj ? String(traceObj['@_brushSize'] ?? '').trim() : '';
		inkColors.push(
			traceColor.length > 0
				? traceColor.startsWith('#')
					? traceColor
					: `#${traceColor}`
				: defaultColor,
		);
		const traceWidthNum = traceWidthRaw.length > 0 ? Number(traceWidthRaw) : NaN;
		inkWidths.push(
			Number.isFinite(traceWidthNum) && traceWidthNum > 0 ? traceWidthNum : defaultWidth,
		);
	}

	return { inkPaths, inkColors, inkWidths, inkPointPressures };
}

export interface PptxGraphicFrameParserContext {
	emuPerPx: number;
	getOrderedSlidePaths: () => string[];
	slideRelsMap: Map<string, Map<string, string>>;
	externalRelsMap: Map<string, Set<string>>;
	readFlipState: (xfrm: XmlObject | undefined) => {
		flipHorizontal?: boolean;
		flipVertical?: boolean;
	};
	parseTableData: (graphicData: XmlObject) => PptxTableData | undefined;
	parseMediaData: (graphicData: XmlObject, slidePath: string) => Partial<MediaPptxElement>;
	parseElementActions: (
		cNvPr: XmlObject | undefined,
		slideRelationships: Map<string, string> | undefined,
		orderedSlidePaths: string[],
	) => {
		actionClick?: PptxElement['actionClick'];
		actionHover?: PptxElement['actionHover'];
	};
	inspectGraphicFrameCompatibility: (
		type: PptxElement['type'],
		slidePath: string,
		elementId: string,
	) => void;
}

export interface IPptxGraphicFrameParser {
	parseGraphicFrame(frame: XmlObject, id: string, slidePath?: string): PptxElement | null;
	parseGraphicFrameType(graphicData: XmlObject | undefined): PptxElement['type'];
}

export class PptxGraphicFrameParser implements IPptxGraphicFrameParser {
	private readonly context: PptxGraphicFrameParserContext;

	public constructor(context: PptxGraphicFrameParserContext) {
		this.context = context;
	}

	public parseGraphicFrame(frame: XmlObject, id: string, slidePath?: string): PptxElement | null {
		try {
			const transform = frame['p:xfrm'] as XmlObject | undefined;
			const offset = ((transform?.['a:off'] as XmlObject | undefined) || {}) as XmlObject;
			const extent = ((transform?.['a:ext'] as XmlObject | undefined) || {}) as XmlObject;

			const graphicData = (frame['a:graphic'] as XmlObject | undefined)?.['a:graphicData'] as
				| XmlObject
				| undefined;
			const { flipHorizontal, flipVertical } = this.context.readFlipState(transform);

			const type = this.parseGraphicFrameType(graphicData);
			if (slidePath) {
				this.context.inspectGraphicFrameCompatibility(type, slidePath, id);
			}

			const baseElement = {
				id,
				type,
				x: Math.round(parseInt(String(offset['@_x'] || '0'), 10) / this.context.emuPerPx),
				y: Math.round(parseInt(String(offset['@_y'] || '0'), 10) / this.context.emuPerPx),
				width: Math.round(parseInt(String(extent['@_cx'] || '0'), 10) / this.context.emuPerPx),
				height: Math.round(parseInt(String(extent['@_cy'] || '0'), 10) / this.context.emuPerPx),
				rotation: transform?.['@_rot']
					? parseInt(String(transform['@_rot']), 10) / 60000
					: undefined,
				skewX: transform?.['@_skewX']
					? parseInt(String(transform['@_skewX']), 10) / 60000
					: undefined,
				skewY: transform?.['@_skewY']
					? parseInt(String(transform['@_skewY']), 10) / 60000
					: undefined,
				flipHorizontal,
				flipVertical,
				rawXml: frame,
			};

			// Capture any unrecognised `<a:graphicData>/<a:extLst>/<a:ext>`
			// extensions verbatim so they round-trip on save. This covers
			// future-feature markup (e.g. `p15:` extensions) that the
			// dedicated parsers below do not yet handle.
			const extensionXml = collectGraphicFrameExtensions(graphicData);

			if (type === 'table' && graphicData) {
				const tableData = this.context.parseTableData(graphicData);
				return {
					...baseElement,
					tableData,
					...(extensionXml.length > 0 ? { extensionXml } : {}),
				} as TablePptxElement;
			}

			if (type === 'ink' && graphicData) {
				const inkRoot = findAinkInkPayload(graphicData);
				const decoded = inkRoot
					? decodeAinkInk(inkRoot)
					: {
							inkPaths: [] as string[],
							inkColors: [] as string[],
							inkWidths: [] as number[],
							inkPointPressures: [] as number[][],
						};
				const hasPressures = decoded.inkPointPressures.some((p) => p.length > 0);
				return {
					...baseElement,
					inkPaths: decoded.inkPaths,
					...(decoded.inkColors.length > 0 ? { inkColors: decoded.inkColors } : {}),
					...(decoded.inkWidths.length > 0 ? { inkWidths: decoded.inkWidths } : {}),
					...(hasPressures ? { inkPointPressures: decoded.inkPointPressures } : {}),
					...(extensionXml.length > 0 ? { extensionXml } : {}),
				} as InkPptxElement;
			}

			if (type === 'media' && graphicData && slidePath) {
				const mediaInfo = this.context.parseMediaData(graphicData, slidePath);
				return {
					...baseElement,
					...mediaInfo,
					...(extensionXml.length > 0 ? { extensionXml } : {}),
				} as MediaPptxElement;
			}

			if (type === 'ole' && graphicData) {
				const oleObject = findOleObjPayload(graphicData);
				const oleProgId = String(oleObject?.['@_progId'] || '').trim() || undefined;
				const oleName = String(oleObject?.['@_name'] || '').trim() || undefined;
				const oleClsId = String(oleObject?.['@_classid'] || '').trim() || undefined;
				// Per ECMA-376 §13.3.4 / CT_OleObject, the embed-vs-link form is
				// expressed via a *child element* choice (`<p:embed>` or
				// `<p:link>`), not an attribute. The previous `@_link !== null`
				// check was always true because absent attributes are
				// `undefined`, never `null`. Detect via the child element and
				// confirm via the relationship `TargetMode` (External for link).
				const oleEmbedNode = oleObject?.['p:embed'] as XmlObject | undefined;
				const oleLinkNode = oleObject?.['p:link'] as XmlObject | undefined;
				const showAsIconAttr = oleObject?.['@_showAsIcon'];
				const oleShowAsIcon =
					showAsIconAttr === undefined
						? undefined
						: String(showAsIconAttr) === '1' || String(showAsIconAttr).toLowerCase() === 'true';
				const oleImgWRaw = oleObject?.['@_imgW'];
				const oleImgHRaw = oleObject?.['@_imgH'];
				const oleImgW =
					oleImgWRaw !== undefined && String(oleImgWRaw).length > 0
						? parseInt(String(oleImgWRaw), 10)
						: undefined;
				const oleImgH =
					oleImgHRaw !== undefined && String(oleImgHRaw).length > 0
						? parseInt(String(oleImgHRaw), 10)
						: undefined;
				let oleTarget: string | undefined;
				let previewImage: string | undefined;

				const oleRelationshipId = String(
					oleLinkNode?.['@_r:id'] ||
						oleEmbedNode?.['@_r:id'] ||
						oleObject?.['@_r:id'] ||
						oleObject?.['@_id'] ||
						'',
				).trim();
				let externalPath: string | undefined;
				let isLinked = Boolean(oleLinkNode) && !oleEmbedNode;
				if (oleRelationshipId && slidePath) {
					const relsMap = this.context.slideRelsMap.get(slidePath);
					oleTarget = relsMap?.get(oleRelationshipId);
					// Confirm linked status via TargetMode="External" in the
					// slide rels (external map is populated from
					// TargetMode="External" entries).
					const externalIds = this.context.externalRelsMap.get(slidePath);
					const isExternalRel = Boolean(externalIds?.has(oleRelationshipId));
					if (isExternalRel) {
						isLinked = true;
						externalPath = oleTarget;
					}
				}

				const olePicture = oleObject?.['p:pic'] as XmlObject | undefined;
				const oleBlipFill = olePicture?.['p:blipFill'] as XmlObject | undefined;
				const oleBlip = oleBlipFill?.['a:blip'] as XmlObject | undefined;
				const previewRelationshipId = String(oleBlip?.['@_r:embed'] || '').trim();
				if (previewRelationshipId && slidePath) {
					const relsMap = this.context.slideRelsMap.get(slidePath);
					previewImage = relsMap?.get(previewRelationshipId);
				}

				// Detect OLE object type from progId / clsId
				const { oleObjectType, oleFileExtension: detectedExt } = detectOleObjectType(
					oleProgId,
					oleClsId,
				);
				// Prefer extension inferred from the actual oleTarget path
				const targetExt = inferOleExtensionFromTarget(oleTarget);
				const oleFileExtension = targetExt ?? detectedExt;

				const cNvPr = (frame?.['p:nvGraphicFramePr'] as XmlObject | undefined)?.['p:cNvPr'] as
					| XmlObject
					| undefined;
				const slideRelationships = slidePath ? this.context.slideRelsMap.get(slidePath) : undefined;
				const { actionClick, actionHover } = this.context.parseElementActions(
					cNvPr,
					slideRelationships,
					this.context.getOrderedSlidePaths(),
				);

				return {
					...baseElement,
					oleProgId,
					oleName,
					oleClsId,
					oleObjectType,
					oleFileExtension,
					isLinked,
					externalPath,
					oleTarget,
					previewImage,
					oleShowAsIcon,
					oleImgW,
					oleImgH,
					actionClick,
					actionHover,
					...(extensionXml.length > 0 ? { extensionXml } : {}),
				} as OlePptxElement;
			}

			return {
				...baseElement,
				...(extensionXml.length > 0 ? { extensionXml } : {}),
			} as PptxElement;
		} catch {
			return null;
		}
	}

	public parseGraphicFrameType(graphicData: XmlObject | undefined): PptxElement['type'] {
		if (!graphicData) {
			return 'unknown';
		}

		const uri = String(graphicData['@_uri'] || '').toLowerCase();
		if (graphicData['a:tbl'] || uri.includes('/drawingml/2006/table')) {
			return 'table';
		}
		if (graphicData['c:chart'] || uri.includes('/drawingml/2006/chart')) {
			return 'chart';
		}
		if (graphicData['dgm:relIds'] || uri.includes('/drawingml/2006/diagram')) {
			return 'smartArt';
		}
		if (
			uri.includes('/presentationml/2006/ole') ||
			uri.includes('/drawingml/2006/ole') ||
			findOleObjPayload(graphicData)
		) {
			return 'ole';
		}
		if (
			graphicData['a:videoFile'] ||
			graphicData['a:audioFile'] ||
			graphicData['a:wavAudioFile'] ||
			graphicData['a:quickTimeFile'] ||
			graphicData['a:audioCd'] ||
			uri.includes('/drawingml/2006/media')
		) {
			return 'media';
		}
		// Ink graphicFrame (Office 2010+ ink, namespace `aink`). The payload
		// is typically wrapped in `mc:AlternateContent > mc:Choice
		// Requires="aink"` with an `<aink:ink>` root; older files may carry
		// `<aink:ink>` directly under `<a:graphicData>`. Detect via the URI,
		// a direct `aink:ink` child, or a `Requires="aink"` Choice inside an
		// AlternateContent envelope. Without this branch the element falls
		// through to `'unknown'` and the slide loses the round-trip envelope.
		if (graphicData['aink:ink'] || uri.includes('/2010/ink') || uri.includes('drawing/2010/ink')) {
			return 'ink';
		}
		const alternateContent = graphicData['mc:AlternateContent'] as XmlObject | undefined;
		if (alternateContent) {
			const choices = Array.isArray(alternateContent['mc:Choice'])
				? (alternateContent['mc:Choice'] as XmlObject[])
				: alternateContent['mc:Choice']
					? [alternateContent['mc:Choice'] as XmlObject]
					: [];
			for (const choice of choices) {
				const requires = String(choice?.['@_Requires'] || '').toLowerCase();
				if (requires.includes('aink') || choice?.['aink:ink']) {
					return 'ink';
				}
			}
		}
		return 'unknown';
	}
}
