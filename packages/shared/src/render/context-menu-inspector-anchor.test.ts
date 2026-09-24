// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import {
	contextMenuInspectorAnchor,
	INSPECTOR_SECTION_ATTRIBUTE,
	scrollInspectorSectionIntoView,
} from './context-menu-inspector-anchor';

describe('contextMenuInspectorAnchor', () => {
	it('maps each format-object command to its section', () => {
		expect(contextMenuInspectorAnchor('size-and-position')).toBe('transform');
		expect(contextMenuInspectorAnchor('format-shape')).toBe('fill-stroke');
		expect(contextMenuInspectorAnchor('edit-alt-text')).toBe('alt-text');
	});

	it('returns null for commands with no inspector section', () => {
		expect(contextMenuInspectorAnchor('copy')).toBeNull();
		expect(contextMenuInspectorAnchor('delete')).toBeNull();
	});
});

describe('scrollInspectorSectionIntoView', () => {
	it('scrolls a tagged section into view', () => {
		const node = document.createElement('div');
		node.setAttribute(INSPECTOR_SECTION_ATTRIBUTE, 'transform');
		// jsdom/happy-dom do not implement `scrollIntoView`, so there is no
		// existing property for `vi.spyOn` to wrap; a plain stub is required.
		// oxlint-disable-next-line vitest/prefer-spy-on
		node.scrollIntoView = vi.fn();
		document.body.appendChild(node);

		scrollInspectorSectionIntoView(document, 'transform');
		expect(node.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
		node.remove();
	});

	it('is a no-op when the section is not tagged', () => {
		expect(() => scrollInspectorSectionIntoView(document, 'fill-stroke')).not.toThrow();
	});
});
