/**
 * Re-fetch a `blob:` URL and re-encode it as a `data:` URL.
 *
 * Split out of `PptxHandlerRuntimeMediaData.ts` (already at the repo's
 * ~300-LOC guidance) so `getImageDataAsDataUrl`'s one non-trivial branch gets
 * its own focused, independently testable module instead of growing that
 * file further.
 *
 * @module runtime/blob-url-to-data-url
 */

/**
 * Fetch `blobUrl` and return the equivalent `data:` URL (base64), or
 * `blobUrl` itself unchanged if the fetch fails (a revoked or otherwise
 * unreadable blob URL): the caller's synchronous pixel decode simply will
 * not fire for that image, no worse than before this helper existed.
 */
export async function blobUrlToDataUrl(blobUrl: string, fallbackMimeType: string): Promise<string> {
	try {
		const response = await fetch(blobUrl);
		const bytes = new Uint8Array(await response.arrayBuffer());
		const mimeType = response.headers.get('Content-Type') || fallbackMimeType;
		let binary = '';
		for (let i = 0; i < bytes.length; i++) {
			binary += String.fromCharCode(bytes[i]!);
		}
		return `data:${mimeType};base64,${btoa(binary)}`;
	} catch {
		return blobUrl;
	}
}
