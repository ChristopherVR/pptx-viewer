/**
 * WAV (RIFF/WAVE) duration: exact, from the `fmt ` chunk's byte rate and the
 * `data` chunk's size. No decoding of sample data itself.
 *
 * @module media-duration-wav
 */

export function estimateWavDurationMs(bytes: Uint8Array): number | undefined {
	if (bytes.length < 12) {
		return undefined;
	}
	const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
	const isWave = bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45;
	if (!isRiff || !isWave) {
		return undefined;
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let offset = 12;
	let byteRate: number | undefined;
	let dataSize: number | undefined;
	while (offset + 8 <= bytes.length) {
		const id = String.fromCharCode(
			bytes[offset]!,
			bytes[offset + 1]!,
			bytes[offset + 2]!,
			bytes[offset + 3]!,
		);
		const size = view.getUint32(offset + 4, true);
		const dataStart = offset + 8;
		if (id === 'fmt ' && dataStart + 16 <= bytes.length) {
			byteRate = view.getUint32(dataStart + 8, true);
		} else if (id === 'data') {
			dataSize = size;
		}
		if (byteRate !== undefined && dataSize !== undefined) {
			break;
		}
		offset = dataStart + size + (size % 2); // chunks are word-aligned
	}
	if (!byteRate || dataSize === undefined) {
		return undefined;
	}
	return (dataSize / byteRate) * 1000;
}
