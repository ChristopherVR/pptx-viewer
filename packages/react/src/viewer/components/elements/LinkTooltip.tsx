/**
 * LinkTooltip — PowerPoint-style tooltip for actionable elements and hyperlinks.
 *
 * Shows the link destination and a "Ctrl+Click to follow link" hint.
 * Uses CSS group-hover for zero-state, zero-rerender display logic.
 * The parent element must have the `group/link` class.
 */
import React from 'react';

export interface LinkTooltipProps {
	/** The link URL or tooltip text to display. */
	label: string;
	/** Whether this action has a URL (external link) or is a slide navigation action. */
	hasUrl?: boolean;
}

export function LinkTooltip({ label, hasUrl }: LinkTooltipProps): React.ReactElement {
	return (
		<div className='pointer-events-none absolute left-1 top-full z-[9999] mt-1 max-w-64 opacity-0 transition-opacity duration-150 group-hover/link:opacity-100'>
			<div className='rounded border border-border bg-popover px-2.5 py-1.5 shadow-lg'>
				<div className='truncate text-xs text-foreground'>{label}</div>
				<div className='mt-0.5 text-[10px] text-muted-foreground'>
					{hasUrl ? 'Ctrl+Click to follow link' : 'Active in presentation mode'}
				</div>
			</div>
		</div>
	);
}
