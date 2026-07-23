/**
 * SmartArt cached-drawing (`ppt/diagrams/drawing*.xml`) shape enumeration and
 * picture (blip) fill resolution.
 *
 * Two gaps this module closes (issue #73):
 *  1. The drawing part's shape tree can nest `dsp:sp` / `dsp:pic` inside one or
 *     more `dsp:grpSp` groups, and can carry bare `dsp:pic` frames. Reading only
 *     top-level `dsp:sp` silently dropped those shapes.
 *  2. A `dsp` shape's picture fill carries an `r:embed` id (captured on the
 *     model in the parse step) but the image bytes are never resolved, so
 *     picture-based layouts render as flat fills. The embed id points into the
 *     drawing part's OWN `_rels` file (not the slide's), so it is resolved here.
 *
 * All package/runtime coupling is injected via {@link DrawingBlipDeps} so the
 * logic stays pure and directly testable.
 *
 * @module pptx-runtime/smartart-drawing-blip
 */

import type { XmlObject, PptxSmartArtDrawingShape } from '../../types';

/** A drawing node plus whether it is a `dsp:pic` (blip lives outside `spPr`). */
export interface DrawingNodeRef {
	node: XmlObject;
	isPic: boolean;
}

/** Injected accessors binding the runtime's zip / parser / lookup helpers. */
export interface DrawingBlipDeps {
	readText(path: string): Promise<string | undefined>;
	parse(xml: string): XmlObject;
	getChild(node: XmlObject | undefined, local: string): XmlObject | undefined;
	getChildren(node: XmlObject | undefined, local: string): XmlObject[];
	parseDrawingShape(
		sp: XmlObject,
		index: number,
		emuPerPx: number,
	): PptxSmartArtDrawingShape | null;
	emuPerPx: number;
	ensureArray(value: unknown): XmlObject[];
	resolveImagePath(base: string, target: string): string;
	getImageData(path: string): Promise<string | undefined>;
}

/**
 * Recursively enumerate paintable nodes in a `dsp` shape tree: `dsp:sp`,
 * bare `dsp:pic`, and every `dsp:sp` / `dsp:pic` nested inside (possibly
 * nested) `dsp:grpSp` groups. The parser groups same-named siblings so exact
 * document order is not preserved across element types; z-order within each
 * kind is kept, which matches the existing flat-list behaviour.
 */
export function collectDrawingShapeNodes(
	root: XmlObject | undefined,
	getChildren: DrawingBlipDeps['getChildren'],
): DrawingNodeRef[] {
	const out: DrawingNodeRef[] = [];
	const walk = (container: XmlObject | undefined): void => {
		if (!container) {
			return;
		}
		for (const sp of getChildren(container, 'sp')) {
			out.push({ node: sp, isPic: false });
		}
		for (const pic of getChildren(container, 'pic')) {
			out.push({ node: pic, isPic: true });
		}
		for (const grp of getChildren(container, 'grpSp')) {
			walk(grp);
		}
	};
	walk(root);
	return out;
}

/**
 * Read a `dsp:pic`'s blip-fill embed id. Unlike `dsp:sp`, a picture frame's
 * `blipFill` is a direct child of the `pic` (not nested in `spPr`), so the
 * shared shape-fill extractor never sees it.
 */
export function picBlipEmbedId(
	pic: XmlObject,
	getChild: DrawingBlipDeps['getChild'],
): string | undefined {
	const blip = getChild(getChild(pic, 'blipFill'), 'blip');
	if (!blip) {
		return undefined;
	}
	const embed = String(blip['@_r:embed'] || blip['@_embed'] || blip['@_r:link'] || '').trim();
	return embed.length > 0 ? embed : undefined;
}

/**
 * Parse a drawing part's `_rels` file into a `relId -> Target` map. The
 * relationship type is not filtered (some producers omit the canonical
 * `/image` suffix); the shape's embed id is the authority.
 */
export function parseDrawingRelTargets(
	relsXml: string,
	parse: DrawingBlipDeps['parse'],
	ensureArray: DrawingBlipDeps['ensureArray'],
): Map<string, string> {
	const map = new Map<string, string>();
	try {
		const relsRoot = parse(relsXml)['Relationships'] as XmlObject | undefined;
		if (!relsRoot) {
			return map;
		}
		for (const rel of ensureArray(relsRoot['Relationship'])) {
			const id = String(rel?.['@_Id'] || '').trim();
			const target = String(rel?.['@_Target'] || '').trim();
			if (id.length > 0 && target.length > 0) {
				map.set(id, target);
			}
		}
	} catch {
		// Malformed rels: no blip fills resolvable.
	}
	return map;
}

/**
 * Resolve picture (blip) fills on cached drawing shapes to data URLs, using
 * the drawing part's own relationships to map each embed id to its media part.
 */
async function resolveDrawingBlipFills(
	shapes: PptxSmartArtDrawingShape[],
	drawingPath: string,
	deps: DrawingBlipDeps,
): Promise<void> {
	const pending = shapes.filter((shape) => shape.fillBlipEmbedId && !shape.fillImageUrl);
	if (pending.length === 0) {
		return;
	}
	const dir = drawingPath.replace(/\/[^/]+$/u, '');
	const file = drawingPath.split('/').pop() ?? '';
	const relsXml = await deps.readText(`${dir}/_rels/${file}.rels`);
	if (!relsXml) {
		return;
	}
	const targets = parseDrawingRelTargets(relsXml, deps.parse, deps.ensureArray);
	for (const shape of pending) {
		const target = targets.get(shape.fillBlipEmbedId ?? '');
		if (!target) {
			continue;
		}
		const source = /^(?:https?:|data:)/u.test(target)
			? target
			: deps.resolveImagePath(drawingPath, target);
		const resolved = await deps.getImageData(source);
		if (resolved) {
			shape.fillImageUrl = resolved;
		}
	}
}

/**
 * Parse every cached drawing shape from a `ppt/diagrams/drawing*.xml` part:
 * enumerate `dsp:sp` / `dsp:pic` (incl. nested `dsp:grpSp`), then resolve any
 * picture fills to data URLs.
 */
export async function parseDrawingShapesFromPart(
	drawingPath: string,
	deps: DrawingBlipDeps,
): Promise<PptxSmartArtDrawingShape[]> {
	const xmlString = await deps.readText(drawingPath);
	if (!xmlString) {
		return [];
	}
	try {
		const xml = deps.parse(xmlString);
		const drawing = deps.getChild(xml, 'drawing');
		const spTree = deps.getChild(drawing || xml, 'spTree');
		if (!spTree) {
			return [];
		}
		const shapes: PptxSmartArtDrawingShape[] = [];
		collectDrawingShapeNodes(spTree, deps.getChildren).forEach(({ node, isPic }, index) => {
			const shape = deps.parseDrawingShape(node, index, deps.emuPerPx);
			if (!shape) {
				return;
			}
			if (isPic && !shape.fillBlipEmbedId) {
				const embed = picBlipEmbedId(node, deps.getChild);
				if (embed) {
					shape.fillBlipEmbedId = embed;
				}
			}
			shapes.push(shape);
		});
		await resolveDrawingBlipFills(shapes, drawingPath, deps);
		return shapes;
	} catch {
		return [];
	}
}
