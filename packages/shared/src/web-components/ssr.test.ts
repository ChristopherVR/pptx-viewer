// @vitest-environment node
import { describe, expect, it } from 'vitest';

describe('web control SSR boundary', () => {
	it('imports the registration entry without browser globals and leaves registration inert', async () => {
		expect(globalThis).not.toHaveProperty('window');
		expect(globalThis).not.toHaveProperty('HTMLElement');
		const { registerPptxWebControls } = await import('./index');
		expect(() => registerPptxWebControls()).not.toThrow();
	});
});
