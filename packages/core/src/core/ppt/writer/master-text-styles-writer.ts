/**
 * TextMasterStyleAtom writer for a `MainMaster`'s per-text-type defaults,
 * the inverse of `text/master-styles.ts`.
 *
 * Instances 0 (title), 1 (body) and 4 (other) carry the deck's own master
 * text styles (`p:titleStyle`/`p:bodyStyle`/`p:otherStyle`, converted by
 * `master-style-convert.ts`) as five levels of partial TextPFException +
 * TextCFException pairs: only the properties the deck sets are written, and
 * PowerPoint fills the rest from its built-in defaults, as it already did
 * for the empty (`masks = 0`) exceptions a deck without styles still gets.
 * Five levels matter beyond the styles themselves: PowerPoint clamps a
 * shape paragraph's indent level to the levels its master style declares,
 * so a one-level body style (this writer's earlier output) flattened every
 * nested bullet to level 1 (COM-measured: `TextRange.IndentLevel` read 1 for
 * a level-2 paragraph).
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
 * caller that has no "other" style of its own.
 *
 * @module ppt/writer/master-text-styles-writer
 */

import { RT } from '../record-types';
import { ByteWriter, record } from './byte-writer';
import type { FontIndexer } from './text-exception-writer';
import { writeCfException, writePfException } from './text-exception-writer';
import type { WMasterLevel, WMasterTextStyles } from './write-model';

/** Levels written for a category the deck does not style: one empty level. */
const EMPTY_LEVELS: WMasterLevel[] = [{ paragraph: {}, run: {} }];

/**
 * Build one TextMasterStyleAtom (instances 0-4: no per-level level prefix)
 * from `levels`, one TextPFException + TextCFException pair each.
 */
export function buildMasterStyleAtom(
	recInstance: number,
	levels: WMasterLevel[],
	fontIndex: FontIndexer,
): Uint8Array {
	const w = new ByteWriter().u16(levels.length);
	for (const level of levels) {
		writePfException(w, level.paragraph);
		writeCfException(w, level.run, fontIndex);
	}
	return record(RT.TextMasterStyleAtom, w.toBytes(), recInstance, false, 0);
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
export function buildMasterTextStyles(
	styles: WMasterTextStyles | undefined,
	fontIndex: FontIndexer,
): Uint8Array {
	const w = new ByteWriter()
		.bytes(buildMasterStyleAtom(0, styles?.title ?? EMPTY_LEVELS, fontIndex))
		.bytes(buildMasterStyleAtom(1, styles?.body ?? EMPTY_LEVELS, fontIndex));
	for (const instance of [2, 4, 5, 6, 7, 8]) {
		w.bytes(
			instance === 4 && styles?.other
				? buildMasterStyleAtom(4, styles.other, fontIndex)
				: buildFixedInstanceAtom(instance),
		);
	}
	return w.toBytes();
}
