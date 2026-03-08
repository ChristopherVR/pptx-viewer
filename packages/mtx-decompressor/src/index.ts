/**
 * mtx-decompressor — MicroType Express (MTX) font decompressor.
 *
 * Converts MTX-compressed font data (found inside EOT containers) back into
 * standard TrueType (.ttf) font files.
 *
 * Ported from libeot (MPL 2.0) by Brennan T. Vincent.
 * See: https://github.com/nicowilliams/libeot
 *
 * @packageDocumentation
 */

export { decompressMtx, decompressEotFont, unpackMtx } from "./mtx-decompress";
export type { SFNTContainer, SFNTTable } from "./ctf-parser";
