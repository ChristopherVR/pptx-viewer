import type { OlePptxElement, XmlObject } from '../../types';
import { parseDataUrlToBytes } from '../../utils/data-url-utils';
import type { SaveSlideContext } from './PptxHandlerRuntimeSaveElementEmbedding';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveSmartArtFabrication';

const OLE_OBJECT_RELATIONSHIP_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject';
const DEFAULT_OLE_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.oleObject';

function safeExtension(el: OlePptxElement, parsedExtension: string): string {
	const fileName = el.oleEmbeddedFileName ?? el.fileName;
	const fileExtension = fileName?.includes('.')
		? fileName.slice(fileName.lastIndexOf('.') + 1)
		: '';
	const candidate = el.oleFileExtension || fileExtension || parsedExtension;
	return /^[a-z0-9]+$/iu.test(candidate) ? candidate.toLowerCase() : 'bin';
}

function dataUrlMimeType(dataUrl: string): string | undefined {
	return /^data:(?<mime>[^;,]+)[;,]/u.exec(dataUrl)?.groups?.mime?.toLowerCase();
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	private pendingOleContentTypes?: Map<string, string>;

	private nextOleEmbeddingPath(extension: string): string {
		const used = new Set<number>();
		const pattern = /^ppt\/embeddings\/oleObject(?<index>\d+)\.[^/]+$/iu;
		for (const path of Object.keys(this.zip.files)) {
			const index = pattern.exec(path)?.groups?.index;
			if (index) {
				used.add(Number.parseInt(index, 10));
			}
		}
		let index = 1;
		while (used.has(index)) {
			index += 1;
		}
		return `ppt/embeddings/oleObject${index}.${extension}`;
	}

	/** Write an SDK-authored OLE payload and return its graphic-frame envelope. */
	protected createOleElementWithPayload(
		el: OlePptxElement,
		ctx: SaveSlideContext,
	): XmlObject | undefined {
		if (!el.oleEmbeddedData) {
			return undefined;
		}
		const parsed = parseDataUrlToBytes(el.oleEmbeddedData);
		if (!parsed || parsed.bytes.length === 0) {
			return undefined;
		}
		const extension = safeExtension(el, parsed.extension);
		const partPath = this.nextOleEmbeddingPath(extension);
		this.zip.file(partPath, parsed.bytes);

		const relationshipId = ctx.slideRelationshipRegistry.nextRelationshipId();
		ctx.slideRelationships.push({
			'@_Id': relationshipId,
			'@_Type': OLE_OBJECT_RELATIONSHIP_TYPE,
			'@_Target': `../embeddings/${partPath.slice(partPath.lastIndexOf('/') + 1)}`,
		});
		const contentType =
			el.oleEmbeddedMimeType ?? dataUrlMimeType(el.oleEmbeddedData) ?? DEFAULT_OLE_CONTENT_TYPE;
		(this.pendingOleContentTypes ??= new Map()).set(partPath, contentType);
		return this.createOleGraphicFrameXml(el, relationshipId);
	}

	/** Register every authored OLE payload in the OPC content-type manifest. */
	protected async ensureOleEmbeddingContentTypes(): Promise<void> {
		const pending = this.pendingOleContentTypes;
		this.pendingOleContentTypes = undefined;
		if (!pending || pending.size === 0) {
			return;
		}
		const xml = await this.zip.file('[Content_Types].xml')?.async('string');
		if (!xml) {
			return;
		}
		const data = this.parser.parse(xml) as XmlObject;
		const root = (data['Types'] ?? {}) as XmlObject;
		const overrides = Array.isArray(root['Override'])
			? (root['Override'] as XmlObject[])
			: root['Override']
				? [root['Override'] as XmlObject]
				: [];
		const existing = new Set(overrides.map((entry) => String(entry['@_PartName'] ?? '')));
		for (const [path, contentType] of pending) {
			const partName = `/${path}`;
			if (!existing.has(partName)) {
				overrides.push({ '@_PartName': partName, '@_ContentType': contentType });
			}
		}
		root['Override'] = overrides;
		data['Types'] = root;
		this.zip.file('[Content_Types].xml', this.builder.build(data));
	}
}
