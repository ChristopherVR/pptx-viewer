/**
 * SmartArt DiagramML interpreter - `dgm:presOf`/`dgm:forEach` 1-based
 * position-range resolution.
 *
 * Shared by `smartart-layout-interpreter-composite-children.ts` (a bare
 * composite wrapper slot's per-child item templates, e.g. `Table List`'s
 * `pillar1`/`pillarX`) and `smartart-layout-interpreter-item-role-compound.ts`
 * (a compound `presOf axis="ch desOrSelf"` role, e.g. `Tab List`'s
 * `FirstChild`/`Child`): both need the exact same `start`/`count`/`step`
 * position math over a `total`-length list. Pure TypeScript - no framework
 * code.
 */

/**
 * 1-based positions into a `total`-length list an iterator's `start`/`count`/
 * `step` resolves to. `count` of `undefined`/`0` means "every remaining
 * position" (DiagramML default).
 */
export function positionRange(
	start: number,
	count: number | undefined,
	step: number,
	total: number,
): number[] {
	const out: number[] = [];
	const s = step > 0 ? step : 1;
	for (let i = Math.max(0, start - 1); i < total; i += s) {
		out.push(i + 1);
		if (count !== undefined && count > 0 && out.length >= count) {
			break;
		}
	}
	return out;
}
