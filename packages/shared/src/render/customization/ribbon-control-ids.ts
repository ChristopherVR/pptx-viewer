/**
 * Ids derived from `RIBBON_CONTROL_CATALOG`: the `RibbonGroupId` /
 * `RibbonControlId` unions and the flattened runtime lists.
 *
 * @module render/customization/ribbon-control-ids
 */
import { RIBBON_CONTROL_CATALOG } from './ribbon-control-catalog';
import type { TabEntry } from './ribbon-control-catalog-types';

type Catalog = typeof RIBBON_CONTROL_CATALOG;

/** A tab that owns ribbon groups (the fixed tabs and the contextual ones). */
export type RibbonCatalogTabId = keyof Catalog;

/** `<tab>.<group>`, for example `home.font`. */
export type RibbonGroupId = {
	[T in keyof Catalog]: {
		[G in keyof Catalog[T]]: `${T & string}.${G & string}`;
	}[keyof Catalog[T]];
}[keyof Catalog];

/** `<tab>.<group>.<control>`, for example `home.font.bold`. */
export type RibbonControlId = {
	[T in keyof Catalog]: {
		[G in keyof Catalog[T]]: Catalog[T][G] extends { controls: infer C }
			? `${T & string}.${G & string}.${keyof C & string}`
			: never;
	}[keyof Catalog[T]];
}[keyof Catalog];

/** One group row of the flattened catalogue. */
export interface RibbonGroupDefinition {
	id: RibbonGroupId;
	tab: RibbonCatalogTabId;
	label: string;
	controls: ReadonlyArray<{ id: RibbonControlId; label: string }>;
}

function flatten(): RibbonGroupDefinition[] {
	const groups: RibbonGroupDefinition[] = [];
	const catalog: Readonly<Record<string, TabEntry>> = RIBBON_CONTROL_CATALOG;
	for (const [tab, tabGroups] of Object.entries(catalog)) {
		for (const [group, entry] of Object.entries(tabGroups)) {
			const id = `${tab}.${group}` as RibbonGroupId;
			groups.push({
				id,
				tab: tab as RibbonCatalogTabId,
				label: entry.label,
				controls: Object.entries(entry.controls).map(([control, label]) => ({
					id: `${id}.${control}` as RibbonControlId,
					label,
				})),
			});
		}
	}
	return groups;
}

/** Every group, in ribbon order, with its controls. */
export const RIBBON_GROUPS: readonly RibbonGroupDefinition[] = flatten();

/** Every group id, in ribbon order. */
export const RIBBON_GROUP_IDS: readonly RibbonGroupId[] = RIBBON_GROUPS.map((g) => g.id);

/** Every control id, in ribbon order. */
export const RIBBON_CONTROL_IDS: readonly RibbonControlId[] = RIBBON_GROUPS.flatMap((g) =>
	g.controls.map((c) => c.id),
);

/** The group a control id belongs to (`home.font.bold` -> `home.font`). */
export function ribbonGroupOfControl(id: RibbonControlId): RibbonGroupId {
	return id.slice(0, id.lastIndexOf('.')) as RibbonGroupId;
}
