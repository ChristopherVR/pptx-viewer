/**
 * TextMasterStyleAtom writer for a `MainMaster`'s per-text-type defaults,
 * the inverse of `text/master-styles.ts`.
 *
 * Instances 0 (title) and 1 (body) are written with empty (all-inherit)
 * exceptions: PowerPoint supplies its own built-in title/body defaults when
 * a level declares no explicit properties (`masks = 0`), which is both
 * spec-correct and the lowest-risk encoding, since every shape/run in this
 * writer already carries its own explicit character formatting (see
 * `text-atom-writer.ts`) rather than relying on master inheritance.
 *
 * Instances 2 (notes), 4 (other), 5 (centre title), 6 (centre body), 7
 * (half body) and 8 (quarter body) are copied verbatim, byte for byte, from
 * a COM-authored fixture rather than synthesised: their own internal field
 * semantics are not documented anywhere this writer could find, and this
 * writer's earlier behaviour (omitting them entirely) round-tripped through
 * this project's own reader but made real PowerPoint's `Presentations.Open`
 * fail on a `MainMaster` swapped in wholesale, confirmed by reverse
 * bisection against that same fixture: every one of the master's OTHER
 * individual pieces (its `Drawing`, `SlideAtom`, `ColorSchemeAtom`s, and
 * instances 0/1 of this very record type) opened fine when spliced in
 * alone, isolating the remaining defect to these six missing instances.
 * Since every from-scratch deck needs the SAME "no explicit master
 * overrides" styling, one fixed byte sequence per instance (matching
 * PowerPoint's own built-in defaults for a brand new deck) covers every
 * caller; a deck with actual master-level style overrides is a distinct,
 * larger feature this writer does not yet support.
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

/** Decode a hex string (no separators) into bytes. */
function hexBytes(hex: string): Uint8Array {
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) {
		out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
}

/** Verbatim data bytes for instances 2/4/5/6/7/8; see module doc. */
const FIXED_INSTANCE_DATA: Record<number, string> = {
	2: '0500fffd3f000000222001006400000000ff000064001e0000000000000040020000000007000000ffffef0000000000ffff0000ffff0c00000000010000000500002001200100000000000500004002400200000000000500006003600300000000000500008004800400000000',
	4: '0500fffd3f000000222001006400000000ff00006400000000000000000040020000000007000000ffffef0000000000ffff0000ffff1200000000010000000500002001200100000000000500004002400200000000000500006003600300000000000500008004800400000000',
	5: '05000000010900000200010000000000000001000109000002000100200100000000020001090000020001004002000000000300010900000200010060030000000004000109000002000100800400000000',
	6: '010000000000000000000000',
	7: '0500000000000000000002001800010000000000000002001400020000000000000002001200030000000000000002001000040000000000000002001000',
	8: '0500000000000000000002001400010000000000000002001200020000000000000002001000030000000000000002000e00040000000000000002000e00',
};

function buildFixedInstanceAtom(recInstance: number): Uint8Array {
	return record(
		RT.TextMasterStyleAtom,
		hexBytes(FIXED_INSTANCE_DATA[recInstance]!),
		recInstance,
		false,
		0,
	);
}

/**
 * Build every TextMasterStyleAtom instance a `MainMaster` needs (0, 1, 2, 4,
 * 5, 6, 7, 8), in that order.
 */
export function buildMasterTextStyles(): Uint8Array {
	const w = new ByteWriter().bytes(buildMasterStyleAtom(0)).bytes(buildMasterStyleAtom(1));
	for (const instance of [2, 4, 5, 6, 7, 8]) {
		w.bytes(buildFixedInstanceAtom(instance));
	}
	return w.toBytes();
}
