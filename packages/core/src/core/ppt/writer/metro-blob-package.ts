/**
 * Builds a shape's [MS-ODRAW] `metroBlob` (opid 0x03A9): the small ZIP/OPC
 * package PowerPoint 2007+ writes into a 97-2003 `.ppt` so the shape reopens
 * as the native ink, SmartArt, chart or 3D model it was, while older readers
 * still show the shape's own picture/placeholder.
 *
 * Layout, reverse-engineered from PowerPoint 16.0's own SaveAs output and
 * COM-verified by reopening this writer's from-scratch files in PowerPoint:
 *
 * - package root `drs/inkxml.xml` (`p:contentPart`, content type
 *   `application/vnd.ms-office.DrsInk+xml`, package relationship
 *   `.../2007/relationships/inkXml`) for ink, or `drs/e2oDoc.xml`
 *   (`p:E2oFrame`, `application/vnd.ms-office.DrsE2oDoc+xml`,
 *   `.../2006/relationships/graphicFrameDoc`) for every graphic frame;
 * - `drs/downrev.xml` (`a:downRevStg`, `.../2006/relationships/downRev`).
 *   It is REQUIRED: without it PowerPoint ignores the package. Its
 *   `shapeCheckSum` is an undocumented MD4 over PowerPoint's internal shape
 *   properties; a non-empty value that does not match makes PowerPoint
 *   discard the package, while an EMPTY value is accepted as-is ([MS-OI29500]
 *   3.1.4.2.1.2 `downRevStg`: "Third parties no longer need to generate the
 *   checksum"), so this writer always writes it empty.
 *
 * @module ppt/writer/metro-blob-package
 */

import JSZip from 'jszip';

import type { MetroParts, MetroRel } from './metro-blob-source';
import type { MetroBlobKind } from './metro-blob-xml';

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';

const ROOT: Record<MetroBlobKind, { path: string; contentType: string; relType: string }> = {
	ink: {
		path: 'drs/inkxml.xml',
		contentType: 'application/vnd.ms-office.DrsInk+xml',
		relType: 'http://schemas.microsoft.com/office/2007/relationships/inkXml',
	},
	graphicFrame: {
		path: 'drs/e2oDoc.xml',
		contentType: 'application/vnd.ms-office.DrsE2oDoc+xml',
		relType: 'http://schemas.microsoft.com/office/2006/relationships/graphicFrameDoc',
	},
};

const DOWNREV = {
	path: 'drs/downrev.xml',
	contentType: 'application/vnd.ms-office.DrsDownRev+xml',
	relType: 'http://schemas.microsoft.com/office/2006/relationships/downRev',
};

function escapeAttr(value: string): string {
	return value
		.replace(/&/gu, '&amp;')
		.replace(/"/gu, '&quot;')
		.replace(/</gu, '&lt;')
		.replace(/>/gu, '&gt;');
}

/** Serialise a `.rels` part. */
export function buildRelsXml(rels: MetroRel[]): string {
	const body = rels
		.map(
			(r) =>
				`<Relationship Id="${escapeAttr(r.id)}" Type="${escapeAttr(r.type)}" Target="${escapeAttr(
					r.target,
				)}"${r.external ? ' TargetMode="External"' : ''}/>`,
		)
		.join('');
	return `${XML_DECL}<Relationships xmlns="${REL_NS}">${body}</Relationships>`;
}

/** The `a:downRevStg` part, with the checksum deliberately left empty (see module doc). */
export function buildDownRevXml(shapeId: string | undefined): string {
	const id = shapeId && /^\d+$/u.test(shapeId) ? ` shapeId="${shapeId}"` : '';
	return `${XML_DECL}<a:downRevStg xmlns:a="${A_NS}" shapeCheckSum="" textCheckSum=""${id} ver="1"/>`;
}

function buildContentTypesXml(overrides: Map<string, string>): string {
	const body = [...overrides]
		.map(
			([path, type]) =>
				`<Override PartName="/${escapeAttr(path)}" ContentType="${escapeAttr(type)}"/>`,
		)
		.join('');
	return (
		`${XML_DECL}<Types xmlns="${CT_NS}">` +
		'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
		'<Default Extension="xml" ContentType="application/xml"/>' +
		`${body}</Types>`
	);
}

/** Inputs for one `metroBlob` package. */
export interface MetroBlobInput {
	kind: MetroBlobKind;
	/** The complete package-root element (see `metro-blob-xml.ts`). */
	rootXml: string;
	/** The element's `cNvPr` id, echoed into `downrev.xml`. */
	shapeId?: string;
	parts: MetroParts;
}

/** Assemble the `metroBlob` ZIP package bytes. */
export async function buildMetroBlobPackage(input: MetroBlobInput): Promise<Uint8Array> {
	const root = ROOT[input.kind];
	const zip = new JSZip();
	const overrides = new Map<string, string>([
		[root.path, root.contentType],
		...input.parts.contentTypes,
		[DOWNREV.path, DOWNREV.contentType],
	]);
	zip.file('[Content_Types].xml', buildContentTypesXml(overrides));
	zip.file(
		'_rels/.rels',
		buildRelsXml([
			{ id: 'rId1', type: root.relType, target: root.path, external: false },
			{ id: 'rId2', type: DOWNREV.relType, target: DOWNREV.path, external: false },
		]),
	);
	zip.file(root.path, XML_DECL + input.rootXml);
	if (input.parts.rootRels.length > 0) {
		const slash = root.path.lastIndexOf('/');
		const relsPath = `${root.path.slice(0, slash)}/_rels/${root.path.slice(slash + 1)}.rels`;
		zip.file(relsPath, buildRelsXml(input.parts.rootRels));
	}
	for (const [path, bytes] of input.parts.parts) {
		zip.file(path, bytes);
	}
	zip.file(DOWNREV.path, buildDownRevXml(input.shapeId));
	// JSZip adds a folder entry per path segment; an OPC package must not
	// carry them (see the same strip in `PptxHandlerRuntimeSavePipeline.ts`).
	for (const name of Object.keys(zip.files)) {
		if (zip.files[name]!.dir) {
			delete zip.files[name];
		}
	}
	return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
