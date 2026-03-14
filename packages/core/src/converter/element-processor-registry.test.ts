import { describe, it, expect } from 'vitest';
import {
	ElementProcessorRegistry,
	type ElementProcessor,
	type ElementProcessorContext,
} from './elements/ElementProcessor';
import type { PptxElement } from '../core';
import { MediaContext } from './media-context';

// ── Helpers ──────────────────────────────────────────────────────────

function makeContext(
	overrides: Partial<ElementProcessorContext> = {}
): ElementProcessorContext {
	return {
		mediaContext: new MediaContext('/out', 'media'),
		slideNumber: 1,
		slideWidth: 960,
		slideHeight: 540,
		semanticMode: true,
		processElements: async () => [],
		...overrides,
	};
}

/** Stub processor that returns a fixed string for the given types. */
class StubProcessor implements ElementProcessor {
	public readonly supportedTypes: ReadonlyArray<PptxElement['type']>;
	private readonly output: string;

	constructor(types: PptxElement['type'][], output: string) {
		this.supportedTypes = types;
		this.output = output;
	}

	public async process(
		element: PptxElement,
		_ctx: ElementProcessorContext
	): Promise<string | null> {
		if (this.supportedTypes.includes(element.type)) {
			return this.output;
		}
		return null;
	}
}

/** Stub processor that always returns null. */
class NullProcessor implements ElementProcessor {
	public readonly supportedTypes: ReadonlyArray<PptxElement['type']>;
	constructor(types: PptxElement['type'][]) {
		this.supportedTypes = types;
	}
	public async process(): Promise<string | null> {
		return null;
	}
}

function makeElement(
	type: PptxElement['type'],
	overrides: Record<string, unknown> = {}
): PptxElement {
	return {
		type,
		id: `${type}_1`,
		x: 50,
		y: 100,
		width: 200,
		height: 100,
		...overrides,
	} as unknown as PptxElement;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('ElementProcessorRegistry', () => {
	// ── Registration & lookup ──

	it('should register and retrieve a processor by type', () => {
		const registry = new ElementProcessorRegistry();
		const processor = new StubProcessor(['text'], 'Text rendered');
		registry.register(processor);

		expect(registry.getProcessor('text')).toBe(processor);
	});

	it('should register a processor that supports multiple types', () => {
		const registry = new ElementProcessorRegistry();
		const processor = new StubProcessor(
			['text', 'shape', 'connector'],
			'Rendered'
		);
		registry.register(processor);

		expect(registry.getProcessor('text')).toBe(processor);
		expect(registry.getProcessor('shape')).toBe(processor);
		expect(registry.getProcessor('connector')).toBe(processor);
	});

	it('should return null for unregistered type', () => {
		const registry = new ElementProcessorRegistry();
		expect(registry.getProcessor('chart')).toBeNull();
	});

	it('should overwrite previous registration for the same type', () => {
		const registry = new ElementProcessorRegistry();
		const first = new StubProcessor(['text'], 'First');
		const second = new StubProcessor(['text'], 'Second');

		registry.register(first);
		registry.register(second);

		expect(registry.getProcessor('text')).toBe(second);
	});

	// ── processElement ──

	it('should delegate to the registered processor', async () => {
		const registry = new ElementProcessorRegistry();
		registry.register(new StubProcessor(['chart'], 'Chart output'));

		const element = makeElement('chart');
		const result = await registry.processElement(element, makeContext());
		expect(result).toContain('Chart output');
	});

	it('should return null when no processor is registered', async () => {
		const registry = new ElementProcessorRegistry();
		const element = makeElement('media');
		const result = await registry.processElement(element, makeContext());
		expect(result).toBeNull();
	});

	it('should return null when processor returns null', async () => {
		const registry = new ElementProcessorRegistry();
		registry.register(new NullProcessor(['text']));

		const element = makeElement('text');
		const result = await registry.processElement(element, makeContext());
		expect(result).toBeNull();
	});

	// ── Hidden element annotation ──

	it('should prefix hidden elements with *[Hidden]*', async () => {
		const registry = new ElementProcessorRegistry();
		registry.register(new StubProcessor(['shape'], 'Shape content'));

		const element = makeElement('shape', { hidden: true });
		const result = await registry.processElement(element, makeContext());
		expect(result).not.toBeNull();
		expect(result).toContain('*[Hidden]*');
		expect(result).toContain('Shape content');
		expect(result!.startsWith('*[Hidden]* Shape content')).toBe(true);
	});

	it('should not prefix visible elements with *[Hidden]*', async () => {
		const registry = new ElementProcessorRegistry();
		registry.register(new StubProcessor(['shape'], 'Visible shape'));

		const element = makeElement('shape', { hidden: false });
		const result = await registry.processElement(element, makeContext());
		expect(result).not.toBeNull();
		expect(result).not.toContain('*[Hidden]*');
	});

	// ── Click action annotations ──

	it('should append URL hyperlink from actionClick', async () => {
		const registry = new ElementProcessorRegistry();
		registry.register(new StubProcessor(['text'], 'Click me'));

		const element = makeElement('text', {
			actionClick: { url: 'https://example.com' },
		});
		const result = await registry.processElement(element, makeContext());
		expect(result).not.toBeNull();
		expect(result).toContain('Click me');
		expect(result).toContain(
			'[https://example.com](https://example.com)'
		);
	});

	it('should use tooltip as link text when available', async () => {
		const registry = new ElementProcessorRegistry();
		registry.register(new StubProcessor(['text'], 'Link text'));

		const element = makeElement('text', {
			actionClick: {
				url: 'https://example.com/page',
				tooltip: 'Visit our page',
			},
		});
		const result = await registry.processElement(element, makeContext());
		expect(result).not.toBeNull();
		expect(result).toContain(
			'[Visit our page](https://example.com/page)'
		);
	});

	it('should append slide jump action from actionClick', async () => {
		const registry = new ElementProcessorRegistry();
		registry.register(new StubProcessor(['shape'], 'Button'));

		const element = makeElement('shape', {
			actionClick: { targetSlideIndex: 4 },
		});
		const result = await registry.processElement(element, makeContext());
		expect(result).not.toBeNull();
		expect(result).toContain('*Jump to slide 5*');
	});

	it('should append custom action string from actionClick', async () => {
		const registry = new ElementProcessorRegistry();
		registry.register(new StubProcessor(['shape'], 'Interactive'));

		const element = makeElement('shape', {
			actionClick: { action: 'ppaction://hlinkshowjump?jump=firstslide' },
		});
		const result = await registry.processElement(element, makeContext());
		expect(result).not.toBeNull();
		expect(result).toContain(
			'*ppaction://hlinkshowjump?jump=firstslide*'
		);
	});

	// ── Hover action annotations ──

	it('should append URL hyperlink from actionHover', async () => {
		const registry = new ElementProcessorRegistry();
		registry.register(new StubProcessor(['image'], 'Image content'));

		const element = makeElement('image', {
			actionHover: { url: 'https://hover-target.com' },
		});
		const result = await registry.processElement(element, makeContext());
		expect(result).not.toBeNull();
		expect(result).toContain(
			'[https://hover-target.com](https://hover-target.com)'
		);
	});

	it('should append slide jump from actionHover', async () => {
		const registry = new ElementProcessorRegistry();
		registry.register(new StubProcessor(['shape'], 'Hoverable'));

		const element = makeElement('shape', {
			actionHover: { targetSlideIndex: 0 },
		});
		const result = await registry.processElement(element, makeContext());
		expect(result).not.toBeNull();
		expect(result).toContain('*Jump to slide 1*');
	});

	// ── Combined annotations ──

	it('should append both click and hover actions', async () => {
		const registry = new ElementProcessorRegistry();
		registry.register(new StubProcessor(['shape'], 'Dual action'));

		const element = makeElement('shape', {
			actionClick: { url: 'https://click.com' },
			actionHover: { url: 'https://hover.com' },
		});
		const result = await registry.processElement(element, makeContext());
		expect(result).not.toBeNull();
		expect(result).toContain('[https://click.com](https://click.com)');
		expect(result).toContain('[https://hover.com](https://hover.com)');
	});

	it('should combine hidden flag with action annotations', async () => {
		const registry = new ElementProcessorRegistry();
		registry.register(new StubProcessor(['text'], 'Hidden link'));

		const element = makeElement('text', {
			hidden: true,
			actionClick: { url: 'https://secret.com' },
		});
		const result = await registry.processElement(element, makeContext());
		expect(result).not.toBeNull();
		expect(result).toContain('*[Hidden]*');
		expect(result).toContain('[https://secret.com](https://secret.com)');
	});

	it('should not append action annotation when action is empty object', async () => {
		const registry = new ElementProcessorRegistry();
		registry.register(new StubProcessor(['text'], 'No action'));

		const element = makeElement('text', {
			actionClick: {},
		});
		const result = await registry.processElement(element, makeContext());
		expect(result).toBe('No action');
	});

	it('should handle actionClick with targetSlideIndex of 0', async () => {
		const registry = new ElementProcessorRegistry();
		registry.register(new StubProcessor(['shape'], 'First slide link'));

		const element = makeElement('shape', {
			actionClick: { targetSlideIndex: 0 },
		});
		const result = await registry.processElement(element, makeContext());
		expect(result).not.toBeNull();
		expect(result).toContain('*Jump to slide 1*');
	});
});
