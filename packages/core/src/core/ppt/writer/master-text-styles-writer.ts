/**
 * TextMasterStyleAtom writer for the main master's title/body defaults, the
 * inverse of `text/master-styles.ts`.
 *
 * Written with empty (all-inherit) exceptions: PowerPoint supplies its own
 * built-in title/body defaults when a level declares no explicit
 * properties (`masks = 0`), which is both spec-correct and the lowest-risk
 * encoding, since every shape/run in this writer already carries its own
 * explicit character formatting (see `text-atom-writer.ts`) rather than
 * relying on master inheritance.
 *
 * @module ppt/writer/master-text-styles-writer
 */

import { RT } from '../record-types';
import { ByteWriter, record } from './byte-writer';

function buildEmptyLevel(): Uint8Array {
	// One TextPFException (mask=0) followed by one TextCFException (mask=0).
	return new ByteWriter().u32(0).u32(0).toBytes();
}

function buildMasterStyleAtom(recInstance: number): Uint8Array {
	const data = new ByteWriter().u16(1).bytes(buildEmptyLevel()).toBytes();
	return record(RT.TextMasterStyleAtom, data, recInstance, false, 0);
}

/** Build the title (instance 0) and body (instance 1) TextMasterStyleAtoms. */
export function buildMasterTextStyles(): Uint8Array {
	return new ByteWriter().bytes(buildMasterStyleAtom(0)).bytes(buildMasterStyleAtom(1)).toBytes();
}
