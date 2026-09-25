/**
 * ColorSchemeAtom writer, the inverse of `color-scheme.ts`'s
 * `parseColorSchemeAtom`. Emits PowerPoint's default 8-colour scheme, or
 * the main master's scheme derived from the deck's theme (see
 * `master-roundtrip-source.ts`): every shape/text colour in this writer is
 * a literal RGB value (see `colors.ts`), so the scheme only decides what
 * PowerPoint reports as the theme colours.
 *
 * @module ppt/writer/color-scheme-writer
 */

import { DEFAULT_SCHEME } from '../color-scheme';
import { RT } from '../record-types';
import { ByteWriter, record } from './byte-writer';
import { encodeColorRef } from './colors';

/**
 * Build a framed ColorSchemeAtom.
 *
 * @param recInstance - Defaults to `0x001` (a `Slide`'s own scheme, and a
 *   master's SECOND scheme atom; see `buildMainMasterContainer`'s doc for
 *   why a `MainMaster` needs a first one at `0x006` too).
 * @param colors - The 8 scheme colours (background, text, shadow, title,
 *   fill, accent, hyperlink, followed hyperlink); the default scheme when
 *   omitted or not exactly 8.
 */
export function buildColorSchemeAtom(recInstance = 0x001, colors?: readonly string[]): Uint8Array {
	const w = new ByteWriter();
	for (const rgb of colors?.length === 8 ? colors : DEFAULT_SCHEME) {
		w.u32(encodeColorRef(rgb));
	}
	return record(RT.ColorSchemeAtom, w.toBytes(), recInstance, false, 0);
}
