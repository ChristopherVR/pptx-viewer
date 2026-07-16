/**
 * Save-pipeline mixin: fabricate the full diagram part family for
 * SDK-created SmartArt elements (inserted via the viewer / SlideBuilder,
 * carrying only in-memory `smartArtData` with no `rawXml` and no diagram
 * parts). Mirrors the SDK-created chart path (`createChartElementXml`):
 * write the parts, register the slide relationships, queue content-type
 * overrides, and return the `p:graphicFrame` envelope with `dgm:relIds`.
 */
import type { XmlObject, SmartArtPptxElement } from '../../types';
import { SMART_ART_DEFINITION_PARTS, decomposeSmartArt } from '../../utils';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveElementEmbedding';
import type { SaveSlideContext } from './PptxHandlerRuntimeSaveElementEmbedding';
import {
	buildFabricatedDiagramDataXml,
	buildNodeGuidMap,
	buildPresentationGuidMap,
} from './smartart-fabrication-data';
import {
	DIAGRAM_DRAWING_CONTENT_TYPE,
	DIAGRAM_DRAWING_REL_TYPE,
	buildFabricatedDrawingXml,
	smartArtElementsToDrawingShapes,
} from './smartart-fabrication-drawing';
import {
	buildFabricatedLayoutDefXml,
	fabricatedLayoutCategory,
	fabricatedLayoutUniqueId,
	resolveFabricatedLayoutFamily,
} from './smartart-fabrication-layouts';
import {
	FABRICATED_QUICKSTYLE_UNIQUE_ID,
	buildFabricatedColorsXml,
	buildFabricatedQuickStyleXml,
	fabricatedColorsCategory,
	fabricatedColorsUniqueId,
} from './smartart-fabrication-styles';

const DIAGRAM_GRAPHIC_DATA_URI = 'http://schemas.openxmlformats.org/drawingml/2006/diagram';
const DIAGRAM_NS_DGM = 'http://schemas.openxmlformats.org/drawingml/2006/diagram';
const DIAGRAM_NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const REL_TYPE_BASE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CT_BASE = 'application/vnd.openxmlformats-officedocument.drawingml';

/** The four diagram parts a SmartArt graphic frame references via `dgm:relIds`. */
const DIAGRAM_PART_KINDS = [
	{
		prefix: 'data',
		relAttr: '@_r:dm',
		relType: `${REL_TYPE_BASE}/diagramData`,
		contentType: `${CT_BASE}.diagramData+xml`,
	},
	{
		prefix: 'layout',
		relAttr: '@_r:lo',
		relType: SMART_ART_DEFINITION_PARTS.layout.relationshipType,
		contentType: SMART_ART_DEFINITION_PARTS.layout.contentType,
	},
	{
		prefix: 'quickStyle',
		relAttr: '@_r:qs',
		relType: SMART_ART_DEFINITION_PARTS.style.relationshipType,
		contentType: SMART_ART_DEFINITION_PARTS.style.contentType,
	},
	{
		prefix: 'colors',
		relAttr: '@_r:cs',
		relType: SMART_ART_DEFINITION_PARTS.color.relationshipType,
		contentType: SMART_ART_DEFINITION_PARTS.color.contentType,
	},
] as const;

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/** Content-type overrides queued for diagram parts fabricated this save. */
	protected pendingDiagramContentTypes?: Array<{ partName: string; contentType: string }>;

	/** Pick the next free `ppt/diagrams/*N.xml` index (zip + pending writes). */
	protected nextDiagramPartIndex(): number {
		const used = new Set<number>();
		const re = /^\/?ppt\/diagrams\/(?:data|layout|quickStyle|colors|drawing)(?<n>\d+)\.xml$/u;
		const collect = (name: string): void => {
			const m = re.exec(name);
			if (m?.groups?.n) {
				used.add(Number.parseInt(m.groups.n, 10));
			}
		};
		for (const name of Object.keys(this.zip.files)) {
			collect(name);
		}
		for (const pending of this.pendingDiagramContentTypes ?? []) {
			collect(pending.partName);
		}
		let n = 1;
		while (used.has(n)) {
			n += 1;
		}
		return n;
	}

	/**
	 * Fabricate `ppt/diagrams/{data,layout,quickStyle,colors}N.xml` for an
	 * SDK-created SmartArt element, register the four slide relationships,
	 * queue the content-type overrides, and return the `p:graphicFrame`.
	 */
	protected createSmartArtElementXml(el: SmartArtPptxElement, ctx: SaveSlideContext): XmlObject {
		const data = el.smartArtData!;
		const family = resolveFabricatedLayoutFamily(data);
		const layoutIdentity = data.layout ?? data.resolvedLayoutType;
		const index = this.nextDiagramPartIndex();

		// Cache the viewer-computed shape geometry so PowerPoint renders each node
		// with its own preset (pyramid trapezoids, cycle ellipses, ...) instead of
		// recomputing the simplified layout and drawing every node as a roundRect.
		// SDK-inserted diagrams carry no `drawingShapes`, so fall back to running
		// the same decompose/layout algorithms the viewer renders with.
		const guidByNodeId = buildNodeGuidMap(data.nodes);
		const presentationGuidByNodeId = buildPresentationGuidMap(data.nodes);
		const drawingShapes =
			data.drawingShapes && data.drawingShapes.length > 0
				? data.drawingShapes
				: smartArtElementsToDrawingShapes(
						decomposeSmartArt(data, {
							x: 0,
							y: 0,
							width: Math.max(el.width, 1),
							height: Math.max(el.height, 1),
						}),
					);
		const drawingXml = buildFabricatedDrawingXml(
			drawingShapes,
			data.nodes,
			presentationGuidByNodeId,
		);
		const drawingRelId = drawingXml
			? ctx.slideRelationshipRegistry.nextRelationshipId()
			: undefined;

		const payloads: Record<(typeof DIAGRAM_PART_KINDS)[number]['prefix'], string> = {
			data: buildFabricatedDiagramDataXml(
				data,
				{
					layoutUniqueId: fabricatedLayoutUniqueId(family, layoutIdentity),
					layoutCategory: fabricatedLayoutCategory(family),
					quickStyleUniqueId: FABRICATED_QUICKSTYLE_UNIQUE_ID,
					colorsUniqueId: fabricatedColorsUniqueId(data.colorScheme),
					colorsCategory: fabricatedColorsCategory(data.colorScheme),
				},
				{ guidByNodeId, presentationGuidByNodeId, drawingRelId },
			),
			layout: buildFabricatedLayoutDefXml(family, layoutIdentity),
			quickStyle: buildFabricatedQuickStyleXml(),
			colors: buildFabricatedColorsXml(data.colorScheme),
		};

		const relIds: XmlObject = {
			'@_xmlns:dgm': DIAGRAM_NS_DGM,
			'@_xmlns:r': DIAGRAM_NS_R,
		};
		for (const kind of DIAGRAM_PART_KINDS) {
			const partPath = `ppt/diagrams/${kind.prefix}${index}.xml`;
			this.zip.file(partPath, payloads[kind.prefix]);
			(this.pendingDiagramContentTypes ??= []).push({
				partName: `/${partPath}`,
				contentType: kind.contentType,
			});
			const relId = ctx.slideRelationshipRegistry.nextRelationshipId();
			ctx.slideRelationships.push({
				'@_Id': relId,
				'@_Type': kind.relType,
				'@_Target': `../diagrams/${kind.prefix}${index}.xml`,
			});
			relIds[kind.relAttr] = relId;
		}

		// Emit the cached drawing part and link it from the owning slide. PowerPoint
		// resolves the unqualified `dsp:dataModelExt/@relId` in the slide scope.
		if (drawingXml && drawingRelId) {
			const drawingFile = `drawing${index}.xml`;
			const drawingPath = `ppt/diagrams/${drawingFile}`;
			this.zip.file(drawingPath, drawingXml);
			(this.pendingDiagramContentTypes ??= []).push({
				partName: `/${drawingPath}`,
				contentType: DIAGRAM_DRAWING_CONTENT_TYPE,
			});
			ctx.slideRelationships.push({
				'@_Id': drawingRelId,
				'@_Type': DIAGRAM_DRAWING_REL_TYPE,
				'@_Target': `../diagrams/${drawingFile}`,
			});
		}

		const EMU = PptxHandlerRuntime.EMU_PER_PX;
		return {
			'p:nvGraphicFramePr': {
				'p:cNvPr': { '@_id': '0', '@_name': el.name || 'SmartArt' },
				'p:cNvGraphicFramePr': {},
				'p:nvPr': {},
			},
			'p:xfrm': {
				'a:off': {
					'@_x': String(Math.round(el.x * EMU)),
					'@_y': String(Math.round(el.y * EMU)),
				},
				'a:ext': {
					'@_cx': String(Math.round(Math.max(el.width, 1) * EMU)),
					'@_cy': String(Math.round(Math.max(el.height, 1) * EMU)),
				},
			},
			'a:graphic': {
				'a:graphicData': {
					'@_uri': DIAGRAM_GRAPHIC_DATA_URI,
					'dgm:relIds': relIds,
				},
			},
		};
	}

	/**
	 * Add `[Content_Types].xml` Override entries for diagram parts fabricated
	 * this save. Called from the save pipeline alongside
	 * `ensureChartPartContentTypes`; a no-op when nothing was fabricated.
	 */
	protected async ensureDiagramPartContentTypes(): Promise<void> {
		const entries = this.pendingDiagramContentTypes;
		this.pendingDiagramContentTypes = undefined;
		if (!entries || entries.length === 0) {
			return;
		}
		const ctXml = await this.zip.file('[Content_Types].xml')?.async('string');
		if (!ctXml) {
			return;
		}
		const ctData = this.parser.parse(ctXml) as XmlObject;
		const typesRoot = (ctData['Types'] || {}) as XmlObject;
		const overrides = Array.isArray(typesRoot['Override'])
			? (typesRoot['Override'] as XmlObject[])
			: typesRoot['Override']
				? [typesRoot['Override'] as XmlObject]
				: [];
		const have = new Set(overrides.map((o) => String(o?.['@_PartName'] || '')));
		for (const entry of entries) {
			if (!have.has(entry.partName)) {
				overrides.push({ '@_PartName': entry.partName, '@_ContentType': entry.contentType });
				have.add(entry.partName);
			}
		}
		typesRoot['Override'] = overrides;
		ctData['Types'] = typesRoot;
		this.zip.file('[Content_Types].xml', this.builder.build(ctData));
	}
}
