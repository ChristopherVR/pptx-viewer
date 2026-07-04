/**
 * Fabricate the diagram DATA part (`ppt/diagrams/dataN.xml`) for an
 * SDK-created SmartArt element (one inserted via the viewer / SlideBuilder,
 * with no `rawXml` and no existing diagram parts in the package).
 *
 * The fabricated data model is deliberately minimal: a `doc` point, one
 * content point per in-memory node (plus the `parTrans` / `sibTrans` support
 * pair every real content point carries), and the `parOf` connections that
 * wire the tree. No `pres`-type presentation points are emitted; PowerPoint
 * computes the presentation tree itself from the layout definition on open.
 *
 * Model ids MUST be `{GUID}` strings: schema-valid informal ids are still
 * rejected by PowerPoint's loader as a corrupt file (confirmed empirically
 * via COM automation). In-memory node ids produced by the editing UI are
 * informal (`node-<timestamp>-…`), so every id is remapped here.
 */
import type { PptxSmartArtData, PptxSmartArtNode } from '../../types';
import { newSmartArtGuid } from './smartart-xml-builders';

export const XML_PROLOG = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
export const DGM_XMLNS =
	'xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';

/** Escape a text value for inclusion in XML content or attributes. */
export function xmlEscape(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

const GUID_MODEL_ID = /^\{[0-9A-Fa-f]{8}(?:-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}\}$/u;

/** Unique-id URNs of the fabricated layout / quick-style / colors parts. */
export interface FabricatedDefIds {
	layoutUniqueId: string;
	layoutCategory: string;
	quickStyleUniqueId: string;
	colorsUniqueId: string;
	colorsCategory: string;
}

/** The empty `dgm:t` body used for doc / parTrans / sibTrans points. */
const EMPTY_TEXT_BODY =
	'<dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></dgm:t>';

function contentTextBody(text: string): string {
	if (!text) {
		return EMPTY_TEXT_BODY;
	}
	return `<dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>${xmlEscape(text)}</a:t></a:r></a:p></dgm:t>`;
}

function contentPointXml(guid: string, node: PptxSmartArtNode): string {
	const prSet = node.text ? '<dgm:prSet/>' : '<dgm:prSet phldrT="[Text]" phldr="1"/>';
	return `<dgm:pt modelId="${guid}">${prSet}<dgm:spPr/>${contentTextBody(node.text ?? '')}</dgm:pt>`;
}

function transPointXml(guid: string, type: 'parTrans' | 'sibTrans', cxnGuid: string): string {
	return `<dgm:pt modelId="${guid}" type="${type}" cxnId="${cxnGuid}"><dgm:prSet/><dgm:spPr/>${EMPTY_TEXT_BODY}</dgm:pt>`;
}

function docPointXml(docGuid: string, ids: FabricatedDefIds): string {
	return (
		`<dgm:pt modelId="${docGuid}" type="doc">` +
		`<dgm:prSet loTypeId="${xmlEscape(ids.layoutUniqueId)}" loCatId="${xmlEscape(ids.layoutCategory)}"` +
		` qsTypeId="${xmlEscape(ids.quickStyleUniqueId)}" qsCatId="simple"` +
		` csTypeId="${xmlEscape(ids.colorsUniqueId)}" csCatId="${xmlEscape(ids.colorsCategory)}"/>` +
		`<dgm:spPr/>${EMPTY_TEXT_BODY}</dgm:pt>`
	);
}

/**
 * Build the complete `dataN.xml` payload for a fabricated SmartArt diagram.
 *
 * Node parent wiring comes from each node's `parentId`; a missing or
 * unresolvable `parentId` parents the node under the `doc` point (a
 * top-level entry). `srcOrd` is assigned per parent in `nodes` order so
 * sibling order in the viewer is preserved in the saved diagram.
 */
export function buildFabricatedDiagramDataXml(
	data: PptxSmartArtData,
	ids: FabricatedDefIds,
): string {
	const docGuid = newSmartArtGuid();
	const guidByNodeId = new Map<string, string>();
	for (const node of data.nodes) {
		if (node.id && !guidByNodeId.has(node.id)) {
			guidByNodeId.set(node.id, GUID_MODEL_ID.test(node.id) ? node.id : newSmartArtGuid());
		}
	}

	const points: string[] = [docPointXml(docGuid, ids)];
	const connections: string[] = [];
	const nextSrcOrd = new Map<string, number>();

	for (const node of data.nodes) {
		const guid = node.id ? guidByNodeId.get(node.id) : undefined;
		if (!guid) {
			continue;
		}
		const parentGuid = (node.parentId && guidByNodeId.get(node.parentId)) || docGuid;
		const srcOrd = nextSrcOrd.get(parentGuid) ?? 0;
		nextSrcOrd.set(parentGuid, srcOrd + 1);

		const cxnGuid = newSmartArtGuid();
		const parTransGuid = newSmartArtGuid();
		const sibTransGuid = newSmartArtGuid();

		points.push(contentPointXml(guid, node));
		points.push(transPointXml(parTransGuid, 'parTrans', cxnGuid));
		points.push(transPointXml(sibTransGuid, 'sibTrans', cxnGuid));
		connections.push(
			`<dgm:cxn modelId="${cxnGuid}" srcId="${parentGuid}" destId="${guid}" srcOrd="${srcOrd}" destOrd="0" parTransId="${parTransGuid}" sibTransId="${sibTransGuid}"/>`,
		);
	}

	return (
		`${XML_PROLOG}\r\n<dgm:dataModel ${DGM_XMLNS}>` +
		`<dgm:ptLst>${points.join('')}</dgm:ptLst>` +
		`<dgm:cxnLst>${connections.join('')}</dgm:cxnLst>` +
		`<dgm:bg/><dgm:whole/></dgm:dataModel>`
	);
}
