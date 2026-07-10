import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createDefaultRegistry } from './elements';
import { createElementRendererRegistry } from './registry';
import type { ElementRenderContext, ElementRenderer } from './types';

const noop: ElementRenderer = () => null;
const dummyElement = { type: 'chart', id: 'c', x: 0, y: 0, width: 1, height: 1 } as PptxElement;
const dummyContext = {} as ElementRenderContext;

describe('createElementRendererRegistry', () => {
	it('registers, resolves, and unregisters renderers by type', () => {
		const registry = createElementRendererRegistry();
		registry.register('text', noop);

		expect(registry.has('text')).toBeTruthy();
		expect(registry.get('text')).toBe(noop);
		expect(registry.resolve('text')).toBe(noop);

		registry.unregister('text');
		expect(registry.has('text')).toBeFalsy();
		expect(registry.get('text')).toBeUndefined();
	});

	it('falls back for unregistered types and supports replacing the fallback', () => {
		const registry = createElementRendererRegistry();
		expect(registry.resolve('chart')(dummyElement, 0, dummyContext)).toBeNull();

		const fallback: ElementRenderer = vi.fn(() => null);
		registry.setFallback(fallback);
		expect(registry.resolve('chart')).toBe(fallback);

		// A dedicated renderer still wins over the fallback.
		registry.register('chart', noop);
		expect(registry.resolve('chart')).toBe(noop);
	});

	it('lists registered types sorted', () => {
		const registry = createElementRendererRegistry();
		registry.register('shape', noop);
		registry.register('connector', noop);
		registry.register('group', noop);
		expect(registry.registeredTypes()).toStrictEqual(['connector', 'group', 'shape']);
	});
});

describe('createDefaultRegistry', () => {
	it('registers dedicated renderers for the implemented types', () => {
		const registry = createDefaultRegistry();
		expect(registry.registeredTypes()).toStrictEqual([
			'connector',
			'group',
			'image',
			'picture',
			'shape',
			'text',
		]);
	});

	it('leaves the remaining types on the placeholder fallback', () => {
		const registry = createDefaultRegistry();
		for (const type of ['table', 'chart', 'smartArt', 'media', 'ink', 'ole'] as const) {
			expect(registry.has(type)).toBeFalsy();
			expect(registry.resolve(type)).toBeDefined();
		}
	});

	it('allows a host to add a renderer for a placeholder type without touching internals', () => {
		const registry = createDefaultRegistry();
		const custom: ElementRenderer = () => null;
		registry.register('table', custom);
		expect(registry.resolve('table')).toBe(custom);
	});
});
