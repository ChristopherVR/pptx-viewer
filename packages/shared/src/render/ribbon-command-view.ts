import type { RibbonControlId, RibbonGroupId } from './customization';

/** A host supplies translated labels and controlled state; shared owns markup. */
export interface RibbonCommandView {
	id: RibbonControlId;
	label: string;
	icon: string;
	title?: string;
	disabled?: boolean;
	active?: boolean;
	pressed?: boolean;
	expanded?: boolean;
	hidden?: boolean;
	compact?: boolean;
	badge?: number;
	/** Commands with the same column share a vertical stack. */
	column?: number;
}

export interface RibbonGroupView {
	id: RibbonGroupId;
	label: string;
	commands: readonly RibbonCommandView[];
}
