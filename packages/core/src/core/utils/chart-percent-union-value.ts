/**
 * Serialization for the DrawingML chart attributes whose type is a "percent
 * union" simple type: `ST_LblOffset`, `ST_GapAmount`, `ST_Overlap`,
 * `ST_BubbleScale`, `ST_HoleSize`, `ST_SecondPieSize` and friends
 * (ECMA-376 Part 1, 21.2.3).
 *
 * Every one of those is declared as
 * `<xsd:union memberTypes="ST_<Name>Percent ST_<Name>UShort"/>`, so a literal
 * such as `100%` is genuinely schema-valid; the schema even declares `100%` as
 * the default for `CT_LblOffset/@val`. **PowerPoint does not implement the
 * percent member.** Measured through PowerPoint COM (Application 16.0) against
 * otherwise-pristine decks, rewriting a single attribute to its percent form
 * makes the whole file unreadable:
 *
 * - `c:lblOffset val="100%"`  -> 0x80070570 "The file or directory is
 *   corrupted and unreadable"
 * - `c:gapWidth val="219%"`   -> same
 * - `c:overlap val="-27%"`    -> same
 *
 * Restoring the numeric member (and changing nothing else) opens cleanly with
 * every chart intact, and real PowerPoint output only ever writes the numeric
 * member. The empirical result is what governs here, not the schema union: we
 * always emit the unsigned-short / short member.
 */
export interface ChartPercentUnionRange {
	/** Property name used in the thrown {@link RangeError}. */
	name: string;
	/** Inclusive lower bound of the numeric member. */
	min: number;
	/** Inclusive upper bound of the numeric member. */
	max: number;
}

/**
 * Format a modelled percentage as the numeric member of its union type.
 *
 * @param value - Percentage as a plain number (`100` means 100%).
 * @param range - Bounds and property name from the owning attribute's type.
 * @returns The attribute text, e.g. `'100'` - never `'100%'`.
 * @throws RangeError when the value is not finite or falls outside the bounds.
 *
 * @example
 * ```ts
 * chartPercentUnionValue(100, { name: 'labelOffset', min: 0, max: 1000 });
 * // => "100"
 * ```
 */
export function chartPercentUnionValue(value: number, range: ChartPercentUnionRange): string {
	if (!Number.isFinite(value) || value < range.min || value > range.max) {
		throw new RangeError(`${range.name} must be between ${range.min} and ${range.max}`);
	}
	// The numeric members are integral (xsd:unsignedShort / xsd:short), so a
	// modelled fraction has to be rounded rather than emitted verbatim.
	return String(Math.round(value));
}
