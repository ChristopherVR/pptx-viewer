/**
 * Unit tests for the shared GIF/video capture decision function: every
 * binding's GIF and video export should compute its capture scale and
 * post-capture cap from this, instead of a per-binding fixed value.
 */

import { describe, expect, it } from 'vitest';

import { resolveExportCaptureDecision } from './export-capture-decision';
import { GIF_POST_CAPTURE_MAX_SIDE } from './gif-encoder';

describe('resolveExportCaptureDecision', () => {
	it('scales GIF capture by 2x the resolved image-resolution multiplier', () => {
		expect(resolveExportCaptureDecision(1, 'gif').scale).toBe(2);
		expect(resolveExportCaptureDecision(330 / 96, 'gif').scale).toBeCloseTo((2 * 330) / 96);
	});

	it('scales video capture by 2x the resolved image-resolution multiplier', () => {
		expect(resolveExportCaptureDecision(1, 'video').scale).toBe(2);
		expect(resolveExportCaptureDecision(0.25, 'video').scale).toBeCloseTo(0.5);
	});

	it('returns the shared post-capture cap for GIF', () => {
		expect(resolveExportCaptureDecision(1, 'gif').postCaptureMaxSide).toBe(
			GIF_POST_CAPTURE_MAX_SIDE,
		);
	});

	it('applies the same GIF cap regardless of the resolution multiplier', () => {
		expect(resolveExportCaptureDecision(4, 'gif').postCaptureMaxSide).toBe(
			GIF_POST_CAPTURE_MAX_SIDE,
		);
		expect(resolveExportCaptureDecision(0.25, 'gif').postCaptureMaxSide).toBe(
			GIF_POST_CAPTURE_MAX_SIDE,
		);
	});

	it('has no post-capture cap for video', () => {
		expect(resolveExportCaptureDecision(1, 'video').postCaptureMaxSide).toBeUndefined();
		expect(resolveExportCaptureDecision(4, 'video').postCaptureMaxSide).toBeUndefined();
	});
});
