/**
 * Sequential MSOSPID (shape id) allocator for one drawing.
 *
 * Every `OfficeArtFSP` (see `shape-writer.ts` / `group-writer.ts`) needs a
 * unique, non-zero shape id, and its range must fall inside the drawing's
 * own budget from `bstore-writer.ts#buildDgg`'s `OfficeArtIDCL` cluster
 * (`(drawingId - 1) * SHAPE_ID_CLUSTER_SIZE` .. `drawingId *
 * SHAPE_ID_CLUSTER_SIZE`). Writing `spid = 0` for every shape (this writer's
 * earlier behaviour) failed real PowerPoint's Office File Validation
 * outright, confirmed fixed by COM re-verification.
 *
 * @module ppt/writer/shape-id-allocator
 */

export class ShapeIdAllocator {
	private current: number;

	public constructor(drawingId: number, clusterSize: number) {
		// Pre-increment in `next()`, so the first id issued is
		// `(drawingId - 1) * clusterSize + 1`: shape id 0 is reserved/invalid
		// (confirmed by real PowerPoint's Office File Validation hard-rejecting
		// a file whose drawing-id-1 patriarch had spid 0, the previous
		// off-by-one here), so every drawing's range must start at 1, not 0.
		this.current = (drawingId - 1) * clusterSize;
	}

	/** Allocate and return the next shape id (the patriarch gets the first one). */
	public next(): number {
		this.current += 1;
		return this.current;
	}
}
