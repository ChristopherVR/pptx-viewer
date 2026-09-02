/**
 * Slide Master view CRUD: Insert/Duplicate/Delete/Rename Layout and
 * Insert/Duplicate/Delete/Rename Slide Master.
 *
 * `core` can already create layouts ({@link createLayout} in
 * layout-operations.ts) and duplicates masters as a side effect of saving a
 * converted `.ppt` deck, but nothing here deleted, duplicated or renamed a
 * layout or master, and `sldLayoutIdLst` / `sldMasterIdLst` were never
 * pruned. This module closes that gap with pure ZIP surgery: every function
 * saves the handler to get a fully-serialised, guaranteed-valid package
 * (the same strategy {@link createLayout} already uses), mutates it, then
 * reloads through a fresh `PptxHandler` so every derived field
 * (`layoutXmlMap`, `data.slideMasters[*].layouts`, `data.layoutOptions`, ...)
 * is recomputed from the result rather than hand-patched.
 *
 * Layouts and masters are identified by their archive path (e.g.
 * `ppt/slideLayouts/slideLayout3.xml`), matching the convention
 * `render/master-view.ts` already uses for the same parts. Rename delegates
 * to the existing typed-model save path (`applySlideMasterChanges` /
 * `applySlideLayoutChanges`); insert/duplicate/delete perform direct ZIP
 * surgery because that save path only patches parts already present, it
 * never adds or removes them.
 *
 * Split across sibling files purely for the 300-LOC file-size limit:
 * - `master-layout-crud-layout.ts`: layout CRUD.
 * - `master-layout-crud-master.ts`: slide-master CRUD.
 * - `master-layout-crud-names.ts`: pure PowerPoint-style naming helpers.
 * - `master-layout-crud-xml.ts`: ZIP/XML primitives shared by both.
 * - `master-layout-crud-lookup.ts`: shared `PptxData` lookups.
 *
 * @module sdk/master-layout-crud
 */
export {
	duplicateLayout,
	deleteLayout,
	renameLayout,
	insertLayout,
} from './master-layout-crud-layout';
export type { DuplicateLayoutSuccess, DuplicateLayoutResult } from './master-layout-crud-layout';

export {
	duplicateSlideMaster,
	deleteSlideMaster,
	renameSlideMaster,
	insertSlideMaster,
} from './master-layout-crud-master';
export type { DuplicateMasterSuccess, DuplicateMasterResult } from './master-layout-crud-master';

export {
	collectLayoutNames,
	collectMasterNames,
	uniqueDisplayName,
	uniquePrefixedName,
} from './master-layout-crud-names';

export type {
	MasterLayoutCrudFailure,
	MasterLayoutCrudResult,
	MasterLayoutCrudSuccess,
} from './master-layout-crud-xml';
