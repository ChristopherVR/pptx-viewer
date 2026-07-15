import type {
	PresentationInkPoint,
	PresentationInkStroke,
	PresentationPointerState,
	PresentationPointerTool,
	PresentationSnapshot,
	PresentationZoomState,
} from './presentation-session';

export const PRESENTER_ZOOM_MIN = 1;
export const PRESENTER_ZOOM_MAX = 4;
export const PRESENTER_ZOOM_STEP = 0.5;

export interface PresenterTimerState {
	elapsedMs: number;
	paused: boolean;
	lastStartedAt: number;
}

export function createPresenterTimer(now = Date.now()): PresenterTimerState {
	return { elapsedMs: 0, paused: false, lastStartedAt: now };
}

export function presenterElapsed(timer: PresenterTimerState, now = Date.now()): number {
	return timer.elapsedMs + (timer.paused ? 0 : Math.max(0, now - timer.lastStartedAt));
}

export function togglePresenterTimer(
	timer: PresenterTimerState,
	now = Date.now(),
): PresenterTimerState {
	if (timer.paused) {
		return { ...timer, paused: false, lastStartedAt: now };
	}
	return { elapsedMs: presenterElapsed(timer, now), paused: true, lastStartedAt: now };
}

export function resetPresenterTimer(now = Date.now()): PresenterTimerState {
	return createPresenterTimer(now);
}

export function clampPresenterZoom(zoom: Partial<PresentationZoomState>): PresentationZoomState {
	return {
		scale: Math.min(PRESENTER_ZOOM_MAX, Math.max(PRESENTER_ZOOM_MIN, zoom.scale ?? 1)),
		originX: Math.min(1, Math.max(0, zoom.originX ?? 0.5)),
		originY: Math.min(1, Math.max(0, zoom.originY ?? 0.5)),
	};
}

export function stepPresenterZoom(
	zoom: PresentationZoomState,
	direction: 1 | -1,
): PresentationZoomState {
	return clampPresenterZoom({ ...zoom, scale: zoom.scale + direction * PRESENTER_ZOOM_STEP });
}

export function createPresenterPointer(
	tool: PresentationPointerTool = 'none',
	color = '#ef4444',
): PresentationPointerState {
	return { tool, x: 0.5, y: 0.5, color };
}

export function movePresenterPointer(
	pointer: PresentationPointerState,
	x: number,
	y: number,
): PresentationPointerState {
	return { ...pointer, x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

export function appendPresentationInkPoint(
	stroke: PresentationInkStroke,
	point: PresentationInkPoint,
): PresentationInkStroke {
	const clamped = {
		x: Math.min(1, Math.max(0, point.x)),
		y: Math.min(1, Math.max(0, point.y)),
	};
	return { ...stroke, points: [...stroke.points, clamped] };
}

export function erasePresentationInkAt(
	strokes: readonly PresentationInkStroke[],
	slideIndex: number,
	point: PresentationInkPoint,
	radius = 0.035,
): PresentationInkStroke[] {
	const radiusSquared = radius * radius;
	return strokes.filter(
		(stroke) =>
			stroke.slideIndex !== slideIndex ||
			!stroke.points.some((candidate) => {
				const dx = candidate.x - point.x;
				const dy = candidate.y - point.y;
				return dx * dx + dy * dy <= radiusSquared;
			}),
	);
}

export function mergePresentationSnapshot(
	current: PresentationSnapshot,
	patch: Partial<PresentationSnapshot>,
): PresentationSnapshot {
	return {
		...current,
		...patch,
		sequence: Math.max(current.sequence + 1, patch.sequence ?? 0),
		zoom: patch.zoom ? clampPresenterZoom(patch.zoom) : current.zoom,
	};
}

export function presentationInkPath(points: readonly PresentationInkPoint[]): string {
	if (points.length === 0) {
		return '';
	}
	return points.reduce(
		(path, point, index) => `${path}${index === 0 ? 'M' : ' L'} ${point.x * 100} ${point.y * 100}`,
		'',
	);
}
