/**
 * Sequential MSOSPID (shape id) allocator for one drawing.
 *
 * Every `OfficeArtFSP` (see `shape-writer.ts` / `group-writer.ts`) needs a
 * unique, non-zero shape id, and its range must fall inside the drawing's
 * own budget from `bstore-writer.ts#buildDgg`'s `OfficeArtIDCL` cluster.
 * Real (COM-written) files give drawing `drawingId` the patriarch id
 * `drawingId * clusterSize` exactly (drawing 1 -> 1024, drawing 2 -> 2048,
 * ...), confirmed by reverse bisection against a COM-authored fixture: this
 * writer's earlier `(drawingId - 1) * clusterSize + 1` (drawing 1 -> 1, not
 * 1024) round-tripped through this project's own reader, which does not
 * validate the convention, but real PowerPoint's `Presentations.Open`
 * rejected it with a bare COM HRESULT and no Office File Validation message,
 * so no earlier COM re-verification pass had caught it either. Shape id 0
 * stays reserved/invalid, same as before: `drawingId` is always >= 1, so
 * `drawingId * clusterSize` is always >= `clusterSize` and never 0.
 *
 * @module ppt/writer/shape-id-allocator
 */

export class ShapeIdAllocator {
	private current: number;

	public constructor(drawingId: number, clusterSize: number) {
		// Pre-increment in `next()`, so the first id issued is
		// `drawingId * clusterSize` (the patriarch).
		this.current = drawingId * clusterSize - 1;
	}

	/** Allocate and return the next shape id (the patriarch gets the first one). */
	public next(): number {
		this.current += 1;
		return this.current;
	}

	/**
	 * The most recently issued id (the drawing's high-water mark so far).
	 * Used to fill in the `Dg` record's own "last shape id" field once every
	 * shape in the drawing has been allocated, so that field can never drift
	 * out of sync with what `next()` actually issued (background shapes and
	 * nested group children each consume an id too, which a separately
	 * recomputed shape count can silently miss).
	 */
	public get lastIssued(): number {
		return this.current;
	}
}
