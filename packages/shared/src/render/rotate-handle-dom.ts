import type { HandlePlacementRect } from './rotate-handle-placement';

/** The full interactive rectangle includes an explicitly marked hit extension. */
export function rotateHandleHitRect(element: HTMLElement): HandlePlacementRect {
	const rects = [element, ...element.querySelectorAll<HTMLElement>('[data-pptx-handle-hit]')].map(
		(node) => node.getBoundingClientRect(),
	);
	return {
		left: Math.min(...rects.map((rect) => rect.left)),
		right: Math.max(...rects.map((rect) => rect.right)),
		top: Math.min(...rects.map((rect) => rect.top)),
		bottom: Math.max(...rects.map((rect) => rect.bottom)),
	};
}

export function rotateHandleAncestors(button: HTMLElement): HTMLElement[] {
	const ancestors: HTMLElement[] = [];
	for (let node = button.parentElement; node; node = node.parentElement) {
		ancestors.push(node);
	}
	return ancestors;
}

/** Rectangular overflow clips are intersected without changing slide layout. */
export function rotateHandleClipBounds(
	button: HTMLElement,
	ancestors: HTMLElement[],
): HandlePlacementRect {
	const win = button.ownerDocument.defaultView!;
	const bounds = { left: 0, top: 0, right: win.innerWidth, bottom: win.innerHeight };
	for (const node of ancestors) {
		const style = win.getComputedStyle(node);
		const clipX = /hidden|clip|auto|scroll/.test(style.overflowX || style.overflow);
		const clipY = /hidden|clip|auto|scroll/.test(style.overflowY || style.overflow);
		if (!clipX && !clipY) {
			continue;
		}
		const rect = node.getBoundingClientRect();
		const scaleX = node.offsetWidth ? rect.width / node.offsetWidth : 1;
		const scaleY = node.offsetHeight ? rect.height / node.offsetHeight : 1;
		const left = rect.left + node.clientLeft * scaleX;
		const top = rect.top + node.clientTop * scaleY;
		if (clipX) {
			bounds.left = Math.max(bounds.left, left);
			bounds.right = Math.min(bounds.right, left + node.clientWidth * scaleX);
		}
		if (clipY) {
			bounds.top = Math.max(bounds.top, top);
			bounds.bottom = Math.min(bounds.bottom, top + node.clientHeight * scaleY);
		}
	}
	return bounds;
}

/** Map a parent-local displacement to the screen (translations are irrelevant). */
export function rotateHandleParentMatrix(
	button: HTMLElement,
	ancestors: HTMLElement[],
): DOMMatrix | null {
	const win = button.ownerDocument.defaultView!;
	if (!win.DOMMatrix) {
		return null;
	}
	let matrix = new win.DOMMatrix();
	for (const node of ancestors) {
		const style = win.getComputedStyle(node);
		let transform: DOMMatrix;
		try {
			transform = new win.DOMMatrix(
				style.transform === 'none' ? undefined : style.transform || undefined,
			);
		} catch {
			return null;
		}
		if (!transform.is2D) {
			return null;
		}
		let individual = new win.DOMMatrix();
		if (style.rotate && style.rotate !== 'none') {
			// The viewer uses planar transforms, never perspective or 3D rotation.
			if (!/^[-+.\d]+(?:deg|rad|turn|grad)$/.test(style.rotate)) {
				return null;
			}
			individual = new win.DOMMatrix(`rotate(${style.rotate})`);
		}
		if (style.scale && style.scale !== 'none') {
			const [x, y = x] = style.scale.split(' ').map(Number);
			individual = individual.scale(x, y);
		}
		matrix = individual.multiply(transform).multiply(matrix);
	}
	return matrix.is2D &&
		Number.isFinite(matrix.a * matrix.d - matrix.b * matrix.c) &&
		Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) > 1e-9
		? matrix
		: null;
}
