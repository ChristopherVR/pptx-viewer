# SmartArt gallery ground-truth corpus

229 `.pptx` fixtures, one SmartArt diagram each, generated via PowerPoint COM
automation (`scripts/make-smartart-gallery.ps1`) covering all 176 built-in
SmartArt layouts this PowerPoint install reports through
`Application.SmartArtLayouts` (the classic 2016-era
List/Process/Cycle/Hierarchy/Relationship/Matrix/Pyramid/Picture galleries,
plus the newer Timeline/Meet-the-Team/Text-Card families some 365 builds
ship). Every fixture carries PowerPoint's own `data`/`layout`/`colors`/
`quickStyle` diagram parts AND a cached `drawing` part: that cached drawing
IS the ground truth `smartart-gallery-ground-truth.test.ts` measures the
DiagramML interpreter (`packages/core/src/core/utils/smartart-layout-
interpreter*.ts`) against, not a hand-authored expectation.

## Naming and data sets

Each file is named `<layout-slug>--<dataset>.pptx`. Every layout gets an
`hier5` data set (5 nodes, 2 levels of hierarchy where the layout supports
it, mixed-length text) - this is the full-gallery coverage pass. A curated
subset of ~30 layouts spanning every algorithm family (list/process/cycle/
hierarchy/relationship/matrix/pyramid/picture/timeline/meet-the-team/
text-card) additionally gets:

- `flat3`: 3 flat (unnested) nodes.
- `hier8`: 8 nodes, 3 levels of hierarchy across three branches.

A handful of layouts reject all three (a fixed or narrow shape count -
matrices, opposing-pair relationships, Venn/target caps): those instead get
one `fallback-nN.pptx` (N flat nodes, N shrinking from 4 down to 1 until
PowerPoint accepts it), so every layout has at least one fixture. See
`manifest.json` for the exact `{file, layoutName, category, dataset}` list,
and `baseline.json` for a point-in-time interpreter-vs-cached-drawing
measurement per fixture (regenerate with `scripts/gen-smartart-gallery-
baseline.ts`; `smartart-gallery-ground-truth.test.ts` does NOT consult it -
that test is a real acceptance gate against the cached drawing directly, not
a regression-only ratchet against this file).

Hierarchy is built with `SmartArtNode.Demote()` (the same operation the
text-pane Tab key / "Add Bullet" performs), not `AddNode()`'s NodeLevel enum,
so it works uniformly across every layout family without per-layout
special-casing.

## Regenerating

```powershell
pwsh -File scripts/make-smartart-gallery.ps1
bun run scripts/gen-smartart-gallery-baseline.ts
```

Requires a local PowerPoint install (COM automation, Windows only) for the
first command; the second only needs `bun`. Re-running the generator is
deterministic given the same PowerPoint version and gallery contents. Pass
`-Only "Basic Process,Basic Venn"` to the generator to regenerate a specific
subset quickly.

## Known gaps (honest state; `smartart-gallery-ground-truth.test.ts` is RED)

The DiagramML interpreter is a genuine, from-first-principles layout engine
(reads `dgm:layoutDef` forEach/choose/constraint XML and computes geometry),
not a per-layout lookup table, so a fix generalizes across every layout that
shares the same DiagramML pattern. Building and running this corpus against
the interpreter found and fixed six real, previously-unknown bugs:

1. `axis="ch"` iteration consumed the entire depth-first-flattened node tree
   instead of just the top-level children, so a node added one level deeper
   (Tab/"Add Bullet" in the text pane) got its own sibling box instead of
   folding into its parent's text as an extra paragraph - see
   `selectArrangedNodes` in `smartart-layout-interpreter-flow.ts`.
2. The above folding itself needed implementing:
   `smartart-interpreter-drawing-bridge.ts`'s `collectFoldedDescendants`/
   `projectFoldedNodeText`.
3. `dgm:if func="var" arg="dir"` treated an ABSENT `presLayoutVars.direction`
   as undecidable instead of defaulting to ECMA-376's "norm": since built-in
   layoutDefs almost universally gate their primary arrangement algorithm
   behind exactly this check and never write an explicit `dgm:dir` for the
   (overwhelmingly common) non-reversed case, this meant the real interpreter
   never engaged at all for the majority of the gallery, silently falling
   back to a much cruder legacy heuristic - see
   `smartart-layout-interpreter-when.ts`'s `VAR_DEFAULT`.
4. `arrangeLinear`'s cross-axis fallback (when an item role declares no
   explicit h/w aspect) shrunk every item to ~62% of its own width instead of
   filling the available cross-axis extent, which is what PowerPoint's own
   cached drawing actually does for e.g. "Basic Process" - see the
   `crossExtent` comment in `smartart-layout-interpreter-linear.ts`.
5. `smartart-constraint-solver.ts`'s role targeting ignored `ptType`: a
   `for="ch"` constraint with no `forName` (the common case for an item's
   own `w`/`h`, vs. its `sibTrans` connector's) collapsed both onto the SAME
   index key and clobbered each other. Fixed by making `ptType` (`node`/
   `sibTrans`/`asst`) a role key in its own right - see `targetRole`'s doc
   comment.
6. That fix then exposed a SEPARATE, subtler bug: an item's own SELF-scoped
   `h`/`w` (declared on the item's OWN `constrLst`, not the arranger's) is
   NOT the outer box's aspect in real PowerPoint output - only an
   ARRANGER-declared `for="ch" forName="<item>"` aspect is. Conflating the
   two regressed "Basic Process" and "Vertical Process" from ~2-4% deviation
   to 70-90% before `resolveConstraintDeclaredBy`
   (`smartart-constraint-declared-by.ts`) restricted `itemAspect` to
   arranger-declared entries only. See that function's doc comment for the
   measured numbers.

**Despite those six fixes, `smartart-gallery-ground-truth.test.ts` fails for
219 of the 229 fixtures against the full acceptance gate** (same shape count,
preset, font size, and geometry within 1% of bounding size). Measured via
`bun run scripts/gen-smartart-gallery-baseline.ts` (numbers current as of the
last regeneration): 225/229 fixtures have matching text-bearing shape counts;
87 are within 1% geometry deviation, 113 within 5%, 122 within 10%, and 181
within 50%; 11 pass the full gate (re-measured 2026-09-24, after the
engine-first routing waves below).
Four fixtures fail structurally before geometry is compared (two pre-existing,
two a side effect of the eighth wave's own fix - see that wave's paragraph).

`computeSmartArtElementsWithoutCache` runs a legacy family-based interpreter
(one arranger chosen for the whole diagram) AND a per-point DiagramML engine
(`smartart-engine/`, executes each layoutDef `layoutNode`'s own
algorithm/constraints per data point), trying the second only when the first
declines. `scripts/measure-smartart-engine-vs-legacy.ts` runs both
independently against every fixture (bypassing that fallback order) to find
`layoutDefinition.uniqueId`s where the engine is strictly more accurate on
EVERY dataset of that layout with no shape-set loss versus legacy;
`smartart-engine/engine-first-allowlist.ts` lists the layouts (74 as of the
eighth wave below) that measurement found (e.g. "Gear": legacy 76% deviation
vs. engine 0.1%, since the legacy composite arranger cannot reach Gear's
rotated/decorative named-slot children at all), and `computeDiagramMlElements`
now tries the engine first only for those.

Two waves moved the numbers above. Introducing the allowlist (55 layouts)
moved geometry-within-1% from 39 to 82, zero fixtures regressing out of that
band (`gen-smartart-gallery-baseline.ts --compare`), though the full gate
stayed at 10/229 since most of the newly-accurate fixtures still fail on
preset or font-size mismatches the geometry fix does not touch. A follow-up
fix in `engine-to-result.ts`'s `hideGeom` handling (ECMA-376 21.4.7.16:
`hideGeom` means no visible border/fill, not "not a node" - the engine
previously dropped every such node outright) recovered item-role-split
shapes it used to drop entirely: `vertical-action-list--hier5` went from 1/5
to 5/5 matched shapes, `descending-block-list--hier5` from 1/5 to 5/5,
moving both onto the allowlist along with three more layouts the wider
re-measurement newly qualified (`opposing-ideas`, `theme-picture-accent`,
`theme-picture-alternating-accent`), for a further 82->87 with, again, zero
regressions and the full gate moving 10->11.
`numbered-title-list`/`numbered-card-list` hit a DIFFERENT, deeper bug the
hideGeom fix does not touch (their layoutDef folds a child node's text into
its parent's presentation node instead of giving the child its own box,
still dropping 3 of 6 shapes) and remain legacy-first: a tracked, open gap,
not a silent workaround.

A third wave gave the engine a `snake` algorithm
(`smartart-engine/alg-snake.ts`, ECMA-376 21.4.2.x: a grid picked from the
node's own aspect ratio or a fixed `bkpt="fixed"` line length, honouring
`flowDir`/`contDir`/`grDir`/`off`, mirroring the legacy `arrangeSnake`'s
grid math). Re-measuring qualified 7 more layouts (67 total on the
allowlist) with zero regressions, though none crossed the 1/5/10/50% bands
on their own since they are still-inaccurate picture/composite families;
Icon Circle Label List did go from 4971% legacy deviation to 64% engine
deviation.

A fourth wave gave the engine a `cycle` algorithm
(`smartart-engine/alg-cycle.ts`, ECMA-376 21.4.2.x: `stAng`/`spanAng` place
children evenly around a ring, solving the ring radius the same "natural
unit space, single isotropic contain-fit" way the legacy
`computeCycleRingLayout` does, plus a `ctrShpMap="fNode"` centred hub and
`rotPath="alongPath"` tangent rotation). Re-measuring the 17-fixture
cycle/radial family qualified no new layouts: the three already on the
allowlist are unaffected, Basic and Multidirectional Cycle now tie legacy
exactly (a tie, not an improvement), Block/Continuous/Nondirectional/Radial
Cycle come out measurably worse under this ring-only model (no
hub-satellite gap ratio or `sibTrans`-bulge handling), and the remaining
hub/composite-item layouts (Text Cycle, Hexagon Radial, Basic/Diverging
Radial, Radial Cluster, Converging Radial, Radial List) still decline
outright. Zero regressions either way
(`gen-smartart-gallery-baseline.ts --compare`), since none of these were
engine-first before or after. `pyra`, `hierRoot` and `hierChild` remain
unimplemented in the per-point engine (`registry.ts` still substitutes
`composite` for them, and `isFullySupported` catches that so the engine
declines cleanly instead of emitting silently-wrong geometry) - each is a
substantial, genuinely different algorithm family (the legacy interpreter's
own `pyramid`/`hierarchy` arrangers together are still several thousand
lines) that would need its own from-scratch per-point port, not attempted
in this pass.

Before attempting `pyra`, a fifth pass fixed a unit-conversion bug blocking it:
real `basic-pyramid--*`/`inverted-pyramid--*` declare their `level` (and
`acctBkgd`/`acctTx`) composite child with a bare `ctrX`/`w` (and `ctrY`/`h`)
literal PAIR (`val="1"` on both) - the engine's general "bare literal is a
millimetre length" rule collapsed that to a ~2.83pt box (measured: engine
3.212 vs. legacy 0.0019 deviation on `basic-pyramid--flat3`). No single
absolute-length reading of `val="1"` can produce "fill the box" (`ctrX = w`
places it from `w/2` to `3w/2` under any uniform conversion), so, COM-verified,
this specific paired idiom is now read as a fraction of the declaring node's
own resolved size instead (`smartart-engine/constraint-fill-idiom.ts`). An
earlier, broader attempt (every bare `w`/`h`/`ctrX`/`ctrY` literal) regressed
Gear (0.0882 -> declined), Segmented Cycle (0.0012 -> 0.3959), Varying Width
List (0.654 -> 0.7982) and Vertical Chevron List (0.3996 -> declined), because
those layouts use the SAME-looking `val="1"` for a genuinely tiny, real
anchor-point marker (Gear's `hideGeom="1"` connector endpoints), not this
idiom; scanning the whole 229-fixture corpus for the exact `ctrX`+`w`/`ctrY`+`h`
bare-literal pairing finds it ONLY in the two pyramid layouts, so the narrowed
fix reproduces the prior measurement byte-for-byte on all 229 fixtures (still
87/229 geometry within 1%, 11/229 full gate; zero regressions,
`gen-smartart-gallery-baseline.ts --compare`) since `pyra` is not yet in the
engine's `SUPPORTED_ALGS` and so still declines the pyramid layouts outright -
the fix has no measurable effect until `pyra` itself is implemented.

A sixth pass then implemented `pyra` itself (`smartart-engine/alg-pyra.ts`,
ECMA-376 21.4.2.x: equal-height horizontal bands, width proportional to
position in the stack, `linDir="fromT"` for the apex-down "Inverted
Pyramid"), porting the band-stacking geometry from legacy's
`arrangePyramid`. A second unit bug then surfaced: real "Basic Pyramid" also
declares its "level" band's OWN self-scoped `h val="500"`/`w val="1"`, and
`preferred-size.ts`'s `preferredSize` (by design, to preserve a genuine
self-declared aspect ratio) re-applies a composite child's own self-scoped
size constraints on top of whatever its parent already assigned - overriding
the fifth wave's fix and re-collapsing "level" (measured: engine deviation
1.6079, still declining on every dataset). No generic rule can distinguish
"level"'s declaration from `radial-cycle`/`segmented-cycle`/
`vertical-chevron-list`'s own `dummyConnPt`/`wedge*` nodes, which declare the
SAME bare self `w val="1"`/`h val="1"` shape and MUST keep it as a real
~2.83pt marker (their own position also comes from a sibling `for="ch"`
declaration, exactly like "level"'s), so `alg-pyra.ts` sanitizes only the
specific named node its own `pyraLvlNode` param points at ("level" by
default), dropping its bare-literal self `w`/`h` before the rest of the tree
lays out - scoped to the `pyra` algorithm's own per-item subtree, unable to
reach `dummyConnPt`/`wedge*` in other algorithms' layoutDefs. With both
fixes, Basic and Inverted Pyramid's `flat3` (no accented rows) datasets now
match legacy EXACTLY (0.0019, tied); `hier5`/`hier8` (accented rows) still
measure 0.5663, since `pyraAcctRatio`/`pyraAcctPos` accent-column splitting
(legacy's `repositionPyramidBands`) is a genuinely separate, per-item-role,
post-composite pass not ported in this wave - tracked and documented, not a
silent regression. The strict allowlist rule requires improvement (or a tie)
on EVERY dataset with no shape-set loss, and `hier5`/`hier8` are measurably
worse than legacy, so neither layout newly qualifies for
`engine-first-allowlist.ts` this wave. Re-measuring the full corpus confirms
the change touches ONLY these two layouts, zero regressions, gate numbers
unchanged (still 87/229 within 1%, 11/229 full gate; `pyra` is not yet
allowlisted, so production behaviour for these two layouts is unchanged).

A seventh pass closed that `pyraAcctRatio` gap: `alg-pyra.ts` gained a
POST-pass (`applyPyraAccentSplit`, run by `layout-driver.ts`'s new
`LayoutRegistry.resolvePost` hook after a `pyra` node's own children have
finished laying out) porting legacy's COM-verified `repositionPyramidBands`.
Once `pyraAcctRatio` resolves positive, every row's "level" band shrinks to
`(1 - pyraAcctRatio)` of its natural width anchored at the diagram box's own
left edge, and a row whose data point has a child gets an "acctBkgd"/"acctTx"
column filling the remainder out to the diagram's right edge. The first
attempt filled that remainder from "level"'s own shrunk (WIDE-edge) right
corner and measured 0.1142 on `hier5`/`hier8` (down from 0.5663, still worse
than legacy's 0.0019); diffing per-shape geometry against the cached ground
truth showed the accent column's true left edge is the row's scaled NARROW
(top) trapezoid corner, not the wide one `arrangePyra`'s own tight bounding
box collapsed to, so the post-pass recomputes that corner independently
(mirroring legacy's own `pyramidRowGeometry`). With that correction,
`hier5`/`hier8` tie legacy exactly (0.0019, matching `flat3`), so Basic and
Inverted Pyramid both now qualify for `engine-first-allowlist.ts` under the
tie-or-better rule and route engine-first in production. Re-measuring the
full 229-fixture corpus confirms zero regressions elsewhere and the gate
numbers hold at 87/229 within 1%, 11/229 full gate (both layouts already
matched within 1% via legacy before this wave, so the routing change alone
does not move those counts).

An eighth wave fixed the `numbered-title-list`/`numbered-card-list`
shape-drop bug named in the second wave above: their "1"/"2"/"3" ordinal
badges rendered blank because the badge text is presented off the SIBLING
transition point (`dgm:presOf axis="self" ptType="sibTrans"`), and
`data-points.ts`'s `buildDataModel` only ever copied a connection's resolved
`label` onto its `parTrans` `DataPoint`, never the paired `sibTrans` one;
`engine-to-result.ts` also only ever read a presented point's content-node
`.text`, never a transition point's own `.label`. Both fixed:
`sibTrans` now carries `label` like `parTrans` already did, and
`buildRenderedNode` falls back to a presented point's `.label`
(`RenderedNodeIdentity.literalText`) when no content point is presented. Both
layouts now match all 6 cached shapes (previously 3 of 6) and measurably beat
legacy (Numbered Title List 0.5854 -> 0.3415, Numbered Card List 0.4465 ->
0.2458), qualifying for the allowlist. Since this is a general engine fix
(not scoped to numbered lists), re-measuring the whole corpus per the
allowlist's own "regenerate after any engine change" rule found three more,
unrelated qualifiers from the same fix: Converging Arrows and Diverging
Arrows (0.0638 -> 0.0375, an opposing-arrow pair's own middle sibTrans label)
and Tabbed Arc (0.2364 -> 0.0131) - all three match every cached shape with
no extras, unlike the two numbered-list layouts (see below). 74 layouts on
the allowlist total. The two numbered-list fixtures are the source of this
wave's four (up from two) structural misses: each accented item's `bgRect`
background shape independently presents the same "self" point its actual
text overlay (`nodeText`, `hideGeom`, `desOrSelf`) also presents, so on an
UNaccented row both render identical text and collide harmlessly under exact-
text dedup, but on an accented row `bgRect`'s unfolded self-only text and
`nodeText`'s folded self+descendant text differ and both survive as separate,
unmatched shapes. Root-causing when a background sibling's own `presOf`
should be suppressed in favour of a `hideGeom` overlay's (matching real
PowerPoint's single-text-per-item rendering) is a genuinely separate, deeper
question than the shape-loss bug fixed here - the layoutDef's own
`moveWith="bgRect"` on `nodeText` (already parsed into `LdLayoutNode.moveWith`
but never threaded through `PresNode`/`EngineNode`) is the likely ECMA-376
signal such a fix would key off - tracked here as an open gap, not attempted
in this wave. Re-measuring with `gen-smartart-gallery-baseline.ts --compare`
confirms geometry-within-1% and the full gate hold exactly (still 87/229,
11/229), structural drops 227->225 (the two phantom-shape fixtures above),
and within-5%/10%/50% each improve slightly (110->113, 121->122, 180->181)
from the arrow/Tabbed-Arc wins.

By resolved arrangement family (`discoverArrangement`'s `plan.kind`, out of
229 fixtures): `linear` 87, `text` (aux tx-leaf fallback) 36, `snake` 35,
`cycle` 25, `hierarchy` 19, `composite` 14, `UNRECOGNIZED` (falls through to
the legacy heuristic entirely) 7, `pyramid` 4.

Concrete, measured, NOT-yet-fixed blockers (exact fixtures + construct):

- **`composite` named-slot resolution is fundamentally too shallow for
  rotated/decorative shapes.** `gear--flat3.pptx` and `gear--hier5.pptx`:
  PowerPoint's cached drawing has 6 distinct shapes (`gear9`, `gear6` x2,
  `roundRect` x2, plus 2 `circularArrow`/`leftCircularArrow` decorative
  connectors), but `arrangeComposite` never engages at all here (returns
  `undefined`, or the composite's slot-mapping children are not reachable as
  direct `.children` of the discovered arranger node) - the interpreter falls
  through to the legacy heuristic, which renders ONE roundRect covering the
  entire frame. `readSlots` (`smartart-layout-interpreter-composite-slots.ts`)
  and `mapsSlots` (`smartart-layout-interpreter-model.ts`) need to handle
  slot children nested inside a `dgm:choose`/`dgm:forEach` wrapper, which the
  typed model may or may not already flatten into `.children` - not
  confirmed in the time available.
- **`repeating-bending-process--hier5.pptx`** (`composite`): 53-55% deviation,
  a genuinely bent/repeating connector path (`dgm:alg type="conn"` with
  multiple `bendPt`s) that the current `conn` arranger does not model.
- **`table-hierarchy`/`architecture-layout` (`hierarchy` family, `linear`
  presentation over a table grid):** 51-97% deviation across `hier5`/`flat3`/
  `hier8` - these use a `hierChild`-adjacent grid/table layout the hierarchy
  arranger's row/column math does not yet reproduce.
- **`trapezoid-list--hier5.pptx`** (`linear`): regressed from 19.3% to 54.2%
  deviation as a SIDE EFFECT of fix #6 above (this specific layout's item
  aspect WAS genuinely arranger-declared, but the resolved absolute value
  disagrees with PowerPoint's own once `itemAspect` stopped falling back to
  the item's own, coincidentally-closer, self-scoped value). Not re-chased
  further in the time available; flagged here rather than silently
  regressed-and-hidden.
- **Every `text`-bucketed and `UNRECOGNIZED`-bucketed fixture** (43 of 229):
  `discoverArrangement` finds no structural (`lin`/`cycle`/`pyra`/`snake`)
  algorithm and falls back to either a single-point `tx` leaf or the fully
  legacy heuristic - these need the SAME kind of `dgm:choose`/constraint
  investigation already done for `linear`, one family at a time.

`baseline.json`'s per-file numbers are the literal, current, honest answer to
"how close is layout `X` to PowerPoint" - reviewable in a diff, not a claim
this corpus's existence resolves on its own.
