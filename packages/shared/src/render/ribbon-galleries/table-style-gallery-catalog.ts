/**
 * How PowerPoint's Table Styles gallery (Table Design > Table Styles) groups
 * and names its 74 built-in styles.
 *
 * The styles themselves are the built-in catalogue in
 * `render/table-style-builtins.ts` (PowerPoint's own definitions, keyed by
 * GUID); this module only orders them the way the gallery does: "Best Match
 * for Document" (the two No Style entries heading the Themed Style 1/2 rows),
 * then Light, Medium and Dark, each row a neutral style followed by its six
 * accent variants.
 *
 * @module render/ribbon-galleries/table-style-gallery-catalog
 */
import { builtinTableStyleMap } from '../table-style-builtins';

export type TableStyleSectionId = 'bestMatch' | 'light' | 'medium' | 'dark';

export interface TableStyleGalleryEntry {
	/** The `a:tableStyleId` GUID PowerPoint writes. */
	id: string;
	/** PowerPoint's English name (`Table.Style.Name`). */
	name: string;
	/** i18n key under `pptx.gallery.tableStyles.` plus its interpolation values. */
	labelKey: string;
	labelParams?: Record<string, string | number>;
}

export interface TableStyleGallerySection {
	id: TableStyleSectionId;
	title: string;
	entries: TableStyleGalleryEntry[];
}

const NAME_PATTERN =
	/^(Themed|Light|Medium|Dark) Style (\d)(?: - Accent (\d)(?:\/Accent (\d))?)?$/u;

/** The label key + params that spell `name` in every locale. */
export function tableStyleLabel(
	name: string,
): Pick<TableStyleGalleryEntry, 'labelKey' | 'labelParams'> {
	if (name === 'No Style, No Grid') {
		return { labelKey: 'pptx.gallery.tableStyles.noStyleNoGrid' };
	}
	if (name === 'No Style, Table Grid') {
		return { labelKey: 'pptx.gallery.tableStyles.noStyleTableGrid' };
	}
	const match = NAME_PATTERN.exec(name);
	if (!match) {
		return { labelKey: 'pptx.gallery.tableStyles.named', labelParams: { name } };
	}
	const family = match[1].toLowerCase();
	const n = Number(match[2]);
	if (match[4]) {
		return {
			labelKey: `pptx.gallery.tableStyles.${family}AccentPair`,
			labelParams: { n, a: Number(match[3]), b: Number(match[4]) },
		};
	}
	if (match[3]) {
		return {
			labelKey: `pptx.gallery.tableStyles.${family}Accent`,
			labelParams: { n, accent: Number(match[3]) },
		};
	}
	return { labelKey: `pptx.gallery.tableStyles.${family}`, labelParams: { n } };
}

/** Gallery rows by style name: a neutral style (or a No Style entry) then its accents. */
function familyRow(base: string, neutral: string | null): string[] {
	const names = neutral ? [neutral] : [];
	for (let accent = 1; accent <= 6; accent++) {
		names.push(`${base} - Accent ${accent}`);
	}
	return names;
}

const SECTION_ROWS: ReadonlyArray<{ id: TableStyleSectionId; title: string; names: string[] }> = [
	{
		id: 'bestMatch',
		title: 'Best Match for Document',
		names: [
			...familyRow('Themed Style 1', 'No Style, No Grid'),
			...familyRow('Themed Style 2', 'No Style, Table Grid'),
		],
	},
	{
		id: 'light',
		title: 'Light',
		names: [1, 2, 3].flatMap((n) => familyRow(`Light Style ${n}`, `Light Style ${n}`)),
	},
	{
		id: 'medium',
		title: 'Medium',
		names: [1, 2, 3, 4].flatMap((n) => familyRow(`Medium Style ${n}`, `Medium Style ${n}`)),
	},
	{
		id: 'dark',
		title: 'Dark',
		names: [
			...familyRow('Dark Style 1', 'Dark Style 1'),
			'Dark Style 2',
			'Dark Style 2 - Accent 1/Accent 2',
			'Dark Style 2 - Accent 3/Accent 4',
			'Dark Style 2 - Accent 5/Accent 6',
		],
	},
];

let sections: TableStyleGallerySection[] | undefined;

/** The gallery's four sections, 74 styles in PowerPoint's order. */
export function tableStyleGallerySections(): TableStyleGallerySection[] {
	if (sections) {
		return sections;
	}
	const byName = new Map<string, string>();
	for (const [id, entry] of Object.entries(builtinTableStyleMap())) {
		if (entry.styleName) {
			byName.set(entry.styleName, id);
		}
	}
	sections = SECTION_ROWS.map((row) => ({
		id: row.id,
		title: row.title,
		entries: row.names.flatMap((name) => {
			const id = byName.get(name);
			return id ? [{ id, name, ...tableStyleLabel(name) }] : [];
		}),
	}));
	return sections;
}

/** Normalise a GUID to the braced upper-case form the catalogue keys use. */
export function normaliseTableStyleId(id: string | undefined): string | undefined {
	if (!id) {
		return undefined;
	}
	const upper = id.trim().toUpperCase();
	return upper.startsWith('{') ? upper : `{${upper}}`;
}
