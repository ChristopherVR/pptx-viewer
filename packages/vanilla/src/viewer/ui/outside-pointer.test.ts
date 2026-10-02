// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { onDocumentPointerDown } from './outside-pointer';

describe('onDocumentPointerDown', () => {
	it('calls every live handler on a document pointerdown', () => {
		const owner = document.createElement('div');
		const handler = vi.fn();
		onDocumentPointerDown(document, owner, handler);
		document.dispatchEvent(new Event('pointerdown'));
		expect(handler).toHaveBeenCalledOnce();
	});

	it('registers one document listener per document, however many popups', () => {
		const spy = vi.spyOn(document, 'addEventListener');
		const before = spy.mock.calls.filter(([type]) => type === 'pointerdown').length;
		for (let i = 0; i < 5; i++) {
			onDocumentPointerDown(document, document.createElement('div'), vi.fn());
		}
		expect(spy.mock.calls.filter(([type]) => type === 'pointerdown')).toHaveLength(before);
		spy.mockRestore();
	});
});
