/**
 * table-tblpr-save.ts - write-back for `a:tblPr`'s OWN fill / `effectLst`
 * (`CT_TableProperties` `EG_FillProperties` + `effectLst`), independent of
 * `a:tblStyleLst` / `a:tblBg`.
 *
 * `PptxTableDataParser` reads these into `PptxTableData.tableFill` /
 * `.tableEffects` (see `table-style-fill-parse.ts` / `table-style-effect-
 * parse.ts`), but nothing wrote them back: `serializeTablePropertyFlags`
 * only handles the boolean/id attributes, so any edit to `tableFill` /
 * `tableEffects` on the in-memory model was silently dropped on save (a
 * fully untouched table round-tripped only because its original `a:tblPr`
 * XML happened to survive unmodified).
 *
 * Reuses `writeFillChoiceInto` (`table-style-fill-write.ts`) because
 * `a:tblPr`'s fill choice sits directly on `a:tblPr`, the same unwrapped
 * shape a table-style section's fill has once its `a:tcStyle/a:fill`
 * wrapper is peeled off (see `parseFillChoiceNode`'s docblock).
 *
 * @module table-tblpr-save
 */
import type { PptxTableData, XmlObject } from '../../types';
import { writeTableEffectChain } from './table-style-effect-parse';
import { writeFillChoiceInto } from './table-style-fill-write';

/** The `EG_FillProperties` choice keys that can sit directly on `a:tblPr`. */
const FILL_CHOICE_KEYS = [
	'a:noFill',
	'a:solidFill',
	'a:gradFill',
	'a:blipFill',
	'a:pattFill',
] as const;

/**
 * Write `PptxTableData.tableFill` / `.tableEffects` back onto an `a:tblPr`
 * XML node, mirroring what `PptxTableDataParser` reads.
 *
 * Both fields are preserve-on-absent, matching every other optional field
 * in this save path (e.g. `@_rtl` in `serializeTablePropertyFlags`): when
 * the caller's `tableData` doesn't carry `tableFill` / `tableEffects` at
 * all, whatever `a:tblPr` already had is left untouched. This lets a save
 * call that only touched cell text (and so never populated these fields)
 * coexist with one that explicitly edited them.
 *
 * An `image` (`a:blipFill`) fill is a write-side no-op, same limitation as
 * `writeTableStyleSectionFill`: synthesising a new relationship without
 * access to the archive's rels/parts is out of scope here.
 *
 * An `effectDag`-shaped `tableEffects` entry (the opaque `a:effectDag`
 * pass-through captured by `parseTableEffectChain`) is also left as a
 * write-side no-op: the DAG's nested `a:effect` containers were never
 * decomposed on parse, so there's nothing typed to rebuild from.
 */
export function writeTablePropertiesOwnFillAndEffects(
	tblPr: XmlObject,
	tableData: Pick<PptxTableData, 'tableFill' | 'tableEffects'>,
): void {
	if (tableData.tableFill && !tableData.tableFill.image) {
		for (const key of FILL_CHOICE_KEYS) {
			delete tblPr[key];
		}
		writeFillChoiceInto(tblPr, tableData.tableFill);
	}

	if (tableData.tableEffects && tableData.tableEffects.length > 0) {
		const hasOpaqueDag = tableData.tableEffects.some((effect) => effect.kind === 'effectDag');
		if (!hasOpaqueDag) {
			delete tblPr['a:effectDag'];
			tblPr['a:effectLst'] = writeTableEffectChain(tableData.tableEffects);
		}
	}
}
