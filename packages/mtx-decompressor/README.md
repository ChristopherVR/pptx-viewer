# mtx-decompressor

A zero-dependency TypeScript library that decompresses **MicroType Express (MTX)** compressed font data found inside **EOT** (Embedded OpenType) containers, producing standard **TrueType (.ttf)** font binaries.

## Table of Contents

- [mtx-decompressor](#mtx-decompressor)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Quick Start](#quick-start)
  - [API Reference](#api-reference)
    - [`decompressMtx(fontData, options?)`](#decompressmtxfontdata-options)
    - [`decompressEotFont(fontData, compressed, encrypted)`](#decompresseotfontfontdata-compressed-encrypted)
    - [`unpackMtx(data, size)`](#unpackmtxdata-size)
  - [Architecture](#architecture)
    - [Pipeline](#pipeline)
    - [Module Map](#module-map)
  - [Deep Dive: How It Works](#deep-dive-how-it-works)
    - [1. MTX Header](#1-mtx-header)
    - [2. LZCOMP Decompression](#2-lzcomp-decompression)
    - [3. CTF Parsing](#3-ctf-parsing)
    - [4. SFNT Assembly](#4-sfnt-assembly)
  - [File Structure Reference](#file-structure-reference)
  - [Provenance](#provenance)

---

## Overview

MicroType Express (MTX) is a font compression format developed by Monotype, used inside Embedded OpenType (EOT) containers. EOT files are commonly found in older web pages and embedded in Microsoft Office documents (including PPTX files). This library extracts the compressed font data and reconstructs a standard TrueType (.ttf) file that can be used with standard font APIs.

The decompression pipeline involves:
1. **XOR decryption** (optional) -- undo the simple XOR obfuscation used by some EOT producers
2. **MTX unpacking** -- split the data into three LZCOMP-compressed streams
3. **LZCOMP decompression** -- sliding-window decompression with adaptive Huffman coding
4. **CTF parsing** -- reconstruct TrueType tables from the three decompressed Compact TrueType Font streams
5. **SFNT assembly** -- build a valid TrueType font file with proper header, table directory, and checksums

The library has **no dependencies** and works in both browser and Node.js environments.

---

## Quick Start

```typescript
import { decompressMtx, decompressEotFont } from "mtx-decompressor";

// Decompress MTX-compressed font data
const fontData: Uint8Array = /* extracted from EOT container */;
const ttfBytes = decompressMtx(fontData, { encrypted: false, compressed: true });
// => Uint8Array containing a valid TrueType font

// Convenience wrapper with explicit boolean parameters
const ttf = decompressEotFont(fontData, /* compressed */ true, /* encrypted */ false);

// Handle encrypted font data (XOR-obfuscated)
const decrypted = decompressMtx(encryptedData, { encrypted: true, compressed: true });

// Pass-through uncompressed data (just decrypt if needed)
const raw = decompressMtx(rawData, { encrypted: false, compressed: false });
// => Returns the input data as-is
```

---

## API Reference

### `decompressMtx(fontData, options?)`

Decompress an MTX-compressed font into a standard TrueType font binary.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fontData` | `Uint8Array` | Raw font bytes (MTX-compressed, optionally encrypted) |
| `options.encrypted` | `boolean` (default: `false`) | If `true`, XOR-decrypt with key `0x50` before decompression |
| `options.compressed` | `boolean` (default: `true`) | If `false`, skip decompression and return the (possibly decrypted) data as-is |
| **Returns** | `Uint8Array` | A valid TrueType (.ttf) font binary |

### `decompressEotFont(fontData, compressed, encrypted)`

Convenience wrapper around `decompressMtx` that accepts explicit boolean parameters.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fontData` | `Uint8Array` | Raw font bytes extracted from the EOT container |
| `compressed` | `boolean` | Whether the data is MTX-compressed |
| `encrypted` | `boolean` | Whether the data is XOR-encrypted |
| **Returns** | `Uint8Array` | A valid TrueType (.ttf) font binary |

### `unpackMtx(data, size)`

Low-level function: unpack an MTX blob into three LZCOMP-decompressed streams.

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | `Uint8Array` | Raw (possibly decrypted) MTX data |
| `size` | `number` | Total byte length of `data` |
| **Returns** | `{ streams: Uint8Array[], sizes: number[] }` | Three decompressed byte arrays and their sizes |

### Exported Types

| Type | Description |
|------|-------------|
| `SFNTContainer` | Collection of SFNT tables that constitute a font |
| `SFNTTable` | A single SFNT table record (tag, offset, data, checksum) |

---

## Architecture

### Pipeline

```
EOT Container (Uint8Array)
    |
[Optional: XOR Decryption (key = 0x50)]
    |
MTX Header Parsing (10 bytes)
    | Extract: versionMagic, offset2, offset3
    | Split into 3 compressed blocks
    |
+---+---+---+
|   |   |   |
v   v   v   |
LZCOMP Decompression (x3)
    | Sliding-window LZ with adaptive Huffman
    | + optional run-length decoding
    |
v   v   v
3 Decompressed Streams
    |
CTF Parser
    | Stream 0: table directory + most table data
    | Stream 1: glyph contour points (triplet-encoded)
    | Stream 2: glyph instructions (hints)
    |
    | Reconstructs TrueType tables:
    |   head, maxp, OS/2, name, cmap, hhea, hmtx,
    |   post, fpgm, prep, cvt, loca, glyf, ...
    |
v
SFNT Builder
    | Assembles tables into TrueType container
    | Computes table directory (offsets, checksums)
    | Writes 12-byte SFNT header
    | Applies head.checksumAdjustment
    |
v
TrueType Font (Uint8Array)
```

### Module Map

```
                +--- index.ts (public API) ---+
                |                             |
                v                             |
        mtx-decompress.ts                     |
        (pipeline orchestrator)               |
                |                             |
    +-----------+-----------+                 |
    |           |           |                 |
    v           v           v                 |
 lzcomp.ts  ctf-parser.ts  sfnt-builder.ts   |
 (LZCOMP     (CTF ->       (tables ->        |
  decompress) SFNT tables)  TTF binary)      |
    |           |                             |
    v           v                             |
 bitio.ts   triplet-encodings.ts             |
 (bit-level  (glyph point                    |
  I/O)       delta encoding)                 |
    |                                         |
    v                                         |
 ahuff.ts                                    |
 (adaptive Huffman                            |
  splay-tree coder)                           |
    |                                         |
    v                                         |
 stream.ts  <---------------------------------+
 (big-endian binary reader/writer)
```

---

## Deep Dive: How It Works

### 1. MTX Header

The MTX format begins with a 10-byte header (big-endian):

```
Offset  Size  Field
0       1     versionMagic  -- compression version identifier
1       3     copyLimit     -- 24-bit BE (informational, not used in decompression)
4       3     offset2       -- 24-bit BE: byte offset to second compressed block
7       3     offset3       -- 24-bit BE: byte offset to third compressed block
```

The data following the header is divided into three contiguous compressed blocks:
- **Block 0**: bytes 10 to `offset2 - 1`
- **Block 1**: bytes `offset2` to `offset3 - 1`
- **Block 2**: bytes `offset3` to end

Each block is independently LZCOMP-compressed.

### 2. LZCOMP Decompression

Each block is decompressed using a sliding-window LZ algorithm with adaptive Huffman coding:

- **Sliding window**: A 64 KB circular buffer pre-loaded with a deterministic pattern (7168 bytes of preload data covering common byte sequences in fonts)
- **Adaptive Huffman tree**: A splay-tree-based Huffman coder that dynamically adjusts symbol weights as data is decoded. Supports two symbol ranges (256 for literals, configurable for matches).
- **Match encoding**: Length-distance pairs where lengths and distances use chunked variable-width encoding (3-bit chunks with continuation bits)
- **Run-length output**: Optional post-processing that expands run-length-encoded sequences in the decompressed output

The `versionMagic` byte from the MTX header determines which variant of the LZCOMP algorithm to use.

### 3. CTF Parsing

The three decompressed streams are interpreted as a Compact TrueType Font (CTF):

- **Stream 0**: Contains the SFNT table directory and data for most TrueType tables (`head`, `maxp`, `OS/2`, `name`, `cmap`, `hhea`, `hmtx`, `post`, `fpgm`, `prep`, `cvt`, etc.)
- **Stream 1**: Contains glyph contour point data encoded using **triplet encoding** -- a compact delta-based encoding where each point's X/Y deltas and on-curve flag are packed into 1-5 bytes using a lookup table of 192 encoding patterns
- **Stream 2**: Contains glyph hint instructions (TrueType bytecode)

The CTF parser reconstructs the `glyf` (glyph data) and `loca` (glyph location index) tables by iterating over each glyph, reading its contour endpoints, decoding triplet-encoded point deltas, and assembling valid TrueType glyph records.

### 4. SFNT Assembly

The SFNT builder takes the reconstructed table collection and produces a valid TrueType font file:

1. Sort tables alphabetically by tag
2. Write the 12-byte SFNT header (`sfVersion`, `numTables`, `searchRange`, `entrySelector`, `rangeShift`)
3. Write the 16-byte table directory entries (tag, checksum, offset, length)
4. Write table data with 4-byte alignment padding
5. Compute individual table checksums
6. Compute and apply the overall `head.checksumAdjustment` value (0xB1B0AFBA minus the file checksum)

---

## File Structure Reference

```
src/
+-- index.ts                  # Public API: decompressMtx, decompressEotFont, unpackMtx
+-- mtx-decompress.ts         # Pipeline orchestrator: decrypt -> unpack -> parse -> assemble
+-- lzcomp.ts                 # LZCOMP sliding-window decompression
+-- ahuff.ts                  # Adaptive Huffman splay-tree coder
+-- bitio.ts                  # Bit-level I/O reader for compressed streams
+-- ctf-parser.ts             # CTF (Compact TrueType Font) table reconstruction
+-- triplet-encodings.ts      # Glyph point delta encoding lookup table (192 patterns)
+-- sfnt-builder.ts           # TrueType SFNT container assembly with checksums
+-- stream.ts                 # Big-endian binary stream reader/writer
+-- mtx-decompress.test.ts    # Integration tests
+-- lzcomp.test.ts            # LZCOMP unit tests
+-- ahuff.test.ts             # Adaptive Huffman unit tests
+-- bitio.test.ts             # Bit I/O unit tests
+-- ctf-parser.test.ts        # CTF parser unit tests
+-- sfnt-builder.test.ts      # SFNT builder unit tests
+-- stream.test.ts            # Stream unit tests
+-- triplet-encodings.test.ts # Triplet encoding unit tests
```

---

## Provenance

This library is a TypeScript port of the MTX decompression code from [libeot](https://github.com/nicowilliams/libeot) by Brennan T. Vincent, which is licensed under the Mozilla Public License 2.0 (MPL-2.0).

The original C implementation is based on the [MicroType Express specification](http://www.w3.org/Submission/MTX/) submitted to the W3C by Monotype Imaging.
