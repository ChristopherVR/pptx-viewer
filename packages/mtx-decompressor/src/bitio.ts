/**
 * BitIO - MSB-first bit-level reader from a Uint8Array buffer.
 *
 * Ported from libeot (MPL 2.0) MTX_BITIO implementation.
 *
 * The reader maintains a single-byte shift register (`bitBuffer`).
 * Bits are consumed most-significant-bit first.  When all bits in the
 * current byte have been shifted out, the next byte is loaded
 * automatically.
 */
export class BitIO {
  private data: Uint8Array;
  private index: number;
  private size: number;
  private bitBuffer: number = 0;
  private bitCount: number = 0;

  /**
   * @param data   Source byte buffer.
   * @param offset Starting byte offset into `data`.
   * @param size   Number of bytes available from `offset`.
   */
  constructor(data: Uint8Array, offset: number = 0, size?: number) {
    this.data = data;
    this.index = offset;
    this.size = size ?? data.length;
  }

  /**
   * Read a single bit from the stream.
   *
   * Mirrors `MTX_BITIO_input_bit`:
   *   - If `bitCount` has reached 0, load the next byte into `bitBuffer`
   *     and reset `bitCount` to 7.
   *   - Shift `bitBuffer` left by 1.
   *   - Return whether bit 8 (0x100) is set (i.e. the MSB that was
   *     shifted out of the original byte value).
   */
  inputBit(): boolean {
    if (this.bitCount-- === 0) {
      if (this.index >= this.size) {
        throw new Error("BitIO: end of data");
      }
      this.bitBuffer = this.data[this.index++];
      this.bitCount = 7;
    }
    this.bitBuffer <<= 1;
    return (this.bitBuffer & 0x100) !== 0;
  }

  /**
   * Read an unsigned integer of `numberOfBits` width, MSB first.
   *
   * Mirrors `MTX_BITIO_ReadValue`: accumulates bits from the most
   * significant down to the least significant.
   */
  readValue(numberOfBits: number): number {
    let value = 0;
    for (let i = numberOfBits - 1; i >= 0; i--) {
      value <<= 1;
      if (this.inputBit()) {
        value |= 1;
      }
    }
    return value;
  }
}
