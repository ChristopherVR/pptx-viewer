import type { PptxLayoutPreview, PptxThemeColorRef } from 'pptx-viewer-core';

import type { RibbonControlId, RibbonGroupId } from './customization/ribbon-control-ids';
import type { RibbonGalleryDescriptor } from './ribbon-galleries';
import { RIBBON_HOME_FAMILIES } from './ribbon-home-families';

/** Home group families that share one framework-neutral view. */
export type RibbonHomeFamily =
	| 'clipboard'
	| 'font'
	| 'paragraph'
	| 'editing'
	| 'slides'
	| 'drawing'
	| 'arrange-align'
	| 'arrange-flip'
	| 'arrange-order'
	| 'arrange-edit'
	| 'font-picker'
	| 'arrange-painter'
	| 'arrange-shape';

/** How a control behaves beyond a plain command button. */
export type RibbonHomeKind =
	/** Icon button that opens a menu of items (static in the spec or supplied by state). */
	| 'menu'
	/** Icon button with a colour bar that opens the shared colour popover. */
	| 'colour'
	/** Shared select primitive (`pptx-ui-select`), as a field or an icon-only menu. */
	| 'select'
	/** Spinner for a number. */
	| 'number'
	/** Layout thumbnail gallery popover (New Slide caret and Layout). */
	| 'layout'
	/** Embedded `pptx-ui-ribbon-gallery` fed by `state.gallery`. */
	| 'gallery';

/** One row of a menu or select; labels are translated by the view unless `label` is set. */
export interface RibbonHomeItem {
	readonly value: string;
	/** Ready-made text (a font family, a layout name); wins over `labelKey`. */
	readonly label?: string;
	readonly labelKey?: string;
	readonly fallback?: string;
	readonly description?: string;
	readonly descriptionKey?: string;
	/** Heading of the group this row opens; consecutive rows share one heading. */
	readonly group?: string;
	readonly groupKey?: string;
	readonly checked?: boolean;
	readonly disabled?: boolean;
	/** Preview typeface of a font row. */
	readonly fontFamily?: string;
	/** Shared artwork key shown before the label (a shape glyph or ribbon icon). */
	readonly icon?: string;
	/** Preserved test or automation hooks (`data-pptx-merge-op`, ...). */
	readonly attrs?: Readonly<Record<string, string>>;
	/** Draws a divider above the row. */
	readonly separator?: boolean;
}

/** Which standard swatch row a colour popover offers. */
export type RibbonHomeSwatchSet = 'office' | 'shape' | 'highlight';

export interface RibbonHomeColourSpec {
	readonly swatches: RibbonHomeSwatchSet;
	/** Show a colour bar under the icon (the current colour). */
	readonly bar?: boolean;
	/** Offer a native colour input as "Custom colour". */
	readonly custom?: boolean;
	/** Show the deck's theme palette when the state carries theme colours. */
	readonly theme?: boolean;
	/** Prefix of each standard swatch's accessible name (when it has no label). */
	readonly swatchLabelPrefix?: string;
}

export interface RibbonHomeControlSpec {
	readonly id: RibbonControlId;
	/** Distinguishes buttons that share one public id (the Align strip). */
	readonly part?: string;
	/** Accessible name and tooltip (the tooltip when visible text names the button). */
	readonly labelKey: string;
	readonly fallback: string;
	/** Framework-neutral test hook preserved from the migrated markup. */
	readonly testId?: string;
	/** Artwork key when it differs from the id (the Align and Distribute icons). */
	readonly icon?: string | false;
	/** Visible caption; it then names the button and `labelKey` becomes the tooltip. */
	readonly text?: { key: string; fallback: string };
	/** Opens a popover the element renders itself (see `kind`). */
	readonly popup?: boolean;
	readonly kind?: RibbonHomeKind;
	/** Static menu rows; state `items` replace them when present. */
	readonly items?: readonly RibbonHomeItem[];
	readonly colour?: RibbonHomeColourSpec;
	/** `pptx-ui-select` options: the picker role keeps `data-font-picker` hooks. */
	readonly select?: {
		picker?: 'family' | 'size';
		/** Icon-only trigger (`ribbon-icon` variant). */ icon?: boolean;
	};
	readonly number?: { min: number; max: number; step: number };
	/**
	 * Embedded `pptx-ui-ribbon-gallery`: the whole control when `kind` is `gallery`, otherwise
	 * a chevron-only library gallery after the button (Bullets, Numbering).
	 */
	readonly gallery?: { id: string; icon?: string };
	/** Hooks put on the main button (`data-pptx-ribbon-control`, ...). */
	readonly attrs?: Readonly<Record<string, string>>;
	/** Tooltip shown while the control is disabled, explaining what it needs. */
	readonly hintKey?: string;
	/** Adds a small chevron after the icon. */
	readonly chevron?: boolean;
	/** Second button that opens the popover of a split control (carries `part: 'caret'`). */
	readonly caret?: { labelKey: string; fallback: string; attrs?: Readonly<Record<string, string>> };
	/** Destructive styling hook. */
	readonly danger?: boolean;
	/** Office "large" command: the glyph above the caption instead of beside it. */
	readonly large?: boolean;
}

export interface RibbonHomeClusterSpec {
	readonly controls: readonly RibbonHomeControlSpec[];
	/** Joined strip (default) or free-standing pill buttons. */
	readonly free?: boolean;
	/** Preserved `data-pptx-chrome` layout hook. */
	readonly chrome?: string;
	/** Stack the controls in one column of small, captioned rows (Office's three-row groups). */
	readonly stack?: boolean;
}

export interface RibbonHomeFamilySpec {
	/** Present when the element renders the whole group (wrapper and caption). */
	readonly group?: {
		id: RibbonGroupId;
		captionKey: string;
		fallback: string;
		rowChrome?: string;
	};
	/** One customization id wrapped around every cluster (the Align and Distribute strips). */
	readonly wrapper?: { id: RibbonControlId; chrome?: string };
	readonly clusters: readonly RibbonHomeClusterSpec[];
}

export interface RibbonHomeControlState {
	disabled?: boolean;
	/** Omit for ordinary commands; a boolean reflects `aria-pressed`. */
	pressed?: boolean;
	/** Reserved for hosts that mirror their own popover; shared popovers set it themselves. */
	expanded?: boolean;
	hidden?: boolean;
	/** Select, number, colour bar and checked menu row. */
	value?: string | number;
	/** Menu or select rows that replace the spec's static ones. */
	items?: readonly RibbonHomeItem[];
	/** Colour popover content; the trigger shows `value` in its bar. */
	colour?: RibbonHomeColourModel;
	/** Layout gallery content. */
	layouts?: RibbonHomeLayoutModel;
	/** Embedded gallery content. */
	gallery?: { descriptor: RibbonGalleryDescriptor | undefined; disabled?: boolean };
}

export interface RibbonHomeColourModel {
	/** The deck's theme colour map; the popover derives the theme palette from it. */
	themeColors?: Readonly<Record<string, string>>;
	/** Theme reference of the current colour (highlights its swatch). */
	selectedRef?: PptxThemeColorRef;
	/** Recently used colours, newest first. */
	recent?: readonly string[];
}

export interface RibbonHomeLayoutModel {
	layouts: readonly { path: string; name: string }[];
	/** Marks the active tile; omitted by New Slide. */
	current?: string;
	/** Artwork data by layout path; tiles render name-only until it arrives. */
	previews?: Readonly<Record<string, PptxLayoutPreview>> | ReadonlyMap<string, PptxLayoutPreview>;
}

/** State key of a control: its id, or `id#part` when several buttons share one id. */
export type RibbonHomeKey = RibbonControlId | `${RibbonControlId}#${string}`;

export interface RibbonHomeViewState {
	/** Missing entries are enabled, unpressed and visible. */
	controls: Readonly<Partial<Record<RibbonHomeKey, RibbonHomeControlState>>>;
	translate?: (key: string) => string;
}

export interface RibbonHomeIntent {
	id: RibbonControlId;
	/** Which button of a shared id was used (`caret`, an align edge, ...). */
	part?: string;
	/** Picked menu row, select option, number, colour hex or layout path. */
	value?: string | number;
	/** Theme reference of a picked theme swatch. */
	ref?: PptxThemeColorRef;
}

/** Headings and actions of the shared colour popover. */
export const HOME_COLOUR_KEYS = [
	'pptx.colorPicker.themeColors',
	'pptx.colorPicker.standardColors',
	'pptx.colorPicker.recentColors',
	'pptx.ribbon.customColour',
] as const;

export const homeControlKey = (spec: { id: RibbonControlId; part?: string }): RibbonHomeKey =>
	spec.part ? `${spec.id}#${spec.part}` : spec.id;

export { RIBBON_HOME_FAMILIES };

export function homeFamilyControls(family: RibbonHomeFamily): readonly RibbonHomeControlSpec[] {
	return RIBBON_HOME_FAMILIES[family].clusters.flatMap((cluster) => cluster.controls);
}

export function homeLabel(state: RibbonHomeViewState, key: string, fallback: string): string {
	const value = state.translate?.(key);
	return value && value !== key ? value : fallback;
}

const HEX = /^#[0-9a-f]{6}$/iu;

function validPick(
	spec: RibbonHomeControlSpec,
	current: RibbonHomeControlState | undefined,
	value: string | number,
): boolean {
	if (spec.gallery) {
		// Gallery tiles are validated by the gallery module that applies them.
		return typeof value === 'string' && value !== '';
	}
	switch (spec.kind) {
		case 'menu':
		case 'select':
			return (current?.items ?? spec.items ?? []).some(
				(row) => row.value === String(value) && !row.disabled,
			);
		case 'colour':
			return typeof value === 'string' && HEX.test(value);
		case 'number':
			return (
				typeof value === 'number' &&
				Number.isFinite(value) &&
				value >= (spec.number?.min ?? -Infinity) &&
				value <= (spec.number?.max ?? Infinity)
			);
		case 'layout':
			return (current?.layouts?.layouts ?? []).some((layout) => layout.path === value);
		default:
			return false;
	}
}

/** Reject unknown ids, bad values and disabled or hidden controls, however the intent arrived. */
export function canRequestHome(
	family: RibbonHomeFamily,
	state: RibbonHomeViewState,
	intent: RibbonHomeIntent,
): boolean {
	const spec = homeFamilyControls(family).find(
		(entry) =>
			entry.id === intent.id &&
			(entry.part === intent.part || (intent.part === 'caret' && entry.caret !== undefined)),
	);
	if (!spec) {
		return false;
	}
	const current = state.controls[homeControlKey(intent)];
	if (current?.disabled || current?.hidden) {
		return false;
	}
	return intent.value === undefined || validPick(spec, current, intent.value);
}

/** Every translation key a family renders (labels, visible text, caret name, caption). */
export function homeFamilyKeys(family: RibbonHomeFamily): string[] {
	const spec = RIBBON_HOME_FAMILIES[family];
	const keys = spec.group ? [spec.group.captionKey] : [];
	for (const control of homeFamilyControls(family)) {
		keys.push(control.labelKey);
		if (control.text) {
			keys.push(control.text.key);
		}
		if (control.caret) {
			keys.push(control.caret.labelKey);
		}
		if (control.hintKey) {
			keys.push(control.hintKey);
		}
		for (const row of control.items ?? []) {
			if (row.labelKey) {
				keys.push(row.labelKey);
			}
			if (row.groupKey) {
				keys.push(row.groupKey);
			}
		}
		if (control.kind === 'layout') {
			keys.push('pptx.layoutGallery.empty', 'pptx.layoutGallery.current');
		}
		if (control.colour) {
			keys.push(...HOME_COLOUR_KEYS);
		}
	}
	return keys;
}

/**
 * Resolve a family's labels now, so a reactive host that re-derives its state when
 * the locale changes picks the new language up: the element itself only calls
 * `translate` while rendering, outside any framework's dependency tracking.
 */
export function homeSnapshotTranslator(
	families: readonly RibbonHomeFamily[],
	t: (key: string) => string,
): (key: string) => string {
	const labels = new Map<string, string>();
	for (const family of families) {
		for (const key of homeFamilyKeys(family)) {
			labels.set(key, t(key));
		}
	}
	return (key) => labels.get(key) ?? t(key);
}
