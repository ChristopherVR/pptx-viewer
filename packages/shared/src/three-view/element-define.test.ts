import { afterEach, describe, expect, it, vi } from 'vitest';

import { defineThreeViewElement } from './element';

describe('defineThreeViewElement outside a browser', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('does nothing when only a customElements shim exists (Lit on Node has no HTMLElement)', () => {
		const define = vi.fn();
		vi.stubGlobal('HTMLElement', undefined);
		vi.stubGlobal('customElements', { get: () => undefined, define });

		expect(() => defineThreeViewElement()).not.toThrow();
		expect(define).not.toHaveBeenCalled();
	});
});
