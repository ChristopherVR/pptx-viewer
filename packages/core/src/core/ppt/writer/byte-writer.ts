/**
 * Growable little-endian byte buffer plus MS-PPT / MS-ODRAW record framing
 * helpers for the legacy binary `.ppt` writer.
 *
 * Mirrors the record layout `record-stream.ts` reads: an 8-byte header
 * (2-byte packed ver/instance, 2-byte recType, 4-byte recLen) followed by
 * the record's data (which, for a container, is the concatenation of its
 * children's bytes).
 *
 * @module ppt/writer/byte-writer
 */

/** A minimal growable byte buffer for building binary records. */
export class ByteWriter {
	private chunks: Uint8Array[] = [];
	private length = 0;

	/** Total bytes written so far. */
	public get size(): number {
		return this.length;
	}

	private push(bytes: Uint8Array): void {
		this.chunks.push(bytes);
		this.length += bytes.length;
	}

	public u8(value: number): this {
		this.push(Uint8Array.of(value & 0xff));
		return this;
	}

	public u16(value: number): this {
		const b = new Uint8Array(2);
		new DataView(b.buffer).setUint16(0, value & 0xffff, true);
		this.push(b);
		return this;
	}

	public i16(value: number): this {
		const b = new Uint8Array(2);
		new DataView(b.buffer).setInt16(0, value | 0, true);
		this.push(b);
		return this;
	}

	public u32(value: number): this {
		const b = new Uint8Array(4);
		new DataView(b.buffer).setUint32(0, value >>> 0, true);
		this.push(b);
		return this;
	}

	public i32(value: number): this {
		const b = new Uint8Array(4);
		new DataView(b.buffer).setInt32(0, value | 0, true);
		this.push(b);
		return this;
	}

	public bytes(data: Uint8Array): this {
		this.push(data);
		return this;
	}

	/** Append raw bytes from another builder. */
	public append(other: ByteWriter): this {
		for (const chunk of other.chunks) {
			this.push(chunk);
		}
		return this;
	}

	/** Append a UTF-16LE encoded string, without a terminator. */
	public utf16(text: string): this {
		const b = new Uint8Array(text.length * 2);
		const view = new DataView(b.buffer);
		for (let i = 0; i < text.length; i++) {
			view.setUint16(i * 2, text.charCodeAt(i), true);
		}
		this.push(b);
		return this;
	}

	/** Append an ANSI (Latin-1 subset) encoded string, without a terminator. */
	public ansi(text: string): this {
		const b = new Uint8Array(text.length);
		for (let i = 0; i < text.length; i++) {
			b[i] = text.charCodeAt(i) & 0xff;
		}
		this.push(b);
		return this;
	}

	public toBytes(): Uint8Array {
		const out = new Uint8Array(this.length);
		let offset = 0;
		for (const chunk of this.chunks) {
			out.set(chunk, offset);
			offset += chunk.length;
		}
		return out;
	}
}

/**
 * Wrap `data` in an MS-PPT/MS-ODRAW record header.
 *
 * @param recType - Record type identifier (`RT.*` / `OA.*`).
 * @param data - The record's data bytes (already-assembled child records for
 *   a container).
 * @param recInstance - 12-bit instance value (default 0).
 * @param isContainer - Whether the record is a container (recVer = 0xF).
 * @param recVer - Explicit version nibble for a non-container atom
 *   (defaults to 0).
 */
export function record(
	recType: number,
	data: Uint8Array,
	recInstance = 0,
	isContainer = false,
	recVer = 0,
): Uint8Array {
	const header = new Uint8Array(8);
	const view = new DataView(header.buffer);
	const verAndInstance =
		((isContainer ? 0x0f : recVer & 0x0f) | ((recInstance & 0x0fff) << 4)) & 0xffff;
	view.setUint16(0, verAndInstance, true);
	view.setUint16(2, recType, true);
	view.setUint32(4, data.length >>> 0, true);
	const out = new Uint8Array(8 + data.length);
	out.set(header, 0);
	out.set(data, 8);
	return out;
}

/** Concatenate a list of already-framed records into one container's data. */
export function concat(parts: Uint8Array[]): Uint8Array {
	let total = 0;
	for (const part of parts) {
		total += part.length;
	}
	const out = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}
