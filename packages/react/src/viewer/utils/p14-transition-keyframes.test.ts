import { describe, it, expect } from 'vitest';
import { P14_TRANSITION_KEYFRAMES } from './p14-transition-keyframes';
import { P14_TRANSITION_KEYFRAMES_2 } from './p14-transition-keyframes-2';

describe('P14_TRANSITION_KEYFRAMES', () => {
	it('should be a non-empty string', () => {
		expect(typeof P14_TRANSITION_KEYFRAMES).toBe('string');
		expect(P14_TRANSITION_KEYFRAMES.length).toBeGreaterThan(0);
	});

	it('should contain conveyor keyframes', () => {
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-conveyor-in-from-right');
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-conveyor-out-to-left');
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-conveyor-in-from-left');
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-conveyor-out-to-right');
	});

	it('should contain doors keyframes', () => {
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-doors-horz');
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-doors-vert');
	});

	it('should contain ferris keyframes', () => {
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-ferris-in-from-right');
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-ferris-out-to-left');
	});

	it('should contain flash keyframes', () => {
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-flash-white');
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-flash-in');
	});

	it('should contain flythrough keyframes', () => {
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-flythrough-in');
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-flythrough-out');
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-flythrough-reverse-in');
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-flythrough-reverse-out');
	});

	it('should contain gallery keyframes', () => {
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-gallery-in-from-right');
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-gallery-out-to-left');
	});

	it('should contain glitter keyframes', () => {
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-glitter-in');
	});

	it('should contain honeycomb keyframes', () => {
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-honeycomb-in');
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-honeycomb-out');
	});

	it('should contain pan keyframes for all directions', () => {
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-pan-from-right');
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-pan-to-left');
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-pan-from-left');
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-pan-to-right');
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-pan-from-bottom');
		expect(P14_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-pan-to-top');
	});
});

describe('P14_TRANSITION_KEYFRAMES_2', () => {
	it('should be a non-empty string', () => {
		expect(typeof P14_TRANSITION_KEYFRAMES_2).toBe('string');
		expect(P14_TRANSITION_KEYFRAMES_2.length).toBeGreaterThan(0);
	});

	it('should contain prism keyframes', () => {
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-prism-in-from-right');
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-prism-out-to-left');
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-prism-in-from-bottom');
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-prism-out-to-top');
	});

	it('should contain reveal keyframes', () => {
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-reveal-out-to-right');
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-reveal-out-to-left');
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-reveal-in');
	});

	it('should contain ripple keyframes', () => {
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-ripple-in');
	});

	it('should contain shred keyframes', () => {
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-shred-strips-in');
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-shred-rectangles-in');
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-shred-out');
	});

	it('should contain switch keyframes', () => {
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-switch-in-from-right');
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-switch-out-to-left');
	});

	it('should contain vortex keyframes', () => {
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-vortex-in');
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-vortex-out');
	});

	it('should contain warp keyframes', () => {
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-warp-in');
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-warp-out');
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-warp-reverse-in');
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-warp-reverse-out');
	});

	it('should contain wheelReverse keyframes', () => {
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-wheel-reverse-in');
	});

	it('should contain window keyframes', () => {
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-window-horz');
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-window-vert');
		expect(P14_TRANSITION_KEYFRAMES_2).toContain('@keyframes pptx-tr-window-out');
	});
});
