import type { XmlObject } from '../../types';

interface DrawingPartDeps {
	slideRelationships(path: string): Map<string, string> | undefined;
	resolvePath(base: string, target: string): string;
	readText(path: string): Promise<string | undefined>;
	parse(xml: string): XmlObject;
	ensureArray(value: unknown): unknown[];
}

/** Resolve slide-scoped diagram drawings, with a legacy data-part relationship fallback. */
export async function resolveSmartArtDrawingPart(
	slidePath: string,
	diagramDataRelationshipId: string,
	drawingExtensionRelId: string,
	deps: DrawingPartDeps,
): Promise<{ relId: string; path: string } | undefined> {
	if (diagramDataRelationshipId.length === 0) {
		return undefined;
	}
	const slideRels = deps.slideRelationships(slidePath);
	const slideDrawingTarget = drawingExtensionRelId
		? slideRels?.get(drawingExtensionRelId)
		: undefined;
	if (slideDrawingTarget) {
		return {
			relId: drawingExtensionRelId,
			path: deps.resolvePath(slidePath, slideDrawingTarget),
		};
	}

	// Some producers omit dataModelExt but still leave a single drawing part
	// relationship on the slide. Recover it by its target path.
	const inferredSlideDrawing = [...(slideRels?.entries() ?? [])].find(([, target]) =>
		/(?:^|\/)diagrams\/drawing\d+\.xml$/u.test(target.replaceAll('\\', '/')),
	);
	if (inferredSlideDrawing) {
		return {
			relId: inferredSlideDrawing[0],
			path: deps.resolvePath(slidePath, inferredSlideDrawing[1]),
		};
	}

	const dataTarget = slideRels?.get(diagramDataRelationshipId);
	if (!dataTarget) {
		return undefined;
	}
	const dataPath = deps.resolvePath(slidePath, dataTarget);
	// Compute the rels file alongside the data part:
	//   ppt/diagrams/data1.xml → ppt/diagrams/_rels/data1.xml.rels
	const dataDir = dataPath.replace(/\/[^/]+$/u, '');
	const dataFile = dataPath.split('/').pop() ?? '';
	const dataRelsPath = `${dataDir}/_rels/${dataFile}.rels`;

	const relsXml = await deps.readText(dataRelsPath);
	if (!relsXml) {
		return undefined;
	}
	try {
		const parsed = deps.parse(relsXml) as XmlObject;
		const relsRoot = parsed['Relationships'] as XmlObject | undefined;
		if (!relsRoot) {
			return undefined;
		}
		const rels = deps.ensureArray(relsRoot['Relationship']) as XmlObject[];
		const drawingRel = rels.find((rel) => {
			const id = String(rel?.['@_Id'] || '').trim();
			return (
				(!drawingExtensionRelId || id === drawingExtensionRelId) &&
				String(rel?.['@_Type'] || '').endsWith('/diagramDrawing')
			);
		});
		const id = String(drawingRel?.['@_Id'] || '').trim();
		const target = String(drawingRel?.['@_Target'] || '').trim();
		if (id.length === 0 || target.length === 0) {
			return undefined;
		}
		const drawingPath = deps.resolvePath(dataPath, target);
		return { relId: id, path: drawingPath };
	} catch {
		return undefined;
	}
}
