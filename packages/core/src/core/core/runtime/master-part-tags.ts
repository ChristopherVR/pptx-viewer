/**
 * @fileoverview Root tags and element-id prefixes for the four "template"
 * parts whose shape trees the Slide Master view renders and edits.
 *
 * Kept in its own module so the save-side writer can name the tag union
 * without importing the load-side parser, which sits further down the mixin
 * chain.
 */

/** Root tags of the parts whose shape tree the Slide Master view can edit. */
export type MasterPartRootTag = 'p:notesMaster' | 'p:handoutMaster' | 'p:sldMaster' | 'p:sldLayout';

const MASTER_PART_ID_PREFIX: Record<MasterPartRootTag, string> = {
	'p:notesMaster': 'notes-master-',
	'p:handoutMaster': 'handout-master-',
	'p:sldMaster': 'slide-master-',
	'p:sldLayout': 'slide-layout-',
};

/**
 * Build the element-id prefix for one part.
 *
 * A deck has at most one notes and one handout master, so those keep a bare
 * prefix. Slide masters and layouts repeat, and the master view paints a
 * layout on top of its own master in a single pseudo-slide, so their ids also
 * carry the part token (`slide-layout-slideLayout3-`) or the two trees would
 * collide.
 *
 * The prefixes deliberately do NOT start with `master-` / `layout-`: those are
 * reserved for the copies merged into a slide, which every binding gates
 * behind `editTemplateMode` via `isTemplateElementId`.
 */
export function masterPartIdPrefix(rootTag: MasterPartRootTag, partPath: string): string {
	const base = MASTER_PART_ID_PREFIX[rootTag];
	if (rootTag === 'p:notesMaster' || rootTag === 'p:handoutMaster') {
		return base;
	}
	const token =
		partPath
			.split('/')
			.pop()
			?.replace(/\.xml$/u, '') ?? partPath;
	return `${base}${token}-`;
}
