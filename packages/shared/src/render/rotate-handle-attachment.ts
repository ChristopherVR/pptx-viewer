import {
	rotateHandleAncestors,
	rotateHandleClipBounds,
	rotateHandleHitRect,
	rotateHandleParentMatrix,
} from './rotate-handle-dom';
import { resolveRotateHandlePlacement } from './rotate-handle-placement';

export interface RotateHandlePlacementOptions {
	/** Angular's control is stage-local; the other bindings use its parent box. */
	getSelectionElement?: () => HTMLElement | null;
	getObstacleRoot?: () => HTMLElement | null;
	/** Omit for bindings without a stem. */
	stem?: HTMLElement | null;
}

/**
 * Keep Rotate reachable within its existing clip hierarchy. This owns only
 * the knob's individual translate and (when displaced) the stem's visibility.
 * No slide geometry, overflow, gesture anchor or export data is modified.
 */
export function attachRotateHandlePlacement(
	button: HTMLElement,
	options: RotateHandlePlacementOptions = {},
): () => void {
	const win = button.ownerDocument.defaultView;
	if (!win) {
		return () => {};
	}
	const ancestors = rotateHandleAncestors(button);
	const originalTranslate = button.style.translate;
	const computedTranslate = win.getComputedStyle(button).translate;
	const [baseX = '0px', baseY = '0px'] =
		computedTranslate && computedTranslate !== 'none' ? computedTranslate.split(' ') : [];
	const stem = options.stem;
	const originalVisibility = stem?.style.visibility ?? '';
	let writtenTranslate: string | undefined;
	let writtenVisibility: string | undefined;
	let offset = { x: 0, y: 0 };
	let dragPointer: number | undefined;
	let disposed = false;
	let frame: number | undefined;
	const observed = new WeakSet<HTMLElement>();
	const observeControl = (node: HTMLElement): void => {
		if (!observed.has(node)) {
			observed.add(node);
			mutations.observe(node, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
		}
	};
	const update = (): void => {
		frame = undefined;
		if (disposed || dragPointer !== undefined || !button.isConnected) {
			return;
		}
		const selection = options.getSelectionElement
			? options.getSelectionElement()
			: button.parentElement;
		const obstacleRoot = options.getObstacleRoot ? options.getObstacleRoot() : button.parentElement;
		if (!selection || !obstacleRoot || !selection.isConnected || button.hidden) {
			return;
		}
		observeControl(selection);
		const rect = selection.getBoundingClientRect();
		const hit = rotateHandleHitRect(button);
		if (rect.width <= 0 || rect.height <= 0 || hit.right <= hit.left || hit.bottom <= hit.top) {
			return;
		}
		const matrix = rotateHandleParentMatrix(button, ancestors);
		if (!matrix) {
			return;
		}
		// A framework may replace its inline style attribute on a geometry update.
		if (writtenTranslate !== undefined && button.style.translate !== writtenTranslate) {
			offset = { x: 0, y: 0 };
			writtenTranslate = undefined;
		}
		const preferred = {
			x: (hit.left + hit.right) / 2 - matrix.a * offset.x - matrix.c * offset.y,
			y: (hit.top + hit.bottom) / 2 - matrix.b * offset.x - matrix.d * offset.y,
		};
		const obstacles = Array.from(
			obstacleRoot.querySelectorAll<HTMLElement>(
				'[data-pptx-handle-kind="resize"], [data-pptx-handle-kind="adjust"]',
			),
		)
			.map((node) => {
				observeControl(node);
				return node;
			})
			.filter((node) => !node.hidden && win.getComputedStyle(node).display !== 'none')
			.map(rotateHandleHitRect);
		const placement = resolveRotateHandlePlacement({
			preferred,
			selection: rect,
			bounds: rotateHandleClipBounds(button, ancestors),
			hitWidth: hit.right - hit.left,
			hitHeight: hit.bottom - hit.top,
			obstacles,
		});
		const inverse = matrix.inverse();
		const dx = placement ? placement.x - preferred.x : 0;
		const dy = placement ? placement.y - preferred.y : 0;
		const x = inverse.a * dx + inverse.c * dy;
		const y = inverse.b * dx + inverse.d * dy;
		const displaced = Math.abs(x) > 0.01 || Math.abs(y) > 0.01;
		const nextOffset = displaced ? { x, y } : { x: 0, y: 0 };
		// Browser layout quantizes fractional pixels. Ignore subpixel feedback
		// below a quarter screen pixel rather than creating an observer/rAF loop.
		const changed =
			Math.hypot(
				matrix.a * (nextOffset.x - offset.x) + matrix.c * (nextOffset.y - offset.y),
				matrix.b * (nextOffset.x - offset.x) + matrix.d * (nextOffset.y - offset.y),
			) > 0.25;
		const translate = displaced
			? `calc(${baseX} + ${x}px) calc(${baseY} + ${y}px)`
			: originalTranslate;
		if ((changed || writtenTranslate === undefined) && button.style.translate !== translate) {
			button.style.translate = translate;
			writtenTranslate = button.style.translate;
			offset = nextOffset;
		}
		if (stem) {
			const visibility = displaced ? 'hidden' : originalVisibility;
			if (stem.style.visibility !== visibility) {
				stem.style.visibility = visibility;
				writtenVisibility = visibility;
			}
		}
	};
	const schedule = (): void => {
		if (!disposed && frame === undefined) {
			frame = win.requestAnimationFrame(update);
		}
	};
	const start = (event: PointerEvent): void => {
		if (dragPointer === undefined) {
			dragPointer = event.pointerId;
		}
	};
	const end = (event: PointerEvent): void => {
		if (event.pointerId === dragPointer) {
			dragPointer = undefined;
			schedule();
		}
	};
	const resize = new win.ResizeObserver(schedule);
	for (const node of [button, ...ancestors, options.getSelectionElement?.()].filter(
		(candidate): candidate is HTMLElement => Boolean(candidate),
	)) {
		resize.observe(node);
	}
	const mutations = new win.MutationObserver(schedule);
	for (const node of ancestors) {
		mutations.observe(node, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
	}
	const controls = options.getObstacleRoot ? options.getObstacleRoot() : button.parentElement;
	if (controls) {
		// Observing a node again replaces its previous options. Keep geometry
		// attributes and control insertions together, including stage-local hosts.
		mutations.observe(controls, {
			attributes: true,
			attributeFilter: ['style', 'class', 'hidden'],
			childList: true,
		});
		observed.add(controls);
		for (const control of [
			button,
			...controls.querySelectorAll<HTMLElement>('[data-pptx-handle-kind]'),
		]) {
			observeControl(control);
		}
	}
	const selection = options.getSelectionElement?.();
	if (selection) {
		observeControl(selection);
	}
	button.addEventListener('pointerdown', start, true);
	win.addEventListener('pointerup', end, true);
	win.addEventListener('pointercancel', end, true);
	win.addEventListener('scroll', schedule, true);
	win.addEventListener('resize', schedule);
	update();
	return () => {
		if (disposed) {
			return;
		}
		disposed = true;
		if (frame !== undefined) {
			win.cancelAnimationFrame(frame);
		}
		resize.disconnect();
		mutations.disconnect();
		button.removeEventListener('pointerdown', start, true);
		win.removeEventListener('pointerup', end, true);
		win.removeEventListener('pointercancel', end, true);
		win.removeEventListener('scroll', schedule, true);
		win.removeEventListener('resize', schedule);
		if (writtenTranslate !== undefined && button.style.translate === writtenTranslate) {
			button.style.translate = originalTranslate;
		}
		if (stem && writtenVisibility !== undefined && stem.style.visibility === writtenVisibility) {
			stem.style.visibility = originalVisibility;
		}
	};
}
