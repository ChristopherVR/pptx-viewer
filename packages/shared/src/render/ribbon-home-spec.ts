import type { RibbonControlId, RibbonGroupId } from './customization/ribbon-control-ids';
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
	| 'arrange-edit';

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
	/** Opens a native popover the host anchors on {@link PptxUiRibbonHomeElement.anchor}. */
	readonly popup?: boolean;
	/** Second button that opens the popover of a split control (carries `part: 'caret'`). */
	readonly caret?: { labelKey: string; fallback: string };
	/** Destructive styling hook. */
	readonly danger?: boolean;
}

export interface RibbonHomeClusterSpec {
	readonly controls: readonly RibbonHomeControlSpec[];
	/** Joined strip (default) or free-standing pill buttons. */
	readonly free?: boolean;
	/** Preserved `data-pptx-chrome` layout hook. */
	readonly chrome?: string;
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
	/** Popover triggers only: reflects `aria-expanded` while the native popover is open. */
	expanded?: boolean;
	hidden?: boolean;
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
}

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

/** Reject unknown ids and disabled or hidden controls, however the intent arrived. */
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
	return !current?.disabled && !current?.hidden;
}
