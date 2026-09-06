/**
 * The allowlist of preset names whose geometry text rectangle
 * (`evaluatePresetShape(...).textRect`) is COM-verified against real
 * PowerPoint, consumed by `text-body-rect.ts`.
 *
 * Split out of that module to keep it under the repo's 300-LOC file-size
 * convention; see `resolveTextBodyRectPadding` there for how this set gates
 * rendering.
 *
 * @module render/verified-text-rect-presets
 */

/**
 * Preset names whose `rect` in core's geometry table is VERIFIED against
 * PowerPoint, lower-cased.
 *
 * Nothing had ever read `PresetShapeGeometryDefinition.rect`, so nothing had
 * ever checked it. Measuring PowerPoint directly (a deck of one shape per
 * preset, opened through COM, with `TextFrame.TextRange.Bound*` read off
 * single-glyph and wrapped-text probes at zero body insets on a 200x100pt box)
 * originally put 65 of 194 preset rects within 0.02 of PowerPoint and found
 * **117 that disagree**, several catastrophically: `pentagon` evaluated to a
 * NEGATIVE bottom edge, `heart` and `moon` collapsed to zero (both referenced
 * a `3wd4`/`3hd4` guide that does not exist: the built-in `wd`/`hd` family is
 * division-only, `wd2..wd12`/`hd2..hd12`, with no multiples), `flowChartDecision`
 * and `diamond` returned a quarter-size box (mirroring bug: `r`/`b` reused the
 * CENTER guide instead of the far-edge mirror of `l`/`t`), and the whole
 * ellipse and rounded-rect families reported the full bounding box where
 * PowerPoint insets by 0.1464 and 0.0244 respectively. A follow-up pass
 * (2026-09, gap G1) re-derived and re-measured `ellipse`, `roundRect`,
 * `diamond`, `pentagon`, `heart`, `moon`, `plus`, the whole `round*Rect`/
 * `snip*Rect` family, `flowChartDecision`, `triangle`, `rtTriangle`, `hexagon`
 * and the `math*` symbols (all now on this list). `mathMultiply`,
 * `parallelogram` and `trapezoid` resisted re-derivation from path guides;
 * wave 2 transcribed the spec's own `<a:rect>` formulas for every preset
 * (core `preset-text-rect-*.ts`, consulted ahead of the old table), and those
 * three match their COM measurements within ~0.1px, so they are listed too.
 * A wave-2 follow-up then COM-measured every remaining ECMA-transcribed
 * preset in that table (all 93 entries total): all but one (`sun`, see below)
 * matched within tolerance and are listed here, so the table now has no
 * unverified entries left.
 *
 * So the rectangle is honoured only for the presets on this list. That is not
 * timidity: consuming an unverified preset would move text on common shapes to
 * measurably WRONG places, which is worse than the (also wrong) full box they
 * use otherwise. The remaining entries belong to whoever owns
 * `packages/core/src/core/geometry`; as each is corrected against the same
 * measurement it can simply be added here.
 *
 * Lower-cased raw preset names, deliberately NOT `getShapeType`: that
 * normaliser folds whole families together (`can` -> `cylinder`,
 * `oval` -> `ellipse`), and this is a per-PRESET fact, keyed the way core's own
 * `lookupPresetShape` keys it.
 *
 * `pie`'s entry in `preset-text-rect-table.ts` is a corrected reading of a
 * genuinely broken ECMA source (the spec's own `<rect>` has `t`/`r` swapped,
 * see that file's comment), fixed BY ANALOGY to `noSmoking`/`smileyFace`/
 * `teardrop` (the same idx/idy/il/ir/it/ib guide set); this wave's COM
 * measurement confirms the corrected reading matches PowerPoint exactly, so
 * `pie` is listed below with the rest.
 *
 * `sun` IS now listed (2026-09-06). At the time this comment was first written
 * it deliberately kept a pre-existing hand-derived `rect`
 * (`preset-shape-definitions-misc.ts`, `discL`/`discT`/`discR`/`discB`, the
 * central disc's own extents), and a COM measurement showed that rect was
 * wrong: at 200x100pt and the default `adj`, PowerPoint measures
 * l=64.65,t=32.32,r=135.27,b=67.68, while the disc rect evaluated to
 * l=50,t=25,r=150,b=75 (7.3% off, well outside the 0.02 tolerance every other
 * entry here meets), and the closest re-derivation tried then (the diagonal
 * ray's inner band edge) still missed by ~1.5% on every edge. A later
 * geometry fix (`preset-shape-definitions-misc.ts`, commit `1da163776`)
 * replaced the rect with the disc's OWN inscribed axis-aligned rectangle
 * (touching the disc ellipse at 45deg, the same construction `ellipse`'s own
 * text rect uses against its full bounding ellipse): `trl`/`trt`/`trr`/`trb`,
 * built from `cos`/`sin` guides against the disc radius. Re-measured via COM
 * (PowerPoint 2016) against that same target (l=64.65,t=32.32,r=135.27,
 * b=67.68 at 200x100pt) and a second aspect ratio (l=51.72,t=38.79,
 * r=108.22,b=81.21 at 160x120pt), the new formula matches both within 0.1%,
 * so `sun` now belongs on this list too (see
 * `preset-text-rect.test.ts`'s `sun` case for the regression guard). This
 * closes the module's last remaining gap: every preset this project carries a
 * geometry-table `rect` for is now COM-verified.
 */
export const VERIFIED_TEXT_RECT_PRESETS: ReadonlySet<string> = new Set([
	// Straight and bent arrows.
	'rightarrow',
	'leftarrow',
	'uparrow',
	'downarrow',
	'updownarrow',
	'bentarrow',
	'bentuparrow',
	'uturnarrow',
	'stripedrightarrow',
	'notchedrightarrow',
	'swoosharrow',
	'curvedrightarrow',
	'curvedleftarrow',
	'curveduparrow',
	'curveddownarrow',
	'chevron',
	// Basic shapes with a real inset.
	'rect',
	'octagon',
	'arc',
	'bevel',
	'can',
	'cube',
	'frame',
	'corner',
	'funnel',
	// Flowchart symbols.
	'flowchartprocess',
	'flowchartpredefinedprocess',
	'flowchartinternalstorage',
	'flowchartdocument',
	'flowchartterminator',
	'flowchartpreparation',
	'flowchartmanualinput',
	'flowchartmanualoperation',
	'flowchartoffpageconnector',
	'flowchartpunchedcard',
	'flowchartextract',
	'flowchartmerge',
	'flowchartonlinestorage',
	'flowchartdisplay',
	'flowchartinputoutput',
	'flowchartofflinestorage',
	// Callouts.
	'wedgerectcallout',
	'cloudcallout',
	'quadarrowcallout',
	'callout1',
	'callout2',
	'callout3',
	'bordercallout1',
	'bordercallout2',
	'bordercallout3',
	'accentcallout1',
	'accentcallout2',
	'accentcallout3',
	'accentbordercallout1',
	'accentbordercallout2',
	'accentbordercallout3',
	// Connectors (all full-box, listed so the set matches the measurement).
	'straightconnector1',
	'bentconnector2',
	'bentconnector3',
	'bentconnector4',
	'bentconnector5',
	'curvedconnector2',
	'curvedconnector3',
	'curvedconnector4',
	'curvedconnector5',
	// G1 follow-up (2026-09): re-derived and COM-re-measured.
	'ellipse',
	'roundrect',
	'diamond',
	'pentagon',
	'heart',
	'moon',
	'plus',
	'triangle',
	'rttriangle',
	'hexagon',
	'flowchartdecision',
	'mathplus',
	'mathminus',
	'mathdivide',
	'mathequal',
	'mathnotequal',
	'round1rect',
	'round2samerect',
	'round2diagrect',
	'sniproundrect',
	'snip1rect',
	'snip2samerect',
	'snip2diagrect',
	// Wave 2: the ECMA-376 `<a:rect>` formulas (core `preset-text-rect-*.ts`,
	// consulted ahead of the old table) reproduce the earlier COM measurements
	// of these three within ~0.1px; the earlier "no formula matches" reading
	// came from re-deriving the rect from path guides instead of the spec's own
	// dedicated `<a:rect>`.
	'mathmultiply',
	'parallelogram',
	'trapezoid',
	// Wave 2 follow-up: every remaining ECMA `<a:rect>` transcription in
	// preset-text-rect-table.ts, COM-verified at 200x100pt (a handful also
	// re-measured at a non-default `adj` via COM's writable
	// `Shape.Adjustments`: leftRightArrow, homePlate, gear6, bracePair,
	// star4). All matched within the usual 0.02 relative tolerance.
	'actionbuttonbackprevious',
	'actionbuttonbeginning',
	'actionbuttonblank',
	'actionbuttondocument',
	'actionbuttonend',
	'actionbuttonforwardnext',
	'actionbuttonhelp',
	'actionbuttonhome',
	'actionbuttoninformation',
	'actionbuttonmovie',
	'actionbuttonreturn',
	'actionbuttonsound',
	'halfframe',
	'leftrightarrow',
	'quadarrow',
	'leftrightuparrow',
	'leftuparrow',
	'homeplate',
	'bracepair',
	'bracketpair',
	'leftbrace',
	'leftbracket',
	'rightbrace',
	'rightbracket',
	'leftarrowcallout',
	'rightarrowcallout',
	'uparrowcallout',
	'downarrowcallout',
	'leftrightarrowcallout',
	'updownarrowcallout',
	'wedgeellipsecallout',
	'wedgeroundrectcallout',
	'circulararrow',
	'leftcirculararrow',
	'leftrightcirculararrow',
	'flowchartalternateprocess',
	'flowchartcollate',
	'flowchartconnector',
	'flowchartdelay',
	'flowchartmagneticdisk',
	'flowchartmagneticdrum',
	'flowchartmagnetictape',
	'flowchartmultidocument',
	'flowchartor',
	'flowchartpunchedtape',
	'flowchartsort',
	'flowchartsummingjunction',
	'blockarc',
	'chord',
	'cloud',
	'diagstripe',
	'donut',
	'doublewave',
	'gear6',
	'gear9',
	'horizontalscroll',
	'irregularseal1',
	'irregularseal2',
	'lightningbolt',
	'nosmoking',
	'pie',
	'piewedge',
	'smileyface',
	'teardrop',
	'verticalscroll',
	'wave',
	'heptagon',
	'decagon',
	'dodecagon',
	'nonisoscelestrapezoid',
	'ellipseribbon',
	'ellipseribbon2',
	'leftrightribbon',
	'ribbon',
	'ribbon2',
	'star4',
	'star5',
	'star6',
	'star7',
	'star8',
	'star10',
	'star12',
	'star16',
	'star24',
	'star32',
	'cornertabs',
	'plaquetabs',
	'squaretabs',
	'plaque',
	'foldedcorner',
	// COM-verified 2026-09-06, after `preset-shape-definitions-misc.ts` fixed
	// the disc's own inscribed rect. See the module doc comment above.
	'sun',
]);
