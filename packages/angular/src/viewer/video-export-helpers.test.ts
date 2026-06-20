/**
 * Unit tests for video-export-helpers.ts (Angular viewer).
 *
 * Tests cover all pure, browser-free helpers:
 *   - planVideoSegments
 *   - pickSupportedMimeType
 *   - fpsToFrameIntervalMs
 *   - segmentFrameCount
 *
 * `recordWebm` drives MediaRecorder and a live canvas; those integration
 * tests belong in an e2e suite and are not included here.
 */

import { describe, expect, it, vi } from 'vitest';

import {
	WEBM_MIME_CANDIDATES,
	fpsToFrameIntervalMs,
	pickSupportedMimeType,
	planVideoSegments,
	segmentFrameCount,
} from './video-export-helpers';

/* ================================================================== */
/*  planVideoSegments                                                  */
/* ================================================================== */

describe('planVideoSegments', () => {
	it('returns one plan per slide in order', () => {
		const plans = planVideoSegments({ totalSlides: 3 });
		expect(plans).toHaveLength(3);
		expect(plans[0].slideIndex).toBe(0);
		expect(plans[1].slideIndex).toBe(1);
		expect(plans[2].slideIndex).toBe(2);
	});

	it('uses default slideDurationMs of 3000 ms', () => {
		const plans = planVideoSegments({ totalSlides: 2 });
		expect(plans[0].durationMs).toBe(3000);
		expect(plans[1].durationMs).toBe(3000);
	});

	it('uses a custom slideDurationMs', () => {
		const plans = planVideoSegments({ totalSlides: 1, slideDurationMs: 5000 });
		expect(plans[0].durationMs).toBe(5000);
	});

	it('applies per-slide timing overrides', () => {
		const plans = planVideoSegments({
			totalSlides: 3,
			slideDurationMs: 2000,
			slideTimingsMs: [1000, undefined as unknown as number, 4000],
		});
		expect(plans[0].durationMs).toBe(1000);
		expect(plans[1].durationMs).toBe(2000);
		expect(plans[2].durationMs).toBe(4000);
	});

	it('stores fps on each plan', () => {
		const plans = planVideoSegments({ totalSlides: 1, fps: 60 });
		expect(plans[0].fps).toBe(60);
	});

	it('uses default fps of 30', () => {
		const plans = planVideoSegments({ totalSlides: 1 });
		expect(plans[0].fps).toBe(30);
	});

	it('computes frameCount correctly (3000 ms at 30 fps = 90 frames)', () => {
		const plans = planVideoSegments({ totalSlides: 1, slideDurationMs: 3000, fps: 30 });
		// 3000 / (1000/30) = 3000 / 33.33… = 90
		expect(plans[0].frameCount).toBe(90);
	});

	it('rounds fractional frame counts up (ceil)', () => {
		// 100 ms at 30 fps → 100 / 33.33 ≈ 3.0, ceil = 3
		const plans = planVideoSegments({ totalSlides: 1, slideDurationMs: 100, fps: 30 });
		expect(plans[0].frameCount).toBeGreaterThanOrEqual(3);
	});

	it('ensures frameCount is at least 1 for very short durations', () => {
		const plans = planVideoSegments({ totalSlides: 1, slideDurationMs: 1, fps: 30 });
		expect(plans[0].frameCount).toBeGreaterThanOrEqual(1);
	});

	it('returns an empty array for totalSlides = 0', () => {
		expect(planVideoSegments({ totalSlides: 0 })).toHaveLength(0);
	});
});

/* ================================================================== */
/*  fpsToFrameIntervalMs                                               */
/* ================================================================== */

describe('fpsToFrameIntervalMs', () => {
	it('returns 1000/30 ≈ 33.33 ms for 30 fps', () => {
		expect(fpsToFrameIntervalMs(30)).toBeCloseTo(33.333, 2);
	});

	it('returns 1000 ms for 1 fps', () => {
		expect(fpsToFrameIntervalMs(1)).toBe(1000);
	});

	it('returns 1000/60 ≈ 16.67 ms for 60 fps', () => {
		expect(fpsToFrameIntervalMs(60)).toBeCloseTo(16.667, 2);
	});

	it('returns 1000/24 ≈ 41.67 ms for 24 fps', () => {
		expect(fpsToFrameIntervalMs(24)).toBeCloseTo(41.667, 2);
	});

	it('throws a RangeError for fps ≤ 0', () => {
		expect(() => fpsToFrameIntervalMs(0)).toThrow(RangeError);
		expect(() => fpsToFrameIntervalMs(-1)).toThrow(RangeError);
	});
});

/* ================================================================== */
/*  segmentFrameCount                                                  */
/* ================================================================== */

describe('segmentFrameCount', () => {
	it('returns 90 for 3000 ms at 30 fps', () => {
		expect(segmentFrameCount(3000, 30)).toBe(90);
	});

	it('returns 1 for 0 ms (minimum clamp)', () => {
		expect(segmentFrameCount(0, 30)).toBe(1);
	});

	it('rounds up non-integer frame counts', () => {
		// 50 ms at 30 fps → 50 / 33.33 ≈ 1.5 → ceil = 2
		expect(segmentFrameCount(50, 30)).toBe(2);
	});

	it('returns 1 for very short durations', () => {
		expect(segmentFrameCount(1, 30)).toBe(1);
	});

	it('works for 60 fps', () => {
		// 1000 ms at 60 fps → 60 frames
		expect(segmentFrameCount(1000, 60)).toBe(60);
	});

	it('throws a RangeError for fps ≤ 0', () => {
		expect(() => segmentFrameCount(1000, 0)).toThrow(RangeError);
		expect(() => segmentFrameCount(1000, -5)).toThrow(RangeError);
	});

	it('handles large durations', () => {
		// 60000 ms at 30 fps = 1800 frames
		expect(segmentFrameCount(60000, 30)).toBe(1800);
	});
});

/* ================================================================== */
/*  pickSupportedMimeType                                              */
/* ================================================================== */

describe('pickSupportedMimeType', () => {
	it('throws when candidates is empty', () => {
		expect(() => pickSupportedMimeType([])).toThrow();
	});

	it('returns the first supported MIME type', () => {
		const isTypeSupported = vi.fn((mime: string) => mime === 'video/webm;codecs=vp9');
		vi.stubGlobal('MediaRecorder', { isTypeSupported });

		const result = pickSupportedMimeType([
			'video/webm;codecs=vp9',
			'video/webm;codecs=vp8',
			'video/webm',
		]);
		expect(result).toBe('video/webm;codecs=vp9');

		vi.unstubAllGlobals();
	});

	it('skips unsupported types and returns the first supported one', () => {
		const isTypeSupported = vi.fn((mime: string) => mime === 'video/webm;codecs=vp8');
		vi.stubGlobal('MediaRecorder', { isTypeSupported });

		const result = pickSupportedMimeType([
			'video/webm;codecs=vp9',
			'video/webm;codecs=vp8',
			'video/webm',
		]);
		expect(result).toBe('video/webm;codecs=vp8');

		vi.unstubAllGlobals();
	});

	it('falls back to the last candidate when none is supported', () => {
		const isTypeSupported = vi.fn(() => false);
		vi.stubGlobal('MediaRecorder', { isTypeSupported });

		const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
		const result = pickSupportedMimeType(candidates);
		expect(result).toBe('video/webm');

		vi.unstubAllGlobals();
	});

	it('returns the first candidate when MediaRecorder is not available (SSR)', () => {
		// Remove MediaRecorder from global scope
		const original = (globalThis as Record<string, unknown>)['MediaRecorder'];
		delete (globalThis as Record<string, unknown>)['MediaRecorder'];

		const result = pickSupportedMimeType(['video/webm;codecs=vp9', 'video/webm']);
		expect(result).toBe('video/webm;codecs=vp9');

		// Restore
		if (original !== undefined) {
			(globalThis as Record<string, unknown>)['MediaRecorder'] = original;
		}
	});

	it('returns a single candidate unchanged when it is supported', () => {
		const isTypeSupported = vi.fn(() => true);
		vi.stubGlobal('MediaRecorder', { isTypeSupported });

		expect(pickSupportedMimeType(['video/webm'])).toBe('video/webm');
		vi.unstubAllGlobals();
	});
});

/* ================================================================== */
/*  WEBM_MIME_CANDIDATES constant                                      */
/* ================================================================== */

describe('webm mime candidates', () => {
	it('is a non-empty readonly array', () => {
		expect(WEBM_MIME_CANDIDATES.length).toBeGreaterThan(0);
	});

	it('leads with the vp9 codec variant', () => {
		expect(WEBM_MIME_CANDIDATES[0]).toBe('video/webm;codecs=vp9');
	});

	it('includes a bare video/webm fallback', () => {
		expect(WEBM_MIME_CANDIDATES).toContain('video/webm');
	});
});
