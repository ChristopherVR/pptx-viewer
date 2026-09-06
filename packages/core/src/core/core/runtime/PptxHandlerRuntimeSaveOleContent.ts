import type { OlePptxElement, XmlObject } from '../../types';
import { parseDataUrlToBytes } from '../../utils/data-url-utils';
import { replaceOleEmbedding } from '../../utils/ole-embedded-replace';
import type { SaveSlideContext } from './PptxHandlerRuntimeSaveElementEmbedding';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveSmartArtFabrication';

const OLE_IMAGE_RELATIONSHIP_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';

/** One queued rewrite of an existing OLE embedding part, resolved during the async save finalize step. */
interface PendingOleContentUpdate {
	targetPath: string;
	newPayloadBytes: Uint8Array;
	fileName?: string;
}

function resolveRelationshipTarget(
	slideRelationships: XmlObject[],
	relationshipId: string | undefined,
): string | undefined {
	if (!relationshipId) {
		return undefined;
	}
	const rel = slideRelationships.find((entry) => String(entry['@_Id'] ?? '') === relationshipId);
	return rel ? String(rel['@_Target'] ?? '') || undefined : undefined;
}

/**
 * Save-time write-back for OLE content edits made via `ole-edit-api.ts`
 * (`element.oleContentDirty`): rewrites the embedded payload part in place
 * (preserving its original container shape via `replaceOleEmbedding`) and
 * the preview `p:pic` blip, for an OLE object loaded from `rawXml`.
 *
 * SDK-created / rawXml-less OLE elements are unaffected: those are written
 * fresh by `createOleElementWithPayload` (`PptxHandlerRuntimeSaveOleEmbedding.ts`),
 * which already embeds whatever `oleEmbeddedData` holds at save time.
 */
export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected pendingOleContentUpdates?: PendingOleContentUpdate[];
	private nextOlePreviewImageIndex?: number;

	private nextOlePreviewImagePath(): string {
		if (this.nextOlePreviewImageIndex === undefined) {
			const used = new Set<number>();
			const pattern = /^ppt\/media\/image(?<index>\d+)\.[^/]+$/iu;
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
			this.nextOlePreviewImageIndex = index;
		}
		return `ppt/media/image${this.nextOlePreviewImageIndex++}.png`;
	}

	/**
	 * Apply a pending OLE content edit to an already-built `p:oleObj` XML
	 * node: queue the embedded-payload rewrite (needs the original bytes,
	 * read asynchronously later) and write the regenerated preview image
	 * synchronously (JSZip's `.file(path, bytes)` setter needs no I/O).
	 */
	protected applyOleContentUpdateToShape(
		oleObj: XmlObject,
		oleEl: OlePptxElement,
		ctx: SaveSlideContext,
	): void {
		if (!oleEl.oleContentDirty) {
			return;
		}

		if (oleEl.oleEmbeddedData && !oleEl.isLinked && oleEl.oleTarget) {
			const parsed = parseDataUrlToBytes(oleEl.oleEmbeddedData);
			const targetPath = this.resolveImagePath(ctx.slide.id, oleEl.oleTarget);
			if (parsed && targetPath) {
				(this.pendingOleContentUpdates ??= []).push({
					targetPath,
					newPayloadBytes: parsed.bytes,
					fileName: oleEl.oleEmbeddedFileName ?? oleEl.fileName,
				});
			}
		}

		if (oleEl.previewImageData) {
			const parsedPreview = parseDataUrlToBytes(oleEl.previewImageData);
			if (parsedPreview) {
				this.writeOlePreviewImageSync(oleObj, ctx, parsedPreview.bytes);
			}
		}

		oleEl.oleContentDirty = false;
	}

	/** Overwrite the existing preview image part, or create + link a new one when none exists yet. */
	private writeOlePreviewImageSync(
		oleObj: XmlObject,
		ctx: SaveSlideContext,
		pngBytes: Uint8Array,
	): void {
		const picture = oleObj['p:pic'] as XmlObject | undefined;
		const blip = (picture?.['p:blipFill'] as XmlObject | undefined)?.['a:blip'] as
			| XmlObject
			| undefined;
		if (!blip) {
			return;
		}
		const existingRid = String(blip['@_r:embed'] ?? '').trim() || undefined;
		const existingTarget = resolveRelationshipTarget(ctx.slideRelationships, existingRid);
		const existingPath = existingTarget
			? this.resolveImagePath(ctx.slide.id, existingTarget)
			: undefined;

		if (existingPath) {
			this.zip.file(existingPath, pngBytes);
			return;
		}

		const partPath = this.nextOlePreviewImagePath();
		this.zip.file(partPath, pngBytes);
		const relationshipId = ctx.slideRelationshipRegistry.nextRelationshipId();
		ctx.slideRelationships.push({
			'@_Id': relationshipId,
			'@_Type': OLE_IMAGE_RELATIONSHIP_TYPE,
			'@_Target': `../media/${partPath.slice(partPath.lastIndexOf('/') + 1)}`,
		});
		blip['@_r:embed'] = relationshipId;
	}

	/** Rewrite every queued OLE embedding part, preserving its original container shape. */
	protected async processPendingOleContentUpdates(): Promise<void> {
		const pending = this.pendingOleContentUpdates;
		this.pendingOleContentUpdates = undefined;
		if (!pending || pending.length === 0) {
			return;
		}
		for (const update of pending) {
			const originalFile = this.zip.file(update.targetPath);
			const originalBytes = originalFile
				? await originalFile.async('uint8array')
				: new Uint8Array(0);
			const finalBytes = replaceOleEmbedding(originalBytes, update.newPayloadBytes, {
				fileName: update.fileName,
			});
			this.zip.file(update.targetPath, finalBytes);
		}
	}
}
