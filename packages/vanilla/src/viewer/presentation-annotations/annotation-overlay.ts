import {
	annotationOverlayZIndex,
	appendPresentationInkPoint,
	cursorForTool,
	erasePresentationInkAt,
	presentationInkPath,
} from 'pptx-viewer-shared';
import type {
	PresentationBlackout,
	PresentationInkPoint,
	PresentationInkStroke,
	PresentationPointerTool,
} from 'pptx-viewer-shared';

export interface AnnotationOverlayOptions {
	stageWrap: HTMLElement;
	slideIndex: number;
	tool: PresentationPointerTool;
	color: string;
	/**
	 * Current blackout state: decides the overlay's stacking level via the
	 * shared `annotationOverlayZIndex` rule (above the blackout sheet while the
	 * screen is blanked, just above the slide otherwise).
	 */
	blackout: PresentationBlackout;
	strokes: readonly PresentationInkStroke[];
	onChange(strokes: PresentationInkStroke[]): void;
	onPointerMove?(point: PresentationInkPoint): void;
}

const PEN_WIDTH = 2.5;
const HIGHLIGHTER_WIDTH = 14;

function eventPoint(svg: SVGSVGElement, event: PointerEvent): PresentationInkPoint {
	const rect = svg.getBoundingClientRect();
	return {
		x: Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(rect.width, 1))),
		y: Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(rect.height, 1))),
	};
}

function createPath(doc: Document, stroke: PresentationInkStroke): SVGPathElement {
	const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
	path.setAttribute('d', presentationInkPath(stroke.points));
	path.setAttribute('fill', 'none');
	path.setAttribute('stroke', stroke.color);
	path.setAttribute('stroke-width', String(stroke.width));
	path.setAttribute('stroke-linecap', 'round');
	path.setAttribute('stroke-linejoin', 'round');
	path.setAttribute('vector-effect', 'non-scaling-stroke');
	path.setAttribute('opacity', stroke.tool === 'highlighter' ? '0.4' : '1');
	return path;
}

/** Mount the presentation ink capture layer. Call again after each stage rebuild. */
export function mountAnnotationOverlay(options: AnnotationOverlayOptions): () => void {
	const { stageWrap, slideIndex, tool } = options;
	stageWrap.querySelector('.pptxv-presentation-annotations')?.remove();
	if (tool === 'none') {
		return () => undefined;
	}

	const doc = stageWrap.ownerDocument;
	const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.classList.add('pptxv-presentation-annotations');
	svg.setAttribute('viewBox', '0 0 100 100');
	svg.setAttribute('preserveAspectRatio', 'none');
	svg.setAttribute('aria-label', 'Presentation annotations');
	// E2E contract: the element carrying the shared annotation-overlay z-index.
	svg.setAttribute('data-pptx-annotation-overlay', '');
	Object.assign(svg.style, {
		position: 'absolute',
		inset: '0',
		zIndex: String(annotationOverlayZIndex(options.blackout)),
		width: '100%',
		height: '100%',
		cursor: cursorForTool(tool),
		touchAction: 'none',
	});
	let strokes = [...options.strokes];
	let current: PresentationInkStroke | null = null;
	let activePointer: number | null = null;
	const laser = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
	laser.setAttribute('r', '10');
	laser.setAttribute('fill', '#ef4444');
	laser.setAttribute('vector-effect', 'non-scaling-stroke');
	laser.style.filter = 'drop-shadow(0 0 8px #ef4444)';
	laser.style.display = 'none';

	const render = (): void => {
		svg.replaceChildren(
			...strokes
				.filter((stroke) => stroke.slideIndex === slideIndex)
				.map((stroke) => createPath(doc, stroke)),
		);
		if (current) {
			svg.append(createPath(doc, current));
		}
		if (tool === 'laser') {
			svg.append(laser);
		}
	};
	const publish = (next: PresentationInkStroke[]): void => {
		strokes = next;
		options.onChange(next);
		render();
	};
	const onDown = (event: PointerEvent): void => {
		event.preventDefault();
		event.stopPropagation();
		const point = eventPoint(svg, event);
		activePointer = event.pointerId;
		svg.setPointerCapture?.(event.pointerId);
		if (tool === 'eraser') {
			publish(erasePresentationInkAt(strokes, slideIndex, point));
			return;
		}
		if (tool === 'pen' || tool === 'highlighter') {
			current = {
				id: `presentation-ink-${crypto.randomUUID()}`,
				slideIndex,
				tool,
				color: tool === 'highlighter' && options.color === '#ef4444' ? '#fde047' : options.color,
				width: tool === 'highlighter' ? HIGHLIGHTER_WIDTH : PEN_WIDTH,
				points: [point],
			};
			render();
		}
	};
	const onMove = (event: PointerEvent): void => {
		const point = eventPoint(svg, event);
		options.onPointerMove?.(point);
		if (tool === 'laser') {
			laser.setAttribute('cx', String(point.x * 100));
			laser.setAttribute('cy', String(point.y * 100));
			laser.style.display = '';
			return;
		}
		if (activePointer !== event.pointerId) {
			return;
		}
		if (tool === 'eraser') {
			publish(erasePresentationInkAt(strokes, slideIndex, point));
		} else if (current) {
			current = appendPresentationInkPoint(current, point);
			render();
		}
	};
	const finish = (): void => {
		activePointer = null;
		if (current?.points.length && current.points.length > 1) {
			publish([...strokes, current]);
		}
		current = null;
		render();
	};
	const onLeave = (): void => {
		laser.style.display = 'none';
		finish();
	};
	svg.addEventListener('pointerdown', onDown);
	svg.addEventListener('pointermove', onMove);
	svg.addEventListener('pointerup', finish);
	svg.addEventListener('pointercancel', finish);
	svg.addEventListener('pointerleave', onLeave);
	stageWrap.append(svg);
	render();
	return () => svg.remove();
}
