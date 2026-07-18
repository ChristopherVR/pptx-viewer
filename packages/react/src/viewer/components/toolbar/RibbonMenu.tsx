import React, { useEffect, useState } from 'react';

import { cn } from '../../utils';

export interface RibbonMenuProps {
	/** Trigger wrapper the menu hangs below; its left/bottom edges are tracked. */
	anchorRef: React.RefObject<HTMLElement | null>;
	className?: string;
	children: React.ReactNode;
}

/**
 * Fixed-position dropdown surface for ribbon controls.
 *
 * The ribbon content row is a horizontal scroll container (overflow-x-auto),
 * which would clip any absolutely positioned popup to the row's height.
 * Rendering the menu with position: fixed escapes that clipping while keeping
 * the menu a DOM descendant of its trigger, so outside-click contains() checks
 * and CSS group-hover visibility keep working unchanged. Coordinates re-sync
 * on mount, anchor hover, any scroll (capture phase), and window resize.
 */
export function RibbonMenu({
	anchorRef,
	className,
	children,
}: RibbonMenuProps): React.ReactElement {
	const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

	useEffect(() => {
		const anchor = anchorRef.current;
		if (!anchor) {
			return;
		}
		const update = () => {
			const rect = anchor.getBoundingClientRect();
			setPos((prev) =>
				prev && prev.left === rect.left && prev.top === rect.bottom
					? prev
					: { left: rect.left, top: rect.bottom },
			);
		};
		update();
		anchor.addEventListener('mouseenter', update);
		window.addEventListener('resize', update);
		document.addEventListener('scroll', update, true);
		return () => {
			anchor.removeEventListener('mouseenter', update);
			window.removeEventListener('resize', update);
			document.removeEventListener('scroll', update, true);
		};
	}, [anchorRef]);

	return (
		<div
			className={cn('fixed z-50', className)}
			style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
		>
			{children}
		</div>
	);
}
