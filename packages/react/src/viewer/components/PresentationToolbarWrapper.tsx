/**
 * Auto-hide wrapper around `PresentationToolbar`:
 * - Shows on any mouse movement
 * - Hides after `AUTO_HIDE_DELAY_MS` (3 s) of no movement
 * - Always shows when hovering over the toolbar itself
 * - Uses CSS opacity transitions for smooth fade in/out
 */
import { PRESENT_TOOLBAR_CLASSES } from 'pptx-viewer-shared';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { AUTO_HIDE_DELAY_MS, isInBottomTriggerZone } from './presentation-toolbar-utils';
import { PresentationToolbar } from './PresentationToolbar';
import type { PresentationToolbarProps } from './PresentationToolbar';

export interface PresentationToolbarWrapperProps extends PresentationToolbarProps {
	/** Ref to the container element used for bottom-zone hit testing. */
	containerRef?: React.RefObject<HTMLElement | null>;
}

export function PresentationToolbarWrapper({
	containerRef,
	...toolbarProps
}: PresentationToolbarWrapperProps): React.ReactElement {
	const [visible, setVisible] = useState(false);
	const hideTimerRef = useRef<number | null>(null);
	const hoveringRef = useRef(false);

	const clearHideTimer = useCallback(() => {
		if (hideTimerRef.current !== null) {
			window.clearTimeout(hideTimerRef.current);
			hideTimerRef.current = null;
		}
	}, []);

	const resetHideTimer = useCallback(() => {
		clearHideTimer();
		hideTimerRef.current = window.setTimeout(() => {
			if (!hoveringRef.current) {
				setVisible(false);
			}
		}, AUTO_HIDE_DELAY_MS);
	}, [clearHideTimer]);

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			const container = containerRef?.current;
			if (container) {
				const rect = container.getBoundingClientRect();
				if (isInBottomTriggerZone(e.clientY, rect.height, rect.top)) {
					setVisible(true);
					resetHideTimer();
					return;
				}
			}

			// Any movement shows the toolbar, then starts auto-hide countdown
			setVisible(true);
			resetHideTimer();
		};

		document.addEventListener('mousemove', handleMouseMove);
		return () => {
			document.removeEventListener('mousemove', handleMouseMove);
			clearHideTimer();
		};
	}, [containerRef, resetHideTimer, clearHideTimer]);

	const handleMouseEnter = useCallback(() => {
		hoveringRef.current = true;
		clearHideTimer();
		setVisible(true);
	}, [clearHideTimer]);

	const handleMouseLeave = useCallback(() => {
		hoveringRef.current = false;
		resetHideTimer();
	}, [resetHideTimer]);

	return (
		<div
			className={PRESENT_TOOLBAR_CLASSES.wrapper}
			style={{
				opacity: visible ? 1 : 0,
				pointerEvents: visible ? 'auto' : 'none',
			}}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			<PresentationToolbar {...toolbarProps} />
		</div>
	);
}
