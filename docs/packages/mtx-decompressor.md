---
title: MTX Decompressor
description: mtx-decompressor is a zero-dependency TypeScript library that decompresses MicroType Express (MTX) font data from EOT containers back into standard TrueType font binaries.
---

# MTX Decompressor

`mtx-decompressor` is a **zero-dependency** TypeScript library that decompresses **MicroType Express (MTX)** font data found inside **EOT** (Embedded OpenType) containers, producing standard **TrueType (`.ttf`)** font binaries.

MicroType Express is a font compression format developed by Monotype, used inside EOT containers. EOT files turn up in older web pages and embedded in Microsoft Office documents, **including `.pptx` files**. This library extracts the compressed font data and reconstructs a standard TrueType file usable with normal font APIs.

::: warning Licensing - MPL-2.0
Unlike the rest of the monorepo (which is **Apache-2.0**), this package is licensed under the **Mozilla Public License 2.0 (MPL-2.0)**. It is a TypeScript port of the MTX decompression code from [libeot](https://github.com/umanwizard/libeot) by Brennan Vincent. The original C implementation derives from the [MicroType Express specification](http://www.w3.org/Submission/MTX/) submitted to the W3C by Monotype Imaging. Keep the MPL-2.0 obligations in mind when redistributing.
:::

The decompression pipeline runs:

1. **XOR decryption** (optional) - undo the simple XOR obfuscation (key `0x50`) used by some EOT producers.
2. **MTX unpacking** - split the data into three LZCOMP-compressed streams.
3. **LZCOMP decompression** - sliding-window LZ with adaptive (splay-tree) Huffman coding.
4. **CTF parsing** - reconstruct TrueType tables from the three decompressed Compact TrueType Font streams.
5. **SFNT assembly** - build a valid TrueType file with header, table directory, and checksums.

It has no dependencies and runs in both browser and Node.js environments.

## Install

```bash
bun add mtx-decompressor
# or: npm install mtx-decompressor
```

## Public API

The package barrel (`mtx-decompressor`) exports three functions and two types:

| Export                                               | Kind     | Purpose                                                                   |
| ---------------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| `decompressMtx(fontData, options?)`                  | function | Decompress MTX font data into a TrueType binary.                          |
| `decompressEotFont(fontData, compressed, encrypted)` | function | Convenience wrapper taking explicit booleans.                             |
| `unpackMtx(data, size)`                              | function | Low-level: unpack an MTX blob into its three LZCOMP-decompressed streams. |
| `SFNTContainer`                                      | type     | Collection of SFNT tables that make up a font.                            |
| `SFNTTable`                                          | type     | A single SFNT table record (tag, offset, data, checksum).                 |

### `decompressMtx(fontData, options?)`

```ts
function decompressMtx(
	fontData: Uint8Array,
	options?: { encrypted?: boolean; compressed?: boolean },
): Uint8Array;
```

| Parameter            | Type                        | Description                                                                    |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------ |
| `fontData`           | `Uint8Array`                | Raw font bytes (MTX-compressed, optionally encrypted).                         |
| `options.encrypted`  | `boolean` (default `false`) | If `true`, XOR-decrypt with key `0x50` before decompression.                   |
| `options.compressed` | `boolean` (default `true`)  | If `false`, skip decompression and return the (possibly decrypted) data as-is. |
| **Returns**          | `Uint8Array`                | A valid TrueType (`.ttf`) font binary.                                         |

### `decompressEotFont(fontData, compressed, encrypted)`

A convenience wrapper around `decompressMtx` that accepts explicit boolean parameters.

```ts
function decompressEotFont(
	fontData: Uint8Array,
	compressed: boolean,
	encrypted: boolean,
): Uint8Array;
```

### `unpackMtx(data, size)`

Low-level helper that unpacks an MTX blob into its three LZCOMP-decompressed streams - useful for inspection or custom pipelines.

```ts
function unpackMtx(data: Uint8Array, size: number): { streams: Uint8Array[]; sizes: number[] };
```

| Parameter   | Type                                         | Description                                         |
| ----------- | -------------------------------------------- | --------------------------------------------------- |
| `data`      | `Uint8Array`                                 | Raw (possibly decrypted) MTX data.                  |
| `size`      | `number`                                     | Total byte length of `data`.                        |
| **Returns** | `{ streams: Uint8Array[]; sizes: number[] }` | The three decompressed byte arrays and their sizes. |

## Example

```ts
import { decompressMtx, decompressEotFont } from 'mtx-decompressor';

// fontData is the compressed font payload extracted from an EOT container
const fontData: Uint8Array = /* … */;

// Decompress (compressed, not encrypted)
const ttfBytes = decompressMtx(fontData, { encrypted: false, compressed: true });
// => Uint8Array containing a valid TrueType font

// Equivalent convenience wrapper with positional booleans
const ttf = decompressEotFont(fontData, /* compressed */ true, /* encrypted */ false);

// Encrypted (XOR-obfuscated) payload
const decrypted = decompressMtx(encryptedData, { encrypted: true, compressed: true });

// Pass-through: decrypt only, no decompression - returns the input as-is
const raw = decompressMtx(rawData, { encrypted: false, compressed: false });
```

## Where it's used

In this monorepo the decompressor backs **embedded-font deobfuscation** in [`pptx-viewer-core`](/core/). PPTX files can embed fonts as EOT containers whose payload is MTX-compressed (and sometimes XOR-obfuscated). When the core engine encounters such an embedded font, it routes the bytes through `decompressMtx` / `decompressEotFont` to recover a usable TrueType binary for rendering.

::: info Output format
Despite the "TrueType/OTF" framing, the SFNT builder always emits a standard SFNT-wrapped TrueType (`.ttf`) container reconstructed from the decompressed CTF streams (`head`, `maxp`, `cmap`, `glyf`, `loca`, hinting tables, and friends), with correct per-table checksums and `head.checksumAdjustment`.
:::
