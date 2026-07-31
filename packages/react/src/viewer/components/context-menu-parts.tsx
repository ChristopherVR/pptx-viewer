import type React from 'react';

/**
 * The building blocks of the canvas context menu.
 *
 * They exist so the menu's twenty-odd entries declare `role="menuitem"` in one
 * place instead of twenty. React shipped its menu as a bare `<div>` of unroled
 * `<button>`s: a screen reader announced a pile of loose buttons with no menu
 * around them, while Vue, Angular and Svelte all exposed menu semantics. Roles
 * spelled out per entry are exactly the kind of detail that goes missing again
 * the next time a command is added, so the entry owns its own role here.
 */

const ITEM_CLASS = 'w-full px-3 py-1.5 text-left hover:bg-muted';
const DANGER_ITEM_CLASS = 'w-full px-3 py-1.5 text-left text-red-300 hover:bg-red-900/40';
/** Greyed but still announced, so the command's absence is never a surprise. */
const DISABLED_CLASS = ' opacity-40 pointer-events-none';

export interface ContextMenuItemProps {
	/** Invoked when the entry is activated. */
	onSelect: () => void;
	/** Destructive entries (Delete) are tinted red, as in PowerPoint. */
	danger?: boolean;
	/** Offered but not usable now (empty clipboard, unwired handler). */
	disabled?: boolean;
	children: React.ReactNode;
}

/** One activatable command in the context menu. */
export function ContextMenuItem({
	onSelect,
	danger,
	disabled,
	children,
}: ContextMenuItemProps): React.ReactElement {
	return (
		<button
			type='button'
			role='menuitem'
			disabled={disabled}
			className={`${danger ? DANGER_ITEM_CLASS : ITEM_CLASS}${disabled ? DISABLED_CLASS : ''}`}
			onClick={onSelect}
		>
			{children}
		</button>
	);
}

/**
 * A rule between groups of commands. Carries `role="separator"` so the grouping
 * a sighted user reads from the rule is announced rather than being decoration
 * a screen reader has to guess at.
 */
// A separator is a structural role, not a control: labelling it would make a
// screen reader announce a rule that exists only to group the commands around
// it, which is why the control-label rule is switched off for this element.
/* oxlint-disable jsx-a11y/control-has-associated-label */
export function ContextMenuSeparator(): React.ReactElement {
	return (
		<div role='separator' aria-orientation='horizontal' className='my-1 border-t border-border' />
	);
}
/* oxlint-enable jsx-a11y/control-has-associated-label */
