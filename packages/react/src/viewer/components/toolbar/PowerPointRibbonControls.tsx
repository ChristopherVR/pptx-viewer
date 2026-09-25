import type { RibbonControlId, RibbonGroupId } from 'pptx-viewer-shared';
import { RIBBON_CONTROL_ATTR, RIBBON_GROUP_ATTR } from 'pptx-viewer-shared';
import React from 'react';

import { cn } from '../../utils';

/** `data-ribbon-control` for an optional catalogue id (nothing when absent). */
export function controlAttr(id: RibbonControlId | undefined): Record<string, string> {
	return id ? { [RIBBON_CONTROL_ATTR]: id } : {};
}

/** `data-ribbon-group` for an optional catalogue id (nothing when absent). */
export function groupAttr(id: RibbonGroupId | undefined): Record<string, string> {
	return id ? { [RIBBON_GROUP_ATTR]: id } : {};
}

/**
 * A layout-neutral (`display: contents`) wrapper naming a ribbon group, for
 * groups whose markup has no wrapper of its own. Several scopes may carry the
 * same id when a group's controls are not contiguous.
 */
export function RibbonGroupScope({
	id,
	children,
}: {
	id: RibbonGroupId;
	children: React.ReactNode;
}): React.ReactElement {
	return (
		<div className='contents' {...groupAttr(id)}>
			{children}
		</div>
	);
}

export function RibbonGroup({
	label,
	children,
	className,
	groupId,
}: {
	label: string;
	children: React.ReactNode;
	className?: string;
	/** Catalogue id (`<tab>.<group>`) for host customisation. */
	groupId?: RibbonGroupId;
}): React.ReactElement {
	return (
		<section
			{...groupAttr(groupId)}
			className={cn(
				'relative flex min-h-[78px] self-stretch shrink-0 items-start gap-1 border-r border-border/60 px-2 pb-4 pt-1 last:border-r-0',
				className,
			)}
			aria-label={label}
		>
			{children}
			<span className='pointer-events-none absolute inset-x-1 bottom-0.5 truncate text-center text-[9px] leading-3 text-muted-foreground'>
				{label}
			</span>
		</section>
	);
}

export function RibbonCommand({
	label,
	icon,
	onClick,
	disabled,
	active,
	compact = false,
	title,
	pressed,
	controlId,
}: {
	label: string;
	icon: React.ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	active?: boolean;
	compact?: boolean;
	title?: string;
	/** Renders the command as a two-state toggle (PowerPoint's Hide Slide). */
	pressed?: boolean;
	/** Catalogue id (`<tab>.<group>.<control>`) for host customisation. */
	controlId?: RibbonControlId;
}): React.ReactElement {
	return (
		<button
			type='button'
			{...controlAttr(controlId)}
			onClick={onClick}
			disabled={disabled}
			title={title ?? label}
			aria-pressed={pressed}
			className={cn(
				'inline-flex rounded-sm text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-35',
				active && 'bg-primary/15 text-primary ring-1 ring-primary/35',
				compact
					? 'h-[26px] min-w-[88px] items-center gap-1.5 px-1.5 text-left text-[10px] leading-3'
					: 'h-[58px] min-w-[54px] max-w-[72px] flex-col items-center justify-start gap-0.5 px-1 py-1 text-center text-[9px] leading-[11px]',
			)}
		>
			<span
				className={cn(
					'grid shrink-0 place-items-center text-primary',
					compact ? 'h-4 w-4 [&>svg]:h-4 [&>svg]:w-4' : 'h-7 w-7 [&>svg]:h-6 [&>svg]:w-6',
				)}
				aria-hidden='true'
			>
				{icon}
			</span>
			<span>{label}</span>
		</button>
	);
}

export function RibbonCommandStack({
	children,
}: {
	children: React.ReactNode;
}): React.ReactElement {
	return <div className='flex flex-col justify-start gap-0.5'>{children}</div>;
}

export function RibbonToggle({
	label,
	checked,
	onChange,
	disabled,
	title,
	controlId,
}: {
	label: string;
	checked: boolean;
	onChange?: (checked: boolean) => void;
	disabled?: boolean;
	title?: string;
	controlId?: RibbonControlId;
}): React.ReactElement {
	return (
		<label
			{...controlAttr(controlId)}
			title={title}
			className={cn(
				'flex h-[19px] items-center gap-1 whitespace-nowrap rounded-sm px-1 text-[10px] text-foreground',
				checked && 'bg-primary/15 text-primary',
			)}
		>
			<input
				type='checkbox'
				checked={checked}
				disabled={disabled}
				onChange={(event) => onChange?.(event.target.checked)}
				className='h-3 w-3 accent-primary disabled:opacity-35'
			/>
			{label}
		</label>
	);
}
