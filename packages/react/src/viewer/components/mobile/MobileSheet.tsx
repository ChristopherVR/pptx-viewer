import React, { useRef } from 'react';

import { useModalFocus } from '../../hooks/useModalFocus';
import { useSheetDismissDrag } from '../../hooks/useSheetDismissDrag';
import { cn } from '../../utils';

export interface MobileSheetProps {
	open: boolean;
	onClose: () => void;
	title?: React.ReactNode;
	children: React.ReactNode;
	/** Initial sheet height as a percentage of viewport (0-1). Default 0.6. */
	heightFraction?: number;
	/** When true, sheet covers full viewport. */
	fullScreen?: boolean;
	/**
	 * When true, the sheet sizes to its content (up to 85dvh, then the body
	 * scrolls). Preferred over `fullScreen` for variable-height content so short
	 * sections don't leave a large empty void below the controls.
	 */
	autoHeight?: boolean;
	className?: string;
	/** Extra header content rendered to the right of the title. */
	headerRight?: React.ReactNode;
}

/**
 * Mobile bottom sheet with a drag handle. Tapping the backdrop or dragging
 * past the dismiss threshold closes it. Uses CSS dvh so it survives the
 * mobile address-bar collapse.
 */
export function MobileSheet({
	open,
	onClose,
	title,
	children,
	heightFraction = 0.6,
	fullScreen = false,
	autoHeight = false,
	className,
	headerRight,
}: MobileSheetProps): React.ReactElement | null {
	const sheetRef = useRef<HTMLDivElement>(null);
	const { dragY, dragging, handlers } = useSheetDismissDrag(onClose);
	useModalFocus(open, sheetRef, onClose);

	if (!open) {
		return null;
	}

	const heightStyle = autoHeight
		? { maxHeight: 'calc(85dvh - env(safe-area-inset-top))' }
		: fullScreen
			? { height: 'calc(100dvh - env(safe-area-inset-top))' }
			: { height: `${Math.round(heightFraction * 100)}dvh` };

	return (
		<div className='fixed inset-0 z-50 flex flex-col justify-end'>
			{/* Backdrop */}
			<button
				type='button'
				aria-label='Close'
				className='absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150'
				onClick={onClose}
			/>

			{/* Sheet */}
			<div
				ref={sheetRef}
				role='dialog'
				aria-modal='true'
				aria-label={typeof title === 'string' ? title : 'Mobile panel'}
				tabIndex={-1}
				className={cn(
					'relative bg-background border-t border-border rounded-t-2xl shadow-2xl flex flex-col overflow-hidden',
					'animate-in slide-in-from-bottom duration-200',
					className,
				)}
				style={{
					...heightStyle,
					transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
					transition: dragging ? 'none' : 'transform 150ms ease-out',
				}}
			>
				{/* Drag handle + header form a single swipe-to-dismiss grab region so
				    the gesture isn't limited to the thin pill. */}
				<div
					className='cursor-grab active:cursor-grabbing touch-none'
					onPointerDown={handlers.onPointerDown}
					onPointerMove={handlers.onPointerMove}
					onPointerUp={handlers.onPointerUp}
					onPointerCancel={handlers.onPointerCancel}
				>
					<div className='flex items-center justify-center pt-2 pb-1'>
						<div className='h-1 w-10 rounded-full bg-muted-foreground/40' />
					</div>

					{/* Header */}
					{(title || headerRight) && (
						<div className='flex items-center justify-between gap-2 px-4 pb-2 border-b border-border/60'>
							<div className='text-sm font-semibold text-foreground truncate'>{title}</div>
							{headerRight}
							<button
								type='button'
								aria-label='Close'
								onPointerDown={(event) => event.stopPropagation()}
								onClick={onClose}
								className='inline-flex h-8 w-8 items-center justify-center rounded text-xl text-muted-foreground hover:bg-accent hover:text-foreground'
							>
								&times;
							</button>
						</div>
					)}
				</div>

				{/* Body */}
				<div className='flex-1 overflow-y-auto overscroll-contain'>{children}</div>
			</div>
		</div>
	);
}
