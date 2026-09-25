import { useEffect, useRef, useState } from 'react';

export interface RibbonDropdown {
	open: boolean;
	setOpen: React.Dispatch<React.SetStateAction<boolean>>;
	/** Wrapper holding both the trigger and the menu (outside-click boundary). */
	ref: React.RefObject<HTMLDivElement | null>;
}

/**
 * Open state for a ribbon dropdown that closes on a mouse-down outside its
 * wrapper or on Escape, the pattern every ribbon menu in this binding uses.
 */
export function useRibbonDropdown(): RibbonDropdown {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!open) {
			return;
		}
		const onMouseDown = (event: MouseEvent) => {
			if (ref.current && !ref.current.contains(event.target as Node)) {
				setOpen(false);
			}
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setOpen(false);
			}
		};
		document.addEventListener('mousedown', onMouseDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('mousedown', onMouseDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [open]);
	return { open, setOpen, ref };
}

/** Class for a menu entry inside a ribbon dropdown. */
export const RIBBON_MENU_ITEM_CLASS =
	'flex items-center w-full px-3 py-1.5 text-xs text-left hover:bg-muted transition-colors';

/** Class for a ribbon dropdown's surface. */
export const RIBBON_MENU_SURFACE_CLASS =
	'rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1 min-w-36';
