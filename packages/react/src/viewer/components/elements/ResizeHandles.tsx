import {
	createRotationDrag,
	elementIdSelector,
	getResizeHandleHitAreaStyle,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ShapeAdjustmentHandleDescriptor } from '../../types';
import { cn } from '../../utils';
import { syncSelectionHandleOverlay } from '../../utils/selection-handle-overlay';
import { CORNER_HANDLES, EDGE_HANDLES } from './resize-handle-classes';
import { RotateHandleArtwork } from './RotateHandleArtwork';
import {
	RESIZE_ARTWORK,
	RESIZE_DEFAULT_CLASSES,
	ROTATE_ARTWORK,
	ROTATE_DEFAULT_CLASSES,
} from './selection-control-artwork';
import { useRotateHandlePlacement } from './use-rotate-handle-placement';

export { CORNER_HANDLES, EDGE_HANDLES } from './resize-handle-classes';

export interface ResizeHandlesProps {
	elementId: string;
	/**
	 * Every `a:avLst` handle the shape offers, not just the first: PowerPoint
	 * shows one amber diamond per adjustable parameter and presets routinely
	 * have several (`quadArrow` three, `callout3` four).
	 */
	adjustmentHandles: ShapeAdjustmentHandleDescriptor[];
	onResizePointerDown: (elementId: string, e: React.MouseEvent, handle: string) => void;
	onAdjustmentPointerDown: (
		elementId: string,
		e: React.MouseEvent,
		descriptor: ShapeAdjustmentHandleDescriptor,
	) => void;
	/** Whether to force pointerEvents: "auto" on buttons (needed inside pointer-events:none containers). */
	forcePointerEvents?: boolean;
	/** Current element rotation in degrees (the rotate-handle drag baseline). */
	rotation?: number;
	/** Element transform sans rotation (flips/skews); the live-preview base. */
	nonRotationTransform?: string;
	/** Commit a new rotation (degrees) for the element. Omit to hide the handle. */
	onRotate?: (elementId: string, rotationDeg: number) => void;
}

/**
 * Touch-action: none stops the browser from claiming touch gestures (scroll /
 * pinch-zoom) over a handle so a finger drag becomes a resize. Applied to every
 * handle button alongside the pointer-down wiring below.
 */
const HANDLE_TOUCH_ACTION = {
	touchAction: 'none' as const,
	// Keep both the visible indicator and its expanded hit area in screen pixels.
	// Only the button scales; its center and the overlay remain in slide coordinates.
	scale: 'var(--pptx-handle-inverse-scale, 1)',
};

export function ResizeHandles({
	elementId,
	adjustmentHandles,
	onResizePointerDown,
	onAdjustmentPointerDown,
	forcePointerEvents,
	rotation,
	nonRotationTransform,
	onRotate,
}: ResizeHandlesProps) {
	const { t } = useTranslation();
	const rotateRef = useRotateHandlePlacement(elementId, Boolean(onRotate));
	const peStyle = forcePointerEvents
		? { ...HANDLE_TOUCH_ACTION, pointerEvents: 'auto' as const }
		: HANDLE_TOUCH_ACTION;
	// The bounded child owns the press, which still bubbles through its semantic
	// button for focus, mouse/touch dispatch and pointer capture. Neither the
	// indicator nor an unbounded button box may steal a neighboring handle.
	const resizeStyle = { ...HANDLE_TOUCH_ACTION, pointerEvents: 'none' as const };

	// Touch/pen presses start the resize via Pointer Events (mouse keeps using
	// onMouseDown so desktop behaviour is unchanged and never double-fires). The
	// pointer is captured so the gesture keeps tracking even if the finger drifts
	// off the small handle.
	const handleResizePointer = (e: React.PointerEvent, handle: string) => {
		if (e.pointerType === 'mouse') {
			return;
		}
		e.stopPropagation();
		(e.currentTarget as Element).setPointerCapture?.(e.pointerId);
		onResizePointerDown(elementId, e, handle);
	};

	// ── Rotate handle (self-contained) ───────────────────────────────────
	// Dragging the knob rotates from its initial press and authored angle,
	// keeping off-center grabs stable. Preview live by mutating the wrapper
	// transform, then commit the final degrees on release. Shift snaps to 15°.
	const startRotate = (
		btn: HTMLElement,
		pointer: { clientX: number; clientY: number },
		pointerId?: number,
	): void => {
		// Resolve the REAL element node directly by id, not via `closest`: since
		// selection handles now live in a stage-level overlay that is a SIBLING of
		// `ElementRenderer` (not its parent), `data-element-id` is never an
		// ancestor of `btn` for a regular shape, so `closest` always landed on the
		// overlay host instead. Mutating the overlay's (invisible) transform live
		// rotated only the handles; the shape itself stayed frozen until the
		// `onRotate` commit on release. A connector still nests its handles
		// inside its own element, which also carries `data-element-id`, so the
		// direct lookup covers both cases uniformly.
		//
		// Scoped to this viewer's `[data-pptx-viewport]`, never `document`: two
		// viewers of one deck on the same page (docs landing, collab demo) both
		// render the selected id, and a page-wide lookup would spin the OTHER
		// instance's shape. The handle button is always inside the viewport, so
		// `closest` finds it; the `document` fallback only serves unit tests that
		// mount the handles bare.
		const scope = btn.closest('[data-pptx-viewport]') ?? document;
		const wrapper = scope.querySelector<HTMLElement>(elementIdSelector(elementId));
		if (!wrapper) {
			return;
		}
		const rect = wrapper.getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		// Rotation must precede the flip/skew transforms so a live rotate-drag
		// preview matches the resting `getElementTransform` order (rotate first).
		const base = nonRotationTransform ? ` ${nonRotationTransform}` : '';
		const startDeg = rotation ?? 0;
		const dragRotation = createRotationDrag(
			{ x: cx, y: cy },
			{ x: pointer.clientX, y: pointer.clientY },
			startDeg,
		);
		let last = startDeg;
		if (pointerId !== undefined) {
			btn.setPointerCapture?.(pointerId);
		}
		// Track via Pointer Events only; they fire for both mouse and touch,
		// matching the rest of the canvas (usePointerHandlers). A plain
		// `mousemove` listener would miss the touch drag entirely.
		const apply = (clientX: number, clientY: number, shift: boolean): void => {
			let deg = dragRotation({ x: clientX, y: clientY });
			if (shift) {
				deg = Math.round(deg / 15) * 15;
			}
			deg = Math.round(((deg % 360) + 360) % 360);
			last = deg;
			const transform = `rotate(${deg}deg)${base}`;
			wrapper.style.transform = transform;
			syncSelectionHandleOverlay(wrapper, elementId, { transform });
		};
		const onPointerMove = (ev: PointerEvent): void => apply(ev.clientX, ev.clientY, ev.shiftKey);
		const end = (): void => {
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', end);
			window.removeEventListener('pointercancel', end);
			if (last !== startDeg) {
				onRotate?.(elementId, last);
			}
		};
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', end);
		window.addEventListener('pointercancel', end);
	};

	return (
		<>
			{/* The semantic frame keeps the bounded hit region; artwork never owns presses. */}
			{[...CORNER_HANDLES, ...EDGE_HANDLES].map(({ handle, posClass, cursor }) => {
				const corner = handle.length === 2;
				const styles =
					RESIZE_ARTWORK[
						corner ? 'corner' : handle === 'n' || handle === 's' ? 'horizontal' : 'vertical'
					];
				return (
					<button
						data-export-ignore='true'
						key={handle}
						type='button'
						aria-label={t('pptx.selectionOverlay.resize', { handle })}
						data-pptx-handle-kind='resize'
						data-pptx-compact
						className={cn(
							'absolute z-10 group border-0 bg-transparent p-0',
							RESIZE_DEFAULT_CLASSES,
							posClass,
							cursor,
						)}
						style={{ ...resizeStyle, ...styles.frame }}
						onPointerDown={(e) => handleResizePointer(e, handle)}
						onMouseDown={(e) => {
							e.stopPropagation();
							onResizePointerDown(elementId, e, handle);
						}}
					>
						<div
							data-pptx-handle-artwork
							aria-hidden='true'
							className='border shadow'
							style={styles.artwork}
						/>
						{/* Invisible expanded hit area */}
						<div
							data-pptx-handle-hit
							className={cn(
								'absolute max-md:-inset-1 pointer-events-auto max-md:[--pptx-handle-hit-inset:-4px]',
								corner
									? '-inset-1.5 [--pptx-handle-hit-inset:-6px]'
									: '-inset-2 [--pptx-handle-hit-inset:-8px]',
							)}
							style={getResizeHandleHitAreaStyle(handle)}
						/>
					</button>
				);
			})}

			{/* Rotate is separate from the North resize target. The placement hook
			    keeps its complete pointer target inside the visible canvas. */}
			{onRotate ? (
				<button
					data-export-ignore='true'
					ref={rotateRef}
					type='button'
					aria-label={t('pptx.selectionOverlay.rotate')}
					data-pptx-handle-kind='rotate'
					data-pptx-compact
					className={cn(
						'absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 z-20 border-0 bg-transparent p-0 cursor-grab active:cursor-grabbing',
						ROTATE_DEFAULT_CLASSES,
					)}
					style={{
						...peStyle,
						...ROTATE_ARTWORK.frame,
						top: 'calc(-24px * var(--pptx-handle-inverse-scale, 1))',
					}}
					onPointerDown={(e) => {
						// Keep the same subpixel coordinates as pointermove; legacy
						// mousedown rounds them and can shift a short shape's anchor.
						e.stopPropagation();
						startRotate(e.currentTarget, e, e.pointerId);
					}}
					onMouseDown={(e) => {
						e.stopPropagation();
					}}
				>
					<RotateHandleArtwork />
				</button>
			) : null}

			{/* Shape adjustment handles (yellow diamonds), one per `a:avLst` guide.
			    Every one carries the SAME accessible name: `playwright.config.ts`
			    lists `aria-label="Adjust shape"` as part of the framework-neutral
			    contract all five viewers emit. The offsets centre the 10px diamond
			    on the element-local point shared measured off the preset geometry. */}
			{adjustmentHandles.map((adjH) => (
				<button
					data-export-ignore='true'
					key={adjH.key}
					type='button'
					aria-label={t('pptx.canvas.adjustShape')}
					data-pptx-adjust-key={adjH.key}
					data-pptx-handle-kind='adjust'
					data-pptx-compact
					className='absolute h-2.5 w-2.5 max-md:h-4 max-md:w-4 rotate-45 border border-amber-700 bg-amber-300 shadow z-10'
					style={{
						left: adjH.left - 5,
						top: adjH.top - 5,
						cursor: adjH.cursor,
						...HANDLE_TOUCH_ACTION,
						...(forcePointerEvents ? { pointerEvents: 'auto' as const } : {}),
					}}
					onPointerDown={(e) => {
						if (e.pointerType === 'mouse') {
							return;
						}
						e.stopPropagation();
						(e.currentTarget as Element).setPointerCapture?.(e.pointerId);
						onAdjustmentPointerDown(elementId, e, adjH);
					}}
					onMouseDown={(e) => {
						e.stopPropagation();
						onAdjustmentPointerDown(elementId, e, adjH);
					}}
				/>
			))}
		</>
	);
}
