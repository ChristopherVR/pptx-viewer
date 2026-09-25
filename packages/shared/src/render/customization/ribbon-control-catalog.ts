/**
 * The stable id of every ribbon GROUP and every CONTROL inside a group, for
 * `ribbon.hiddenGroups` and `ribbon.hiddenButtons`.
 *
 * Ids are `<tab>.<group>` for a group and `<tab>.<group>.<control>` for a
 * control, for example `home.font` and `home.font.bold`. The tab part is a
 * `ToolbarTabId` or a contextual tab id (`shapeFormat`, `pictureFormat`,
 * `tableDesign`, `chartDesign`, `smartArtDesign`). The names follow
 * PowerPoint's own group captions, so a host that knows PowerPoint can guess
 * them.
 *
 * Every binding tags the matching markup with `data-ribbon-group` /
 * `data-ribbon-control` (see `ribbon-control-visibility.ts`), and the shared
 * stylesheet built from a resolved customisation hides what the host named.
 * The union types below are derived from this one object, so an id used in
 * a binding or a host that is not listed here is a compile error.
 *
 * The labels are English documentation strings for the generated reference
 * (`docs/guide/customization.md`), not UI copy.
 *
 * @module render/customization/ribbon-control-catalog
 */

import { RIBBON_CATALOG_CORE_TABS } from './ribbon-control-catalog-core';
import { RIBBON_CATALOG_TAIL_TABS } from './ribbon-control-catalog-tail';

export type { ControlLabels, GroupEntry, TabEntry } from './ribbon-control-catalog-types';

export const RIBBON_CONTROL_CATALOG = {
	...RIBBON_CATALOG_CORE_TABS,
	...RIBBON_CATALOG_TAIL_TABS,
} as const;
