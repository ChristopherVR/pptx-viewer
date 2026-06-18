# mtx-decompressor

[![npm version](https://img.shields.io/npm/v/mtx-decompressor.svg)](https://www.npmjs.com/package/mtx-decompressor)
[![license](https://img.shields.io/npm/l/mtx-decompressor.svg)](https://github.com/ChristopherVR/pptx-viewer/blob/main/LICENSE)

A zero-dependency TypeScript library that decompresses **MicroType Express (MTX)** compressed font data found inside **EOT** (Embedded OpenType) containers, producing standard **TrueType (.ttf)** font binaries.

MTX is a font compression format developed by Monotype, used inside EOT containers commonly found in older web pages and embedded in Microsoft Office documents (including PPTX). This library extracts the compressed data and reconstructs a standard `.ttf` file usable with standard font APIs. It has no dependencies and works in both browser and Node.js.

<samp>**[📦 npm](https://www.npmjs.com/package/mtx-decompressor)** · **[📖 Full docs](https://christophervr.github.io/pptx-viewer/)**</samp>

---

## Install

```bash
npm install mtx-decompressor
```

## Quick start

```typescript
import { decompressMtx, decompressEotFont } from 'mtx-decompressor';

// Decompress MTX-compressed font data
const fontData: Uint8Array = /* extracted from EOT container */;
const ttfBytes = decompressMtx(fontData, { encrypted: false, compressed: true });
// => Uint8Array containing a valid TrueType font

// Convenience wrapper with explicit boolean parameters
const ttf = decompressEotFont(fontData, /* compressed */ true, /* encrypted */ false);

// XOR-obfuscated data
const decrypted = decompressMtx(encryptedData, { encrypted: true, compressed: true });
```

## API

### `decompressMtx(fontData, options?)`

Decompress an MTX-compressed font into a TrueType binary.

| Parameter            | Type                         | Description                                                                   |
| -------------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| `fontData`           | `Uint8Array`                 | Raw font bytes (MTX-compressed, optionally encrypted)                         |
| `options.encrypted`  | `boolean` (default: `false`) | If `true`, XOR-decrypt with key `0x50` before decompression                   |
| `options.compressed` | `boolean` (default: `true`)  | If `false`, skip decompression and return the (possibly decrypted) data as-is |
| **Returns**          | `Uint8Array`                 | A valid TrueType (.ttf) font binary                                           |

### `decompressEotFont(fontData, compressed, encrypted)`

Convenience wrapper around `decompressMtx` taking explicit boolean parameters; returns a TrueType binary.

### `unpackMtx(data, size)`

Low-level: unpack an MTX blob into three LZCOMP-decompressed streams. Returns `{ streams: Uint8Array[], sizes: number[] }`.

The exported `SFNTContainer` and `SFNTTable` types describe the reconstructed font tables.

## How it works

The pipeline: optional XOR decryption → MTX header parsing (splits into three LZCOMP blocks) → LZCOMP decompression (sliding-window LZ with adaptive Huffman coding) → CTF parsing (reconstructs TrueType tables from the three Compact TrueType Font streams) → SFNT assembly (table directory, alignment, checksums). See the [full documentation](https://christophervr.github.io/pptx-viewer/) for the format details.

## Provenance

A TypeScript port of the MTX decompression code from [libeot](https://github.com/umanwizard/libeot) by Brennan Vincent (MPL-2.0). The original C implementation is based on the [MicroType Express specification](http://www.w3.org/Submission/MTX/) submitted to the W3C by Monotype Imaging.

## License

[Apache-2.0](LICENSE). Please keep the [`NOTICE`](NOTICE) file with redistributions.
