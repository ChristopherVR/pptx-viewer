/**
 * ColorSchemeAtom writer, the inverse of `color-scheme.ts`'s
 * `parseColorSchemeAtom`. Always emits PowerPoint's default 8-colour
 * scheme: every shape/text colour in this writer is a literal RGB value
 * (see `colors.ts`), so the scheme itself is decorative only.
 *
 * @module ppt/writer/color-scheme-writer
 */

import { DEFAULT_SCHEME } from '../color-scheme';
import { RT } from '../record-types';
import { ByteWriter, record } from './byte-writer';
import { encodeColorRef } from './colors';

/**
 * Build a framed ColorSchemeAtom with the default scheme.
 *
 * @param recInstance - Defaults to `0x001` (a `Slide`'s own scheme, and a
 *   master's SECOND scheme atom; see `buildMainMasterContainer`'s doc for
 *   why a `MainMaster` needs a first one at `0x006` too).
 */
export function buildColorSchemeAtom(recInstance = 0x001): Uint8Array {
	const w = new ByteWriter();
	for (const rgb of DEFAULT_SCHEME) {
		w.u32(encodeColorRef(rgb));
	}
	return record(RT.ColorSchemeAtom, w.toBytes(), recInstance, false, 0);
}
