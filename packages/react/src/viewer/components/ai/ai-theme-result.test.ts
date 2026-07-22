import { describe, expect, it } from 'vitest';

import type { RenderableToolPart } from './ai-message-parts';
import { appliedThemeFromPart } from './ai-theme-result';

function toolPart(overrides: Partial<RenderableToolPart>): RenderableToolPart {
	return {
		kind: 'tool',
		toolName: 'update_theme_colors',
		toolCallId: 'c1',
		state: 'output-available',
		input: {},
		output: {
			applied: true,
			summary: 'Applied theme colour accent1',
			previous: { colorScheme: {} },
		},
		...overrides,
	} as RenderableToolPart;
}

describe('appliedThemeFromPart', () => {
	it('extracts summary + previous from an applied theme tool result', () => {
		const info = appliedThemeFromPart(toolPart({}));
		expect(info?.summary).toBe('Applied theme colour accent1');
		expect(info?.previous).toStrictEqual({ colorScheme: {} });
	});

	it('ignores non-theme tools', () => {
		expect(appliedThemeFromPart(toolPart({ toolName: 'update_element' }))).toBeNull();
	});

	it('ignores results that are not yet available', () => {
		expect(appliedThemeFromPart(toolPart({ state: 'input-available' }))).toBeNull();
	});

	it('ignores theme results that did not apply', () => {
		expect(appliedThemeFromPart(toolPart({ output: { applied: false } }))).toBeNull();
	});
});
