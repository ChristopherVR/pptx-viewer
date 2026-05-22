import React, { useCallback, useEffect, useRef, useState } from 'react';

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
	className,
	headerRight,
}: MobileSheetProps): React.ReactElement | null {
	const sheetRef = useRef<HTMLDivElement>(null);
	const [dragY, setDragY] = useState(0);
	const dragStartRef = useRef<number | null>(null);

	const onPointerDown = useCallback((e: React.PointerEvent) => {
		dragStartRef.current = e.clientY;
		(e.target as HTMLElement).setPointerCapture?.(e.pointerId);
	}, []);

	const onPointerMove = useCallback((e: React.PointerEvent) => {
		if (dragStartRef.current === null) {
			return;
		}
		const delta = e.clientY - dragStartRef.current;
		setDragY(Math.max(0, delta));
	}, []);

	const onPointerUp = useCallback(
		(e: React.PointerEvent) => {
			if (dragStartRef.current === null) {
				return;
			}
			const delta = e.clientY - dragStartRef.current;
			dragStartRef.current = null;
			(e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
			if (delta > 120) {
				onClose();
			}
			setDragY(0);
		},
		[onClose],
	);

	useEffect(() => {
		if (!open) {
			return;
		}
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose();
			}
		};
		window.addEventListener('keydown', handleKey);
		return () => window.removeEventListener('keydown', handleKey);
	}, [open, onClose]);

	if (!open) {
		return null;
	}

	const heightStyle = fullScreen
		? { height: 'calc(100dvh - env(safe-area-inset-top))' }
		: { height: `${Math.round(heightFraction * 100)}dvh` };

	return (
		<div
			className='fixed inset-0 z-50 flex flex-col justify-end md:hidden'
			role='dialog'
			aria-modal='true'
		>
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
				className={cn(
					'relative bg-background border-t border-border rounded-t-2xl shadow-2xl flex flex-col overflow-hidden',
					'animate-in slide-in-from-bottom duration-200',
					className,
				)}
				style={{
					...heightStyle,
					transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
					transition: dragStartRef.current === null ? 'transform 150ms ease-out' : 'none',
				}}
			>
				{/* Drag handle */}
				<div
					className='flex items-center justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none'
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={onPointerUp}
					onPointerCancel={onPointerUp}
				>
					<div className='h-1 w-10 rounded-full bg-muted-foreground/40' />
				</div>

				{/* Header */}
				{(title || headerRight) && (
					<div className='flex items-center justify-between gap-2 px-4 pb-2 border-b border-border/60'>
						<div className='text-sm font-semibold text-foreground truncate'>{title}</div>
						{headerRight}
					</div>
				)}

				{/* Body */}
				<div className='flex-1 overflow-y-auto overscroll-contain'>{children}</div>
			</div>
		</div>
	);
}
