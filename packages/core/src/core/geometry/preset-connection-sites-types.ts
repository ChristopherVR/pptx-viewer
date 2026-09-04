/**
 * Shared vocabulary for the preset connection-site tables
 * (`preset-connection-sites-*.ts`).
 *
 * ECMA-376's `presetShapeDefinitions.xml` gives most non-rectangular presets an
 * explicit `<cxnLst>` of `<cxn ang="..."><pos x="..." y="..."/></cxn>` entries,
 * distinct from the shape's own `pathLst`/`rect` geometry (which this repo
 * already transcribes in `preset-shape-definitions-*.ts`). No preset in that
 * table carries a `cxnLst`, so `a:cxn/@idx` on ANY preset always fell back to
 * the four bounding-box edge midpoints, wrong for anything but a plain
 * rectangle. These tables close that gap without touching the existing
 * `pathLst` tables: each entry lists only the `avLst`/`gdLst` a shape's OWN
 * `cxnLst` formulas need (frequently a strict subset of what `pathLst` needs,
 * since a connection site is usually a vertex the path already visits), plus
 * the `cxn` tokens themselves, verbatim from the spec.
 *
 * @module render/preset-connection-sites-types
 */

/** One `<a:cxn>` entry: an approach angle plus a formula-token position. */
export interface PresetConnectionSiteToken {
	/** `@_ang`, a builtin angle guide (`0`, `cd4`, `cd2`, `3cd4`) or literal. */
	ang: string;
	/** `a:pos/@_x` formula token (guide name or numeric literal). */
	x: string;
	/** `a:pos/@_y` formula token. */
	y: string;
}

/**
 * The `avLst`/`gdLst`/`cxnLst` slice of one preset's `presetShapeDefinition`,
 * transcribed only as far as evaluating its `cxnLst` requires.
 */
export interface PresetConnectionSiteDefinition {
	/** `avLst` defaults (`adj`, `adj1`, `hf`, `vf`, ...), overridable at call time. */
	avLst?: Record<string, number>;
	/** `gdLst` guides the `cxnLst` position formulas reference, in order. */
	gdLst?: Array<{ name: string; formula: string }>;
	/** The preset's connection sites, in `@idx` order. */
	sites: PresetConnectionSiteToken[];
}

/** Build a `gdLst` entry from a `<a:gd name="..." fmla="..."/>` pair. */
export function gd(name: string, formula: string): { name: string; formula: string } {
	return { name, formula };
}

/** Build a `<a:cxn ang="..."><a:pos x="..." y="..."/></a:cxn>` token. */
export function cxn(ang: string, x: string, y: string): PresetConnectionSiteToken {
	return { ang, x, y };
}

/** The plain 4-cardinal `cxnLst` shared by every box-like preset. */
export const CARDINAL_SITES: PresetConnectionSiteToken[] = [
	cxn('3cd4', 'hc', 't'),
	cxn('cd2', 'l', 'vc'),
	cxn('cd4', 'hc', 'b'),
	cxn('0', 'r', 'vc'),
];
