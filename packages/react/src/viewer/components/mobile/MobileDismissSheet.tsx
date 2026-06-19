import type React from 'react';

import { useSheetDismissDrag } from '../../hooks/useSheetDismissDrag';

export interface MobileDismissSheetProps {
	/** Dismiss callback: fired by the backdrop tap or a swipe past the threshold. */
	onClose: () => void;
	/**
	 * Classes for the panel container. Pass the desktop side-panel layout plus the
	 * `max-md:` bottom-sheet styling; the swipe handle and backdrop are `md:hidden`
	 * so the gesture only applies on mobile.
	 */
	className?: string;
	children: React.ReactNode;
}

/**
 * Wraps a panel that renders as a desktop side panel and a mobile bottom sheet,
 * adding the same swipe-down-to-dismiss gesture and backdrop used by the
 * Format/Comments/Notes sheets. Centralises the gesture so every mobile sheet
 * dismisses consistently rather than relying on a close button alone.
 */
export function MobileDismissSheet({
	onClose,
	className,
	children,
}: MobileDismissSheetProps): React.ReactElement {
	const { dragY, handlers } = useSheetDismissDrag(onClose);

	return (
		<>
			{/* Mobile backdrop: tap to dismiss. */}
			<button
				type='button'
				aria-label='Close'
				onClick={onClose}
				className='md:hidden fixed inset-0 z-20 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150'
			/>
			<div
				className={className}
				style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
			>
				{/* Mobile drag handle: swipe down past the threshold to dismiss. */}
				<div
					className='md:hidden flex items-center justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none'
					onPointerDown={handlers.onPointerDown}
					onPointerMove={handlers.onPointerMove}
					onPointerUp={handlers.onPointerUp}
					onPointerCancel={handlers.onPointerCancel}
				>
					<div className='h-1 w-10 rounded-full bg-muted-foreground/40' />
				</div>
				{children}
			</div>
		</>
	);
}
