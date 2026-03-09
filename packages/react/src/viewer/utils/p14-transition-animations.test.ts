import { describe, it, expect } from 'vitest';
import { getP14TransitionAnimations } from './p14-transition-animations';

describe('getP14TransitionAnimations', () => {
	it('should return undefined for unknown transition type', () => {
		const result = getP14TransitionAnimations('unknownType' as any, 1000, undefined);
		expect(result).toBeUndefined();
	});

	it('should return conveyor animations with left direction', () => {
		const result = getP14TransitionAnimations('conveyor', 500, 'l');
		expect(result).toBeDefined();
		expect(result!.outgoing).toContain('pptx-tr-conveyor-out-to-left');
		expect(result!.incoming).toContain('pptx-tr-conveyor-in-from-right');
		expect(result!.outgoingOnTop).toBe(false);
	});

	it('should return conveyor animations with right direction', () => {
		const result = getP14TransitionAnimations('conveyor', 500, 'r');
		expect(result).toBeDefined();
		expect(result!.outgoing).toContain('pptx-tr-conveyor-out-to-right');
		expect(result!.incoming).toContain('pptx-tr-conveyor-in-from-left');
	});

	it('should default conveyor to left when direction is undefined', () => {
		const result = getP14TransitionAnimations('conveyor', 500, undefined);
		expect(result).toBeDefined();
		expect(result!.outgoing).toContain('to-left');
	});

	it('should return doors animations with horizontal orientation', () => {
		const result = getP14TransitionAnimations('doors', 800, 'horz');
		expect(result).toBeDefined();
		expect(result!.incoming).toContain('pptx-tr-doors-horz');
		expect(result!.outgoing).toBe('none');
	});

	it('should return doors animations with vertical orientation', () => {
		const result = getP14TransitionAnimations('doors', 800, 'vert');
		expect(result).toBeDefined();
		expect(result!.incoming).toContain('pptx-tr-doors-vert');
	});

	it('should return ferris animations with left direction', () => {
		const result = getP14TransitionAnimations('ferris', 700, 'l');
		expect(result).toBeDefined();
		expect(result!.outgoing).toContain('pptx-tr-ferris-out-to-left');
		expect(result!.incoming).toContain('pptx-tr-ferris-in-from-right');
	});

	it('should return flash animation with outgoingOnTop true', () => {
		const result = getP14TransitionAnimations('flash', 600, undefined);
		expect(result).toBeDefined();
		expect(result!.outgoingOnTop).toBe(true);
		expect(result!.outgoing).toContain('pptx-tr-flash-white');
		expect(result!.incoming).toContain('pptx-tr-flash-in');
	});

	it('should return flythrough forward animation', () => {
		const result = getP14TransitionAnimations('flythrough', 1000, 'in');
		expect(result).toBeDefined();
		expect(result!.outgoing).toContain('pptx-tr-flythrough-out');
		expect(result!.incoming).toContain('pptx-tr-flythrough-in');
		expect(result!.outgoingOnTop).toBe(true);
	});

	it('should return flythrough reverse animation when direction is "out"', () => {
		const result = getP14TransitionAnimations('flythrough', 1000, 'out');
		expect(result).toBeDefined();
		expect(result!.outgoing).toContain('pptx-tr-flythrough-reverse-out');
		expect(result!.incoming).toContain('pptx-tr-flythrough-reverse-in');
	});

	it('should return gallery animations', () => {
		const result = getP14TransitionAnimations('gallery', 800, 'l');
		expect(result).toBeDefined();
		expect(result!.outgoing).toContain('pptx-tr-gallery-out-to-left');
		expect(result!.incoming).toContain('pptx-tr-gallery-in-from-right');
	});

	it('should return glitter animation', () => {
		const result = getP14TransitionAnimations('glitter', 600, undefined);
		expect(result).toBeDefined();
		expect(result!.outgoingOnTop).toBe(true);
		expect(result!.incoming).toContain('pptx-tr-glitter-in');
	});

	it('should return honeycomb animation', () => {
		const result = getP14TransitionAnimations('honeycomb', 700, undefined);
		expect(result).toBeDefined();
		expect(result!.outgoing).toContain('pptx-tr-honeycomb-out');
		expect(result!.incoming).toContain('pptx-tr-honeycomb-in');
	});

	it('should return pan directional animation for left direction', () => {
		const result = getP14TransitionAnimations('pan', 500, 'l');
		expect(result).toBeDefined();
		expect(result!.outgoing).toContain('pptx-tr-pan-to-left');
		expect(result!.incoming).toContain('pptx-tr-pan-from-right');
	});

	it('should return pan directional animation for up direction', () => {
		const result = getP14TransitionAnimations('pan', 500, 'u');
		expect(result).toBeDefined();
		expect(result!.outgoing).toContain('pptx-tr-pan-to-top');
		expect(result!.incoming).toContain('pptx-tr-pan-from-bottom');
	});

	it('should return pan directional animation for down direction', () => {
		const result = getP14TransitionAnimations('pan', 500, 'd');
		expect(result).toBeDefined();
		expect(result!.outgoing).toContain('pptx-tr-pan-to-bottom');
		expect(result!.incoming).toContain('pptx-tr-pan-from-top');
	});

	it('should return reveal animation with left direction', () => {
		const result = getP14TransitionAnimations('reveal', 800, 'l');
		expect(result).toBeDefined();
		expect(result!.outgoing).toContain('pptx-tr-reveal-out-to-left');
		expect(result!.outgoingOnTop).toBe(true);
	});

	it('should return ripple animation with no outgoing', () => {
		const result = getP14TransitionAnimations('ripple', 600, undefined);
		expect(result).toBeDefined();
		expect(result!.outgoing).toBe('none');
		expect(result!.incoming).toContain('pptx-tr-ripple-in');
	});

	it('should return shred with strips by default', () => {
		const result = getP14TransitionAnimations('shred', 700, undefined);
		expect(result).toBeDefined();
		expect(result!.incoming).toContain('pptx-tr-shred-strips-in');
	});

	it('should return shred with rectangles when direction is "rectangles"', () => {
		const result = getP14TransitionAnimations('shred', 700, 'rectangles');
		expect(result).toBeDefined();
		expect(result!.incoming).toContain('pptx-tr-shred-rectangles-in');
	});

	it('should return switch animations', () => {
		const result = getP14TransitionAnimations('switch', 500, 'l');
		expect(result).toBeDefined();
		expect(result!.outgoing).toContain('pptx-tr-switch-out-to-left');
		expect(result!.incoming).toContain('pptx-tr-switch-in-from-right');
	});

	it('should return vortex animation', () => {
		const result = getP14TransitionAnimations('vortex', 1000, undefined);
		expect(result).toBeDefined();
		expect(result!.outgoing).toContain('pptx-tr-vortex-out');
		expect(result!.incoming).toContain('pptx-tr-vortex-in');
		expect(result!.outgoingOnTop).toBe(true);
	});

	it('should return warp forward animation', () => {
		const result = getP14TransitionAnimations('warp', 800, 'in');
		expect(result).toBeDefined();
		expect(result!.outgoing).toContain('pptx-tr-warp-out');
		expect(result!.incoming).toContain('pptx-tr-warp-in');
	});

	it('should return warp reverse animation when direction is "out"', () => {
		const result = getP14TransitionAnimations('warp', 800, 'out');
		expect(result).toBeDefined();
		expect(result!.outgoing).toContain('pptx-tr-warp-reverse-out');
		expect(result!.incoming).toContain('pptx-tr-warp-reverse-in');
	});

	it('should return wheelReverse animation', () => {
		const result = getP14TransitionAnimations('wheelReverse', 900, undefined);
		expect(result).toBeDefined();
		expect(result!.outgoing).toBe('none');
		expect(result!.incoming).toContain('pptx-tr-wheel-reverse-in');
	});

	it('should return window animation with horizontal orientation', () => {
		const result = getP14TransitionAnimations('window', 600, 'horz');
		expect(result).toBeDefined();
		expect(result!.outgoing).toContain('pptx-tr-window-out');
		expect(result!.incoming).toContain('pptx-tr-window-horz');
	});

	it('should include duration in milliseconds in animation strings', () => {
		const result = getP14TransitionAnimations('vortex', 1234, undefined);
		expect(result).toBeDefined();
		expect(result!.outgoing).toContain('1234ms');
		expect(result!.incoming).toContain('1234ms');
	});

	it('should include ease-in-out and forwards in animation strings', () => {
		const result = getP14TransitionAnimations('flash', 500, undefined);
		expect(result).toBeDefined();
		expect(result!.outgoing).toContain('ease-in-out');
		expect(result!.outgoing).toContain('forwards');
	});
});
