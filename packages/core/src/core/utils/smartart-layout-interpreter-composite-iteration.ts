/**
 * SmartArt DiagramML interpreter - per-`forEach`-iteration slot geometry.
 *
 * Split out of `smartart-layout-interpreter-composite-choose.ts` (the
 * repo's per-file line budget): {@link resolveIterationRect} slices ONE
 * shared container rect for a candidate born from a multi-anchor
 * `forEachOrigin` split (see that module's `collectRawCandidates` - a
 * genuine "one item template, N `dgm:forEach` iterations" instance,
 * `nested-target--hier5.pptx`'s `oChild`).
 *
 * Pure geometry; no framework code.
 */

import type { Slot, SlotDims } from './smartart-layout-interpreter-composite-slots';
import { resolveSlot } from './smartart-layout-interpreter-composite-slots';
import type { BoundingBox } from './smartart-layout-types';

/**
 * One `readSlots`-resolved `dims`, resolved to a rect and - for a candidate
 * from a multi-anchor `forEachOrigin` split (`iterationCount > 1`) - SLICED
 * for `iteration`-of-`iterationCount`. Every iteration of the SAME
 * layoutNode shares the identical `dims` (one physical template,
 * instantiated N times, positioned only as a group by whatever arranges its
 * CONTAINER - `nested-target--hier5.pptx`'s `oChild` has no `l`/`t`/`ctrX`/
 * `ctrY` of its own at all, only a `w`/`h` reference to its wrapper), so the
 * unsliced rect is the shared area every iteration must tile: divided
 * evenly along whichever axis is longer (a `dgm:alg type="lin"` container
 * arranges its items along its own longer axis in every fixture measured).
 * Resolving the container's OWN, often choose-wrapped, `linDir` param
 * precisely instead of inferring direction from aspect ratio is a separate,
 * deeper gap: the container's own positioning constraint chain
 * (`smartart-constraint-solver.ts`/`smartart-constraint-declared-by.ts`) is
 * not itself `chooseGuard`-aware yet, so a choose-wrapped container
 * constraint (`nested-target`'s `outerBoxChildren`, whose own `l`/`t`/`w`/`h`
 * are declared inside a `dir`-conditioned `dgm:choose` on its parent) can
 * resolve to the WRONG branch's numbers - measured on `nested-target`
 * itself: its container rect resolves to the diagram's full bounding box
 * rather than the ~0.95x0.45 sub-rect the live branch declares, so this
 * slicing still lands well outside the gate's 1% geometry tolerance for
 * that fixture even though the shape COUNT and per-shape TEXT are now
 * correct. Not fixed here (Track L/R's `smartart-constraint-solver.ts`
 * ownership, and a materially bigger fix than this module's own scope);
 * this is the best a `composite*.ts`-scoped fix can do until that lands.
 * `iterationCount <= 1` is the pre-existing single-instance behaviour,
 * byte-for-byte unchanged.
 */
export function resolveIterationRect(
	dims: SlotDims,
	box: BoundingBox,
	iteration: number,
	iterationCount: number,
): Slot {
	const container = resolveSlot(dims, box, 1, 1);
	if (iterationCount <= 1) {
		return container;
	}
	if (container.width >= container.height) {
		const width = container.width / iterationCount;
		return { x: container.x + width * iteration, y: container.y, width, height: container.height };
	}
	const height = container.height / iterationCount;
	return { x: container.x, y: container.y + height * iteration, width: container.width, height };
}
