/**
 * Spec-exact ECMA-376 / ISO-IEC-29500-1 preset geometry for `gear9`
 * (ISO/IEC 29500-1 section 20.1.10.55).
 *
 * Sibling of `preset-shape-definitions-gear6.ts`; see that file's header for
 * the `adj2` fillet explanation, the guide-name-reuse note, and the
 * transcription source. `gear9`'s gdLst is longer because the spec author
 * hand-unrolled all 9 teeth rather than looping: arms 1-4 (and 9) derive their
 * tip/root points from full ellipse-intersection trig (`cos`/`sin`/`at2`/`mod`),
 * while arms 5-8 mirror an earlier arm's points across the shape's vertical
 * centre (`+- w 0 x..`) since `gear9` is symmetric about that axis. This is
 * transcribed as-is (not generalised into a loop) so it stays line-for-line
 * auditable against the source XML.
 *
 * The 242-entry gdLst is authored as a `name|formula` table (one XML `<a:gd>`
 * per line) rather than 242 individual `gd(...)` calls: oxfmt reflows an
 * array literal to one element per line regardless of source packing, which
 * would push this file over the repo's 300-LOC-per-file budget. A template
 * string is not reformatted, so the table stays exactly as auditable against
 * the source XML while keeping the file short.
 */

import type { PresetShapeGeometryDefinition } from './preset-shape-definitions-table';

function gd(name: string, formula: string): { name: string; formula: string; args: string[] } {
	const parts = formula.trim().split(/\s+/);
	return { name, formula, args: parts.slice(1) };
}

/**
 * Parse a `;`-separated `name|formula` table into gdLst entries. Several
 * `<a:gd>` elements are packed per physical line (see `GEAR9_GD_TABLE`); each
 * `;`-separated segment is still exactly one guide.
 */
function parseGdTable(table: string): Array<{ name: string; formula: string; args: string[] }> {
	return table
		.trim()
		.split(/[\n;]/)
		.filter((entry) => entry.length > 0)
		.map((entry) => {
			const sep = entry.indexOf('|');
			return gd(entry.slice(0, sep), entry.slice(sep + 1));
		});
}

const GEAR9_GD_TABLE = `
a1|pin 0 adj1 20000;a2|pin 0 adj2 2679;th|*/ ss a1 100000;lFD|*/ ss a2 100000
th2|*/ th 1 2;l2|*/ lFD 1 2;l3|+- th2 l2 0;rh|+- hd2 0 th
rw|+- wd2 0 th;dr|+- rw 0 rh;maxr|?: dr rh rw;ha|at2 maxr l3
aA1|+- 18600000 0 ha;aD1|+- 18600000 ha 0;ta11|cos rw aA1;ta12|sin rh aA1
bA1|at2 ta11 ta12;cta1|cos rh bA1;sta1|sin rw bA1;ma1|mod cta1 sta1 0
na1|*/ rw rh ma1;dxa1|cos na1 bA1;dya1|sin na1 bA1;xA1|+- hc dxa1 0
yA1|+- vc dya1 0;td11|cos rw aD1;td12|sin rh aD1;bD1|at2 td11 td12
ctd1|cos rh bD1;std1|sin rw bD1;md1|mod ctd1 std1 0;nd1|*/ rw rh md1
dxd1|cos nd1 bD1;dyd1|sin nd1 bD1;xD1|+- hc dxd1 0;yD1|+- vc dyd1 0
xAD1|+- xA1 0 xD1;yAD1|+- yA1 0 yD1;lAD1|mod xAD1 yAD1 0;a1|at2 yAD1 xAD1
dxF1|sin lFD a1;dyF1|cos lFD a1;xF1|+- xD1 dxF1 0;yF1|+- yD1 dyF1 0
xE1|+- xA1 0 dxF1;yE1|+- yA1 0 dyF1;yC1t|sin th a1;xC1t|cos th a1
yC1|+- yF1 yC1t 0;xC1|+- xF1 0 xC1t;yB1|+- yE1 yC1t 0;xB1|+- xE1 0 xC1t
aA2|+- 21000000 0 ha;aD2|+- 21000000 ha 0;ta21|cos rw aA2;ta22|sin rh aA2
bA2|at2 ta21 ta22;cta2|cos rh bA2;sta2|sin rw bA2;ma2|mod cta2 sta2 0
na2|*/ rw rh ma2;dxa2|cos na2 bA2;dya2|sin na2 bA2;xA2|+- hc dxa2 0
yA2|+- vc dya2 0;td21|cos rw aD2;td22|sin rh aD2;bD2|at2 td21 td22
ctd2|cos rh bD2;std2|sin rw bD2;md2|mod ctd2 std2 0;nd2|*/ rw rh md2
dxd2|cos nd2 bD2;dyd2|sin nd2 bD2;xD2|+- hc dxd2 0;yD2|+- vc dyd2 0
xAD2|+- xA2 0 xD2;yAD2|+- yA2 0 yD2;lAD2|mod xAD2 yAD2 0;a2|at2 yAD2 xAD2
dxF2|sin lFD a2;dyF2|cos lFD a2;xF2|+- xD2 dxF2 0;yF2|+- yD2 dyF2 0
xE2|+- xA2 0 dxF2;yE2|+- yA2 0 dyF2;yC2t|sin th a2;xC2t|cos th a2
yC2|+- yF2 yC2t 0;xC2|+- xF2 0 xC2t;yB2|+- yE2 yC2t 0;xB2|+- xE2 0 xC2t
swAng1|+- bA2 0 bD1;aA3|+- 1800000 0 ha;aD3|+- 1800000 ha 0;ta31|cos rw aA3
ta32|sin rh aA3;bA3|at2 ta31 ta32;cta3|cos rh bA3;sta3|sin rw bA3
ma3|mod cta3 sta3 0;na3|*/ rw rh ma3;dxa3|cos na3 bA3;dya3|sin na3 bA3
xA3|+- hc dxa3 0;yA3|+- vc dya3 0;td31|cos rw aD3;td32|sin rh aD3
bD3|at2 td31 td32;ctd3|cos rh bD3;std3|sin rw bD3;md3|mod ctd3 std3 0
nd3|*/ rw rh md3;dxd3|cos nd3 bD3;dyd3|sin nd3 bD3;xD3|+- hc dxd3 0
yD3|+- vc dyd3 0;xAD3|+- xA3 0 xD3;yAD3|+- yA3 0 yD3;lAD3|mod xAD3 yAD3 0
a3|at2 yAD3 xAD3;dxF3|sin lFD a3;dyF3|cos lFD a3;xF3|+- xD3 dxF3 0
yF3|+- yD3 dyF3 0;xE3|+- xA3 0 dxF3;yE3|+- yA3 0 dyF3;yC3t|sin th a3
xC3t|cos th a3;yC3|+- yF3 yC3t 0;xC3|+- xF3 0 xC3t;yB3|+- yE3 yC3t 0
xB3|+- xE3 0 xC3t;swAng2|+- bA3 0 bD2;aA4|+- 4200000 0 ha;aD4|+- 4200000 ha 0
ta41|cos rw aA4;ta42|sin rh aA4;bA4|at2 ta41 ta42;cta4|cos rh bA4
sta4|sin rw bA4;ma4|mod cta4 sta4 0;na4|*/ rw rh ma4;dxa4|cos na4 bA4
dya4|sin na4 bA4;xA4|+- hc dxa4 0;yA4|+- vc dya4 0;td41|cos rw aD4
td42|sin rh aD4;bD4|at2 td41 td42;ctd4|cos rh bD4;std4|sin rw bD4
md4|mod ctd4 std4 0;nd4|*/ rw rh md4;dxd4|cos nd4 bD4;dyd4|sin nd4 bD4
xD4|+- hc dxd4 0;yD4|+- vc dyd4 0;xAD4|+- xA4 0 xD4;yAD4|+- yA4 0 yD4
lAD4|mod xAD4 yAD4 0;a4|at2 yAD4 xAD4;dxF4|sin lFD a4;dyF4|cos lFD a4
xF4|+- xD4 dxF4 0;yF4|+- yD4 dyF4 0;xE4|+- xA4 0 dxF4;yE4|+- yA4 0 dyF4
yC4t|sin th a4;xC4t|cos th a4;yC4|+- yF4 yC4t 0;xC4|+- xF4 0 xC4t
yB4|+- yE4 yC4t 0;xB4|+- xE4 0 xC4t;swAng3|+- bA4 0 bD3;aA5|+- 6600000 0 ha
aD5|+- 6600000 ha 0;ta51|cos rw aA5;ta52|sin rh aA5;bA5|at2 ta51 ta52
td51|cos rw aD5;td52|sin rh aD5;bD5|at2 td51 td52;xD5|+- w 0 xA4
xC5|+- w 0 xB4;xB5|+- w 0 xC4;swAng4|+- bA5 0 bD4;aD6|+- 9000000 ha 0
td61|cos rw aD6;td62|sin rh aD6;bD6|at2 td61 td62;xD6|+- w 0 xA3
xC6|+- w 0 xB3;xB6|+- w 0 xC3;aD7|+- 11400000 ha 0;td71|cos rw aD7
td72|sin rh aD7;bD7|at2 td71 td72;xD7|+- w 0 xA2;xC7|+- w 0 xB2
xB7|+- w 0 xC2;aD8|+- 13800000 ha 0;td81|cos rw aD8;td82|sin rh aD8
bD8|at2 td81 td82;xA8|+- w 0 xD1;xD8|+- w 0 xA1;xC8|+- w 0 xB1
xB8|+- w 0 xC1;aA9|+- 3cd4 0 ha;aD9|+- 3cd4 ha 0;td91|cos rw aD9
td92|sin rh aD9;bD9|at2 td91 td92;ctd9|cos rh bD9;std9|sin rw bD9
md9|mod ctd9 std9 0;nd9|*/ rw rh md9;dxd9|cos nd9 bD9;dyd9|sin nd9 bD9
xD9|+- hc dxd9 0;yD9|+- vc dyd9 0;ta91|cos rw aA9;ta92|sin rh aA9
bA9|at2 ta91 ta92;xA9|+- hc 0 dxd9;xF9|+- xD9 0 lFD;xE9|+- xA9 lFD 0
yC9|+- yD9 0 th;swAng5|+- bA9 0 bD8;xCxn1|+/ xB1 xC1 2;yCxn1|+/ yB1 yC1 2
xCxn2|+/ xB2 xC2 2;yCxn2|+/ yB2 yC2 2;xCxn3|+/ xB3 xC3 2;yCxn3|+/ yB3 yC3 2
xCxn4|+/ xB4 xC4 2;yCxn4|+/ yB4 yC4 2;xCxn5|+/ r 0 xCxn4;xCxn6|+/ r 0 xCxn3
xCxn7|+/ r 0 xCxn2;xCxn8|+/ r 0 xCxn1
`;

export const gear9: PresetShapeGeometryDefinition = {
	name: 'gear9',
	avLst: { adj1: 10000, adj2: 1763 },
	gdLst: parseGdTable(GEAR9_GD_TABLE),
	rect: { l: 'xA8', t: 'yD1', r: 'xD1', b: 'yD3' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'xA1', y: 'yA1' },
				{ kind: 'lnTo', x: 'xB1', y: 'yB1' },
				{ kind: 'lnTo', x: 'xC1', y: 'yC1' },
				{ kind: 'lnTo', x: 'xD1', y: 'yD1' },
				{ kind: 'arcTo', wR: 'rw', hR: 'rh', stAng: 'bD1', swAng: 'swAng1' },
				{ kind: 'lnTo', x: 'xB2', y: 'yB2' },
				{ kind: 'lnTo', x: 'xC2', y: 'yC2' },
				{ kind: 'lnTo', x: 'xD2', y: 'yD2' },
				{ kind: 'arcTo', wR: 'rw', hR: 'rh', stAng: 'bD2', swAng: 'swAng2' },
				{ kind: 'lnTo', x: 'xB3', y: 'yB3' },
				{ kind: 'lnTo', x: 'xC3', y: 'yC3' },
				{ kind: 'lnTo', x: 'xD3', y: 'yD3' },
				{ kind: 'arcTo', wR: 'rw', hR: 'rh', stAng: 'bD3', swAng: 'swAng3' },
				{ kind: 'lnTo', x: 'xB4', y: 'yB4' },
				{ kind: 'lnTo', x: 'xC4', y: 'yC4' },
				{ kind: 'lnTo', x: 'xD4', y: 'yD4' },
				{ kind: 'arcTo', wR: 'rw', hR: 'rh', stAng: 'bD4', swAng: 'swAng4' },
				{ kind: 'lnTo', x: 'xB5', y: 'yC4' },
				{ kind: 'lnTo', x: 'xC5', y: 'yB4' },
				{ kind: 'lnTo', x: 'xD5', y: 'yA4' },
				{ kind: 'arcTo', wR: 'rw', hR: 'rh', stAng: 'bD5', swAng: 'swAng3' },
				{ kind: 'lnTo', x: 'xB6', y: 'yC3' },
				{ kind: 'lnTo', x: 'xC6', y: 'yB3' },
				{ kind: 'lnTo', x: 'xD6', y: 'yA3' },
				{ kind: 'arcTo', wR: 'rw', hR: 'rh', stAng: 'bD6', swAng: 'swAng2' },
				{ kind: 'lnTo', x: 'xB7', y: 'yC2' },
				{ kind: 'lnTo', x: 'xC7', y: 'yB2' },
				{ kind: 'lnTo', x: 'xD7', y: 'yA2' },
				{ kind: 'arcTo', wR: 'rw', hR: 'rh', stAng: 'bD7', swAng: 'swAng1' },
				{ kind: 'lnTo', x: 'xB8', y: 'yC1' },
				{ kind: 'lnTo', x: 'xC8', y: 'yB1' },
				{ kind: 'lnTo', x: 'xD8', y: 'yA1' },
				{ kind: 'arcTo', wR: 'rw', hR: 'rh', stAng: 'bD8', swAng: 'swAng5' },
				{ kind: 'lnTo', x: 'xE9', y: 'yC9' },
				{ kind: 'lnTo', x: 'xF9', y: 'yC9' },
				{ kind: 'lnTo', x: 'xD9', y: 'yD9' },
				{ kind: 'arcTo', wR: 'rw', hR: 'rh', stAng: 'bD9', swAng: 'swAng5' },
				{ kind: 'close' },
			],
		},
	],
};
