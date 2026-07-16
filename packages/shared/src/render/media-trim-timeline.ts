export type MediaTrimHandle = 'start' | 'end';

export interface MediaTimelineGeometry {
	startPercent: number;
	endPercent: number;
	playheadPercent: number;
}

export interface MediaTrimRange {
	trimStartMs: number;
	trimEndMs: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

export function formatMediaTime(seconds: number): string {
	const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
	const totalTenths = Math.round(safeSeconds * 10);
	const minutes = Math.floor(totalTenths / 600);
	const wholeSeconds = Math.floor((totalTenths % 600) / 10);
	const tenths = totalTenths % 10;
	return `${minutes}:${String(wholeSeconds).padStart(2, '0')}.${tenths}`;
}

export function mediaTimeFromPointer(
	clientX: number,
	barLeft: number,
	barWidth: number,
	durationSeconds: number,
): number {
	if (barWidth <= 0 || durationSeconds <= 0) {
		return 0;
	}
	return clamp((clientX - barLeft) / barWidth, 0, 1) * durationSeconds;
}

export function mediaTimelineGeometry(
	durationSeconds: number,
	trimStartMs: number,
	trimEndMs: number,
	currentTimeSeconds: number,
): MediaTimelineGeometry {
	const duration = durationSeconds > 0 ? durationSeconds : 1;
	const startSeconds = clamp(trimStartMs / 1000, 0, duration);
	const requestedEnd = trimEndMs > 0 ? trimEndMs / 1000 : duration;
	const endSeconds = clamp(requestedEnd, startSeconds, duration);
	return {
		startPercent: (startSeconds / duration) * 100,
		endPercent: (endSeconds / duration) * 100,
		playheadPercent: clamp((currentTimeSeconds / duration) * 100, 0, 100),
	};
}

export function mediaTrimRangeForDrag(
	handle: MediaTrimHandle,
	pointerTimeSeconds: number,
	durationSeconds: number,
	trimStartMs: number,
	trimEndMs: number,
	minimumGapSeconds = 0.1,
): MediaTrimRange {
	const duration = Math.max(0, durationSeconds);
	const startSeconds = clamp(trimStartMs / 1000, 0, duration);
	const endSeconds = trimEndMs > 0 ? clamp(trimEndMs / 1000, 0, duration) : duration;
	if (handle === 'start') {
		const latestStart = Math.max(0, endSeconds - minimumGapSeconds);
		return {
			trimStartMs: clamp(pointerTimeSeconds, 0, latestStart) * 1000,
			trimEndMs,
		};
	}
	const earliestEnd = Math.min(duration, startSeconds + minimumGapSeconds);
	return {
		trimStartMs,
		trimEndMs: clamp(pointerTimeSeconds, earliestEnd, duration) * 1000,
	};
}
