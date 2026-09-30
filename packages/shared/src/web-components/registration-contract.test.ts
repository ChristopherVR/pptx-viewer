// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { registerPptxWebControls } from './index';
import { assertWebControlContract, markWebControlContract } from './registration-contract';

describe('web control registration contract', () => {
	it('rejects the last incompatible tag before making any registration changes', () => {
		class Foreign extends HTMLElement {}
		Object.defineProperty(Foreign, Symbol.for('pptx-viewer.web-control-contract'), { value: 2 });
		const registry = {
			get: (name: string) => (name === 'pptx-ui-ribbon-toggle' ? Foreign : undefined),
			define: vi.fn(),
		};
		const stylesBefore = document.head.innerHTML;
		vi.stubGlobal('window', { customElements: registry });
		try {
			expect(registerPptxWebControls).toThrow('Incompatible pptx-ui-ribbon-toggle contract');
			expect(registry.define).not.toHaveBeenCalled();
			expect(document.head.innerHTML).toBe(stylesBefore);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('shares definitions and one host stylesheet between independently imported bundles', async () => {
		registerPptxWebControls();
		const ctor = customElements.get('pptx-ui-ribbon-command');
		vi.resetModules();
		const secondBundle = await import('./index');
		secondBundle.registerPptxWebControls();
		expect(customElements.get('pptx-ui-ribbon-command')).toBe(ctor);
		expect(document.querySelectorAll('#pptx-ui-control-hosts')).toHaveLength(1);
	});

	it('rejects known incompatible revisions and leaves unmarked legacy definitions unclaimed', () => {
		class Compatible extends HTMLElement {}
		class Incompatible extends HTMLElement {}
		class Legacy extends HTMLElement {}
		markWebControlContract(Compatible);
		Object.defineProperty(Incompatible, Symbol.for('pptx-viewer.web-control-contract'), {
			value: 2,
		});
		const constructors: Record<string, CustomElementConstructor> = {
			compatible: Compatible,
			incompatible: Incompatible,
			legacy: Legacy,
		};
		const get = vi.fn((name: string) => constructors[name]);
		expect(() => assertWebControlContract({ get }, ['compatible', 'legacy'])).not.toThrow();
		expect(() => assertWebControlContract({ get }, ['compatible', 'incompatible'])).toThrow(
			'Incompatible incompatible contract',
		);
		expect(Object.getOwnPropertySymbols(Legacy)).toHaveLength(0);
	});
});
