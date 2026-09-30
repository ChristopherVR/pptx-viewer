import type {
	RibbonControlId,
	RibbonGroupId,
	RibbonCommandRequestEvent,
	RibbonToggleRequestEvent,
} from 'pptx-viewer-shared';
import React, { useEffect, useRef } from 'react';

function useIntent(
	ref: React.RefObject<HTMLElement | null>,
	type: string,
	callback?: (event: Event) => void,
): void {
	useEffect(() => {
		const host = ref.current;
		if (!host || !callback) {
			return;
		}
		host.addEventListener(type, callback);
		return () => host.removeEventListener(type, callback);
	}, [ref, type, callback]);
}

export function WebRibbonGroup({
	label,
	groupId,
	children,
}: {
	label: string;
	groupId?: RibbonGroupId;
	children: React.ReactNode;
}): React.ReactElement {
	return (
		<pptx-ui-ribbon-group label={label} data-ribbon-group={groupId}>
			{children}
		</pptx-ui-ribbon-group>
	);
}

export function WebRibbonCommand({
	label,
	icon,
	controlId,
	title,
	disabled,
	active,
	pressed,
	expanded,
	compact,
	onCommand,
}: {
	label: string;
	icon: string;
	controlId: RibbonControlId;
	title?: string;
	disabled?: boolean;
	active?: boolean;
	pressed?: boolean;
	expanded?: boolean;
	compact?: boolean;
	onCommand?: (id: RibbonControlId) => void;
}): React.ReactElement {
	const ref = useRef<HTMLElement>(null);
	useIntent(
		ref,
		'command-request',
		onCommand ? (event) => onCommand((event as RibbonCommandRequestEvent).detail.id) : undefined,
	);
	return (
		<pptx-ui-ribbon-command
			ref={ref}
			label={label}
			icon={icon}
			data-ribbon-control={controlId}
			title={title}
			disabled={disabled || undefined}
			active={active || undefined}
			pressed={pressed === undefined ? undefined : String(pressed)}
			expanded={expanded === undefined ? undefined : String(expanded)}
			compact={compact || undefined}
		/>
	);
}

export function WebRibbonToggle({
	label,
	controlId,
	checked,
	title,
	onToggle,
}: {
	label: string;
	controlId: RibbonControlId;
	checked: boolean;
	title?: string;
	onToggle?: (checked: boolean) => void;
}): React.ReactElement {
	const ref = useRef<HTMLElement>(null);
	useIntent(
		ref,
		'toggle-request',
		onToggle ? (event) => onToggle((event as RibbonToggleRequestEvent).detail.checked) : undefined,
	);
	return (
		<pptx-ui-ribbon-toggle
			ref={ref}
			label={label}
			data-ribbon-control={controlId}
			checked={checked || undefined}
			title={title}
		/>
	);
}
