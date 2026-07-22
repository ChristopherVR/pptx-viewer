/**
 * Data-level guarantees behind the round-3 friendly cards (the components
 * themselves are template-only and need TestBed rendering, which this package's
 * vitest env does not run). These assert the shared helpers the cards bind to.
 */
import { describe, expect, it } from 'vitest';

import {
	describeToolActivity,
	humanizeDiffLine,
	summarizeToolArgs,
} from '../../internal/shared-ai';

describe('tool-call card activity (friendly labels, ids hidden)', () => {
	it('describes a tool as a plain-language phrase without leaking element ids', () => {
		const activity = describeToolActivity(
			'set_shape_style',
			{ slideIndex: 4, elementId: 'ppt/slides/slide5.xml-shape-9' },
			'past',
		);
		expect(activity.label).toBe('Restyled a shape on slide 5');
		expect(activity.icon).toBe('shape');
		// The friendly line never contains the raw element id.
		expect(activity.label).not.toContain('shape-9');
		expect(activity.label).not.toContain('ppt/slides');
	});

	it('reads in the present tense while a tool is still running', () => {
		expect(describeToolActivity('get_slide', { slideIndex: 0 }, 'present').label).toBe(
			'Looking at slide 1',
		);
	});

	it('keeps the raw name + args only for the collapsed Details disclosure', () => {
		// The Details line is the only place ids/args appear.
		expect(summarizeToolArgs({ elementId: 'shape-9', fill: '#fff' })).toContain('shape-9');
	});
});

describe('proposal card description (untruncated)', () => {
	it('maps every staged diff line to a friendly sentence, dropping none', () => {
		const summary = [
			'Slide 1: modify text abc: "Title"',
			'Slide 1: add shape def',
			'Slide 2: remove image ghi',
			'Slide 3: modify chart jkl',
			'Slide 4: add table mno',
		];
		const lines = summary.map(humanizeDiffLine);
		// No MAX_SUMMARY_LINES cap: the count is preserved 1:1.
		expect(lines).toHaveLength(summary.length);
		expect(lines[0]).toContain('update the text');
		expect(lines[1]).toContain('add a shape');
		expect(lines[2]).toContain('remove the image');
	});
});
