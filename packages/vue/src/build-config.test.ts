import dts from 'vite-plugin-dts';
import { describe, expect, it, vi } from 'vitest';

vi.mock(import('vite-plugin-dts'), () => ({
	default: vi.fn(() => [{ name: 'declaration-options-capture' }]),
}));

describe('published Vue declarations', () => {
	it('bundles internal package types using the declaration plugin API', async () => {
		// Vitest clears mock calls before each test. Evaluate the config here
		// so its plugin invocation is captured after that lifecycle boundary.
		await import('../vite.config');
		const options = vi.mocked(dts).mock.calls[0]?.[0];

		// The private shared package is not installed by consumers. Generating
		// declarations without bundling leaves its public re-exports unresolved.
		expect(options?.bundleTypes).toStrictEqual({
			bundledPackages: ['pptx-viewer-core', 'pptx-viewer-shared'],
		});
		expect(options).not.toHaveProperty('rollupTypes');
		expect(options).not.toHaveProperty('bundledPackages');
	});
});
