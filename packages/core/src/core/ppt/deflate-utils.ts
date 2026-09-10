/**
 * Shared zlib-wrapped (RFC 1950) DEFLATE inflate helper for the legacy
 * binary `.ppt` reader. Both metafile BLIPs (`pictures.ts`) and compressed
 * OLE storages (`ole-embed-parser.ts`) use this exact same compression
 * convention, so this is the one place that decides how it is decoded.
 *
 * @module ppt/deflate-utils
 */

/**
 * Inflate zlib-wrapped data via the standard `DecompressionStream`.
 *
 * Reads the decompressed stream chunk-by-chunk rather than via
 * `new Response(stream).arrayBuffer()`, and keeps whatever chunks were
 * already produced if a later `read()` rejects, instead of discarding
 * everything: a real PowerPoint-authored `ExOleObjStgCompressedAtom` was
 * measured (COM-authored `e2e/fixtures/ole-embed-excel.ppt`) to write a
 * DEFLATE stream that never reaches `Z_FINISH` (no clean final block/
 * checksum trailer) even though every byte up to that point decodes
 * correctly to the exact declared decompressed size; `Response.arrayBuffer()`
 * rejects the whole read on that trailing error and loses the (complete,
 * correct) data with it. This is the same leniency Node's own
 * `zlib.inflateSync(data, { finishFlush: zlib.constants.Z_SYNC_FLUSH })`
 * provides, reproduced against the standard Streams API so it works in a
 * browser too.
 *
 * @returns The decompressed bytes, or `undefined` when `DecompressionStream`
 *   is unavailable in this runtime, or no bytes were recovered at all.
 */
export async function inflateZlib(data: Uint8Array): Promise<Uint8Array | undefined> {
	if (typeof DecompressionStream === 'undefined') {
		return undefined;
	}
	try {
		const stream = new Blob([data.slice().buffer as ArrayBuffer])
			.stream()
			.pipeThrough(new DecompressionStream('deflate'));
		const reader = stream.getReader();
		const chunks: Uint8Array[] = [];
		let total = 0;
		for (;;) {
			let result: ReadableStreamReadResult<Uint8Array>;
			try {
				result = await reader.read();
			} catch {
				break;
			}
			if (result.done) {
				break;
			}
			chunks.push(result.value);
			total += result.value.length;
		}
		if (total === 0) {
			return undefined;
		}
		const out = new Uint8Array(total);
		let offset = 0;
		for (const chunk of chunks) {
			out.set(chunk, offset);
			offset += chunk.length;
		}
		return out;
	} catch {
		return undefined;
	}
}
