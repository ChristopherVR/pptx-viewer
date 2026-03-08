/**
 * Top-level MicroType Express (MTX) decompression pipeline.
 * Ported from libeot (MPL 2.0) — writeFontFile.c / liblzcomp.c
 *
 * Combines LZ decompression, CTF parsing, and SFNT assembly to
 * produce a usable TrueType font from compressed MTX / EOT data.
 */

import { lzcompDecompress } from "./lzcomp";
import { parseCTF } from "./ctf-parser";
import { dumpContainer } from "./sfnt-builder";
import { Stream } from "./stream";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** XOR key used for MTX encryption. */
const ENCRYPTION_KEY = 0x50;

// ---------------------------------------------------------------------------
// MTX unpacking (3-stream decompression)
// ---------------------------------------------------------------------------

/**
 * Unpack an MTX blob into three LZCOMP-decompressed streams.
 *
 * MTX header layout (10 bytes, big-endian):
 *   byte  0     : versionMagic
 *   bytes 1–3   : copyLimit  (24-bit BE, informational only)
 *   bytes 4–6   : offset2    (24-bit BE)
 *   bytes 7–9   : offset3    (24-bit BE)
 *
 * The data following the header is split into three contiguous
 * compressed blocks whose boundaries are determined by the offsets.
 *
 * @param data  Raw (possibly decrypted) MTX data.
 * @param size  Total byte length of `data`.
 * @returns An object containing the three decompressed byte arrays and
 *          their respective sizes.
 */
export function unpackMtx(
  data: Uint8Array,
  size: number,
): { streams: Uint8Array[]; sizes: number[] } {
  // --- Read 10-byte MTX header -------------------------------------------
  const versionMagic = data[0];

  // 24-bit big-endian reads
  // const copyLimit = (data[1] << 16) | (data[2] << 8) | data[3]; // not used
  const offset2 = (data[4] << 16) | (data[5] << 8) | data[6];
  const offset3 = (data[7] << 16) | (data[8] << 8) | data[9];

  // Block boundaries
  const offsets = [10, offset2, offset3];
  const sizes = [offset2 - 10, offset3 - offset2, size - offset3];

  // Decompress each block
  const streams: Uint8Array[] = [];
  const decompressedSizes: number[] = [];

  for (let i = 0; i < 3; i++) {
    const block = data.subarray(offsets[i]);
    const decompressed = lzcompDecompress(block, sizes[i], versionMagic);
    streams.push(decompressed);
    decompressedSizes.push(decompressed.length);
  }

  return { streams, sizes: decompressedSizes };
}

// ---------------------------------------------------------------------------
// Main decompression entry point
// ---------------------------------------------------------------------------

/**
 * Decompress an MTX-compressed font (e.g. from an EOT wrapper) into a
 * standard TrueType font binary.
 *
 * @param fontData    Raw font bytes (MTX-compressed, optionally encrypted).
 * @param options.encrypted   If `true`, XOR-decrypt with {@link ENCRYPTION_KEY}.
 * @param options.compressed  If `false`, skip decompression and return the
 *                            (possibly decrypted) data as-is.
 * @returns A `Uint8Array` containing a valid TrueType (.ttf) font.
 */
export function decompressMtx(
  fontData: Uint8Array,
  options?: { encrypted?: boolean; compressed?: boolean },
): Uint8Array {
  const encrypted = options?.encrypted ?? false;
  const compressed = options?.compressed ?? true;

  // --- Decryption --------------------------------------------------------
  let data: Uint8Array;
  if (encrypted) {
    data = new Uint8Array(fontData.length);
    for (let i = 0; i < fontData.length; i++) {
      data[i] = fontData[i] ^ ENCRYPTION_KEY;
    }
  } else {
    // Work on a copy so we don't mutate the caller's buffer.
    data = fontData;
  }

  // --- Early exit when not compressed ------------------------------------
  if (!compressed) {
    return data;
  }

  // --- Unpack 3 LZCOMP streams ------------------------------------------
  const { streams } = unpackMtx(data, data.length);

  // --- Wrap each decompressed buffer in a Stream -------------------------
  const streamObjects = streams.map((buf) => new Stream(buf, buf.length));

  // --- Parse CTF structure -----------------------------------------------
  const container = parseCTF(streamObjects);

  // --- Assemble final TrueType font -------------------------------------
  return dumpContainer(container);
}

// ---------------------------------------------------------------------------
// Convenience wrapper (explicit boolean parameters)
// ---------------------------------------------------------------------------

/**
 * Decompress an EOT-embedded font.
 *
 * This is a thin wrapper around {@link decompressMtx} that accepts explicit
 * boolean parameters instead of an options object.
 *
 * @param fontData    Raw font bytes extracted from the EOT container.
 * @param compressed  Whether the data is MTX-compressed.
 * @param encrypted   Whether the data is XOR-encrypted.
 * @returns A `Uint8Array` containing a valid TrueType (.ttf) font.
 */
export function decompressEotFont(
  fontData: Uint8Array,
  compressed: boolean,
  encrypted: boolean,
): Uint8Array {
  return decompressMtx(fontData, { encrypted, compressed });
}
