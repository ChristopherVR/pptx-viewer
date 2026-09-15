import dts from 'vite-plugin-dts';
import { describe, expect, it, vi } from 'vitest';

import '../vite.config';

vi.mock(import('vite-plugin-dts'), () => ({
	default: vi.fn(() => [{ name: 'declaration-options-capture' }]),
}));

describe('published Vue declarations', () => {
	it('bundles internal package types using the declaration plugin API', () => {
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
