/**
 * Spec-exact ECMA-376 / ISO-IEC-29500-1 preset geometry for `gear6`
 * (ISO/IEC 29500-1 section 20.1.10.55).
 *
 * Transcribed verbatim from Microsoft's authoritative
 * `presetShapeDefinitions.xml`, sourced from the Apache POI mirror
 * `poi/src/main/resources/org/apache/poi/sl/draw/geom/presetShapeDefinitions.xml`
 * (fetched 2026-09-05). This replaces the earlier hand-rolled `buildGearN`
 * trapezoid-tooth approximation in `preset-shape-definitions-tabs-decorations.ts`,
 * which computed tooth/valley vertices from a precomputed trig table and never
 * consumed `adj2` (COM-verified 2026-09-05: `Shape.Adjustments.Count` is 2, not
 * 1). The spec-exact path below routes every tooth root through an `arcTo`
 * whose radius is `(rw, rh)` (the shape's bounding ellipse shrunk by the tooth
 * depth `th`, itself derived from `adj1`); the fillet PowerPoint renders
 * between adjacent teeth is exactly this root-circle arc, and its span
 * (`swAng1`/`swAng2`) narrows as `adj2` (`lFD`, the flank offset) grows, which
 * is how real PowerPoint's `adj2` fillet radius reaches the silhouette: a
 * larger `adj2` widens the flat root land (`xE`/`xF` points) and shortens the
 * fillet arc's sweep, visually rounding the tooth-to-root transition.
 *
 * No deviations from the canonical token stream: every operator here
 * (`pin`, mul-div, `+-`, `+/`, `?:`, `at2`, `cos`, `sin`, `mod`) is evaluated
 * exactly as ISO/IEC 29500-1 section 20.1.9.11 specifies by
 * `guide-formula-eval.ts`; `at2`'s ECMA operand order (`at2 x y = atan2(y, x)`)
 * matches `preset-shape-definitions-curved-arrows-exact.ts`'s documented
 * convention. The guide name `a1`/`a2` is intentionally reused mid-list (once
 * as the pinned `adj1`/`adj2` value, later as an arm's polar angle): guides
 * evaluate in array order into a single mutable map, so the later definition
 * shadows the earlier one for every formula after it, matching
 * `evaluateGuides` in `guide-formula-api.ts`.
 *
 * `preset-shape-definitions-table.ts` imports `gear6` from here (and `gear9`
 * from the sibling `preset-shape-definitions-gear9.ts`) instead of the old
 * `buildGearN` export in `preset-shape-definitions-tabs-decorations.ts`.
 */

import type { PresetShapeGeometryDefinition } from './preset-shape-definitions-table';

function gd(name: string, formula: string): { name: string; formula: string; args: string[] } {
	const parts = formula.trim().split(/\s+/);
	return { name, formula, args: parts.slice(1) };
}

export const gear6: PresetShapeGeometryDefinition = {
	name: 'gear6',
	avLst: { adj1: 15000, adj2: 3526 },
	gdLst: [
		gd('a1', 'pin 0 adj1 20000'),
		gd('a2', 'pin 0 adj2 5358'),
		gd('th', '*/ ss a1 100000'),
		gd('lFD', '*/ ss a2 100000'),
		gd('th2', '*/ th 1 2'),
		gd('l2', '*/ lFD 1 2'),
		gd('l3', '+- th2 l2 0'),
		gd('rh', '+- hd2 0 th'),
		gd('rw', '+- wd2 0 th'),
		gd('dr', '+- rw 0 rh'),
		gd('maxr', '?: dr rh rw'),
		gd('ha', 'at2 maxr l3'),
		gd('aA1', '+- 19800000 0 ha'),
		gd('aD1', '+- 19800000 ha 0'),
		gd('ta11', 'cos rw aA1'),
		gd('ta12', 'sin rh aA1'),
		gd('bA1', 'at2 ta11 ta12'),
		gd('cta1', 'cos rh bA1'),
		gd('sta1', 'sin rw bA1'),
		gd('ma1', 'mod cta1 sta1 0'),
		gd('na1', '*/ rw rh ma1'),
		gd('dxa1', 'cos na1 bA1'),
		gd('dya1', 'sin na1 bA1'),
		gd('xA1', '+- hc dxa1 0'),
		gd('yA1', '+- vc dya1 0'),
		gd('td11', 'cos rw aD1'),
		gd('td12', 'sin rh aD1'),
		gd('bD1', 'at2 td11 td12'),
		gd('ctd1', 'cos rh bD1'),
		gd('std1', 'sin rw bD1'),
		gd('md1', 'mod ctd1 std1 0'),
		gd('nd1', '*/ rw rh md1'),
		gd('dxd1', 'cos nd1 bD1'),
		gd('dyd1', 'sin nd1 bD1'),
		gd('xD1', '+- hc dxd1 0'),
		gd('yD1', '+- vc dyd1 0'),
		gd('xAD1', '+- xA1 0 xD1'),
		gd('yAD1', '+- yA1 0 yD1'),
		gd('lAD1', 'mod xAD1 yAD1 0'),
		gd('a1', 'at2 yAD1 xAD1'),
		gd('dxF1', 'sin lFD a1'),
		gd('dyF1', 'cos lFD a1'),
		gd('xF1', '+- xD1 dxF1 0'),
		gd('yF1', '+- yD1 dyF1 0'),
		gd('xE1', '+- xA1 0 dxF1'),
		gd('yE1', '+- yA1 0 dyF1'),
		gd('yC1t', 'sin th a1'),
		gd('xC1t', 'cos th a1'),
		gd('yC1', '+- yF1 yC1t 0'),
		gd('xC1', '+- xF1 0 xC1t'),
		gd('yB1', '+- yE1 yC1t 0'),
		gd('xB1', '+- xE1 0 xC1t'),
		gd('aD6', '+- 3cd4 ha 0'),
		gd('td61', 'cos rw aD6'),
		gd('td62', 'sin rh aD6'),
		gd('bD6', 'at2 td61 td62'),
		gd('ctd6', 'cos rh bD6'),
		gd('std6', 'sin rw bD6'),
		gd('md6', 'mod ctd6 std6 0'),
		gd('nd6', '*/ rw rh md6'),
		gd('dxd6', 'cos nd6 bD6'),
		gd('dyd6', 'sin nd6 bD6'),
		gd('xD6', '+- hc dxd6 0'),
		gd('yD6', '+- vc dyd6 0'),
		gd('xA6', '+- hc 0 dxd6'),
		gd('xF6', '+- xD6 0 lFD'),
		gd('xE6', '+- xA6 lFD 0'),
		gd('yC6', '+- yD6 0 th'),
		gd('swAng1', '+- bA1 0 bD6'),
		gd('aA2', '+- 1800000 0 ha'),
		gd('aD2', '+- 1800000 ha 0'),
		gd('ta21', 'cos rw aA2'),
		gd('ta22', 'sin rh aA2'),
		gd('bA2', 'at2 ta21 ta22'),
		gd('yA2', '+- h 0 yD1'),
		gd('td21', 'cos rw aD2'),
		gd('td22', 'sin rh aD2'),
		gd('bD2', 'at2 td21 td22'),
		gd('yD2', '+- h 0 yA1'),
		gd('yC2', '+- h 0 yB1'),
		gd('yB2', '+- h 0 yC1'),
		gd('xB2', 'val xC1'),
		gd('swAng2', '+- bA2 0 bD1'),
		gd('aD3', '+- cd4 ha 0'),
		gd('td31', 'cos rw aD3'),
		gd('td32', 'sin rh aD3'),
		gd('bD3', 'at2 td31 td32'),
		gd('yD3', '+- h 0 yD6'),
		gd('yB3', '+- h 0 yC6'),
		gd('aD4', '+- 9000000 ha 0'),
		gd('td41', 'cos rw aD4'),
		gd('td42', 'sin rh aD4'),
		gd('bD4', 'at2 td41 td42'),
		gd('xD4', '+- w 0 xD1'),
		gd('xC4', '+- w 0 xC1'),
		gd('xB4', '+- w 0 xB1'),
		gd('aD5', '+- 12600000 ha 0'),
		gd('td51', 'cos rw aD5'),
		gd('td52', 'sin rh aD5'),
		gd('bD5', 'at2 td51 td52'),
		gd('xD5', '+- w 0 xA1'),
		gd('xC5', '+- w 0 xB1'),
		gd('xB5', '+- w 0 xC1'),
		gd('xCxn1', '+/ xB1 xC1 2'),
		gd('yCxn1', '+/ yB1 yC1 2'),
		gd('yCxn2', '+- b 0 yCxn1'),
		gd('xCxn4', '+/ r 0 xCxn1'),
	],
	rect: { l: 'xD5', t: 'yA1', r: 'xA1', b: 'yD2' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'xA1', y: 'yA1' },
				{ kind: 'lnTo', x: 'xB1', y: 'yB1' },
				{ kind: 'lnTo', x: 'xC1', y: 'yC1' },
				{ kind: 'lnTo', x: 'xD1', y: 'yD1' },
				{ kind: 'arcTo', wR: 'rw', hR: 'rh', stAng: 'bD1', swAng: 'swAng2' },
				{ kind: 'lnTo', x: 'xC1', y: 'yB2' },
				{ kind: 'lnTo', x: 'xB1', y: 'yC2' },
				{ kind: 'lnTo', x: 'xA1', y: 'yD2' },
				{ kind: 'arcTo', wR: 'rw', hR: 'rh', stAng: 'bD2', swAng: 'swAng1' },
				{ kind: 'lnTo', x: 'xF6', y: 'yB3' },
				{ kind: 'lnTo', x: 'xE6', y: 'yB3' },
				{ kind: 'lnTo', x: 'xA6', y: 'yD3' },
				{ kind: 'arcTo', wR: 'rw', hR: 'rh', stAng: 'bD3', swAng: 'swAng1' },
				{ kind: 'lnTo', x: 'xB4', y: 'yC2' },
				{ kind: 'lnTo', x: 'xC4', y: 'yB2' },
				{ kind: 'lnTo', x: 'xD4', y: 'yA2' },
				{ kind: 'arcTo', wR: 'rw', hR: 'rh', stAng: 'bD4', swAng: 'swAng2' },
				{ kind: 'lnTo', x: 'xB5', y: 'yC1' },
				{ kind: 'lnTo', x: 'xC5', y: 'yB1' },
				{ kind: 'lnTo', x: 'xD5', y: 'yA1' },
				{ kind: 'arcTo', wR: 'rw', hR: 'rh', stAng: 'bD5', swAng: 'swAng1' },
				{ kind: 'lnTo', x: 'xE6', y: 'yC6' },
				{ kind: 'lnTo', x: 'xF6', y: 'yC6' },
				{ kind: 'lnTo', x: 'xD6', y: 'yD6' },
				{ kind: 'arcTo', wR: 'rw', hR: 'rh', stAng: 'bD6', swAng: 'swAng1' },
				{ kind: 'close' },
			],
		},
	],
};
