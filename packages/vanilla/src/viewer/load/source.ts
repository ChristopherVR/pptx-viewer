/**
 * Content sources accepted by the vanilla viewer: raw bytes, a Blob/File, or
 * a URL string to fetch.
 */
export type PptxViewerSource = ArrayBuffer | Uint8Array | Blob | string;

/** Normalise any accepted source into an `ArrayBuffer` of `.pptx` bytes. */
export async function resolveSourceToBuffer(source: PptxViewerSource): Promise<ArrayBuffer> {
	if (typeof source === 'string') {
		const response = await fetch(source);
		if (!response.ok) {
			throw new Error(`Failed to fetch presentation (${response.status}) from ${source}`);
		}
		return response.arrayBuffer();
	}
	if (source instanceof Blob) {
		return source.arrayBuffer();
	}
	if (source instanceof Uint8Array) {
		// Copy out the exact view so offsets into shared buffers are respected
		// (also converts a SharedArrayBuffer backing into a plain ArrayBuffer).
		const copy = new Uint8Array(source.byteLength);
		copy.set(source);
		return copy.buffer;
	}
	return source;
}
