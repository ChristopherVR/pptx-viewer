/**
 * Small bounds-checked little-endian cursor over a DataView, used by the
 * text formatting parsers.
 *
 * @module ppt/text/byte-cursor
 */

/** Sequential little-endian reader with explicit bounds checks. */
export class ByteCursor {
	public pos: number;

	public constructor(
		private readonly view: DataView,
		start: number,
		private readonly end: number,
	) {
		this.pos = start;
	}

	/** True when `bytes` more bytes can be read without overrunning. */
	public canRead(bytes: number): boolean {
		return this.pos + bytes <= this.end;
	}

	public u16(): number {
		const v = this.view.getUint16(this.pos, true);
		this.pos += 2;
		return v;
	}

	public i16(): number {
		const v = this.view.getInt16(this.pos, true);
		this.pos += 2;
		return v;
	}

	public u32(): number {
		const v = this.view.getUint32(this.pos, true);
		this.pos += 4;
		return v;
	}

	/** Read four raw bytes. */
	public bytes4(): [number, number, number, number] {
		const v = this.view;
		const p = this.pos;
		this.pos += 4;
		return [v.getUint8(p), v.getUint8(p + 1), v.getUint8(p + 2), v.getUint8(p + 3)];
	}

	public skip(bytes: number): void {
		this.pos += bytes;
	}
}
