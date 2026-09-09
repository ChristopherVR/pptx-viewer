# SmartArt gallery ground-truth corpus

227 `.pptx` fixtures, one SmartArt diagram each, generated via PowerPoint COM
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
all 227 fixtures against the full acceptance gate** (same shape count,
preset, font size, and geometry within 1% of bounding size). Measured via
`bun run scripts/gen-smartart-gallery-baseline.ts` (numbers current as of the
last regeneration): of the 124/227 fixtures where the interpreter at least
gets the matched SHAPE COUNT right, only 7 are within 5% geometry deviation,
9 within 10%, 65 within 50%. 103/227 fail structurally (wrong shape count
before geometry is even compared).

By resolved arrangement family (`discoverArrangement`'s `plan.kind`, out of
227 fixtures): `linear` 87, `text` (aux tx-leaf fallback) 36, `snake` 35,
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
- **Every `text`-bucketed and `UNRECOGNIZED`-bucketed fixture** (43 of 227):
  `discoverArrangement` finds no structural (`lin`/`cycle`/`pyra`/`snake`)
  algorithm and falls back to either a single-point `tx` leaf or the fully
  legacy heuristic - these need the SAME kind of `dgm:choose`/constraint
  investigation already done for `linear`, one family at a time.

`baseline.json`'s per-file numbers are the literal, current, honest answer to
"how close is layout `X` to PowerPoint" - reviewable in a diff, not a claim
this corpus's existence resolves on its own.
