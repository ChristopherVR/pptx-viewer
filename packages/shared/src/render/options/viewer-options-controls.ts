import type { ViewerOptionsGroupId } from './viewer-options';

/**
 * Control/section/tab descriptor types for the File > Options schema, plus
 * the terse constructors the tab-definition modules build panes with.
 */

export type ViewerOptionsTabId =
	| 'general'
	| 'proofing'
	| 'save'
	| 'language'
	| 'accessibility'
	| 'advanced'
	| 'ribbon'
	| 'quickAccess'
	| 'addIns'
	| 'trust';

export interface ViewerOptionsSelectChoice {
	value: string;
	labelKey: string;
}

interface ControlBase {
	group: ViewerOptionsGroupId;
	key: string;
	labelKey: string;
	/** Optional "(i)" tooltip body, mirroring PowerPoint's info bubbles. */
	infoKey?: string;
	/** Renders indented under the preceding control, PowerPoint-style. */
	indent?: boolean;
}

export interface ViewerOptionsToggleControl extends ControlBase {
	kind: 'toggle';
}

export interface ViewerOptionsSelectControl extends ControlBase {
	kind: 'select';
	choices: readonly ViewerOptionsSelectChoice[];
}

export interface ViewerOptionsNumberControl extends ControlBase {
	kind: 'number';
	min: number;
	max: number;
	step?: number;
	unitKey?: string;
}

export interface ViewerOptionsTextControl extends ControlBase {
	kind: 'text';
	maxLength?: number;
}

export type ViewerOptionsControl =
	| ViewerOptionsToggleControl
	| ViewerOptionsSelectControl
	| ViewerOptionsNumberControl
	| ViewerOptionsTextControl;

export interface ViewerOptionsSection {
	id: string;
	titleKey: string;
	/** Optional explanatory paragraph under the section title. */
	descriptionKey?: string;
	/** Marks a bespoke block a binding renders itself (e.g. the theme picker). */
	special?: 'themePicker' | 'clearCache' | 'shortcutReference';
	controls: readonly ViewerOptionsControl[];
}

export interface ViewerOptionsTabDefinition {
	id: ViewerOptionsTabId;
	labelKey: string;
	/** Headline shown at the top of the pane. */
	descriptionKey: string;
	/** Pane needing a bespoke view instead of (or on top of) `sections`. */
	custom?: 'language' | 'ribbon' | 'quickAccess' | 'addIns';
	sections: readonly ViewerOptionsSection[];
}

export function toggle(
	group: ViewerOptionsGroupId,
	key: string,
	labelKey: string,
	extra?: Partial<Pick<ViewerOptionsToggleControl, 'infoKey' | 'indent'>>,
): ViewerOptionsToggleControl {
	return { kind: 'toggle', group, key, labelKey, ...extra };
}

export function select(
	group: ViewerOptionsGroupId,
	key: string,
	labelKey: string,
	choiceList: readonly ViewerOptionsSelectChoice[],
): ViewerOptionsSelectControl {
	return { kind: 'select', group, key, labelKey, choices: choiceList };
}

export function numberControl(
	group: ViewerOptionsGroupId,
	key: string,
	labelKey: string,
	min: number,
	max: number,
	unitKey?: string,
): ViewerOptionsNumberControl {
	return { kind: 'number', group, key, labelKey, min, max, unitKey };
}

export function textControl(
	group: ViewerOptionsGroupId,
	key: string,
	labelKey: string,
): ViewerOptionsTextControl {
	return { kind: 'text', group, key, labelKey, maxLength: 64 };
}

export function choices(prefix: string, values: readonly string[]): ViewerOptionsSelectChoice[] {
	return values.map((value) => ({ value, labelKey: `${prefix}.${value}` }));
}

export const SCREEN_TIP_CHOICES = choices('pptx.options.screenTipStyle', [
	'descriptions',
	'plain',
	'off',
]);
