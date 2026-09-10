/**
 * CRC-32 (PNG's checksum, ISO 3309 / ITU-T V.42 polynomial 0xEDB88320) pure
 * byte-level implementation. Used to checksum every PNG chunk in
 * `png-chunk-builder`. No external dependency, mirroring the house style of
 * `gif-encoder.ts` (self-contained byte encoders with no npm image library).
 */

let table: Uint32Array | undefined;

function getTable(): Uint32Array {
	if (table) {
		return table;
	}
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		t[n] = c >>> 0;
	}
	table = t;
	return t;
}

/** CRC-32 checksum of `bytes`, as required by every PNG chunk trailer. */
export function crc32(bytes: Uint8Array): number {
	const t = getTable();
	let crc = 0xffffffff;
	for (let i = 0; i < bytes.length; i++) {
		crc = t[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}
