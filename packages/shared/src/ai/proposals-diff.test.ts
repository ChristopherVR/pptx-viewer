import { describe, expect, it } from 'vitest';

import { humanizeDiffLine } from './proposals-diff';

describe('humanizeDiffLine', () => {
	it('drops the raw element id and reads plainly', () => {
		expect(humanizeDiffLine('Slide 1: modify text el-9: "Title"')).toBe(
			'Slide 1: update the text "Title"',
		);
		expect(humanizeDiffLine('Slide 2: add shape ppt/slides/slide2.xml-shape-3')).toBe(
			'Slide 2: add a shape',
		);
		expect(humanizeDiffLine('Slide 3: remove image img-7: "logo"')).toBe(
			'Slide 3: remove the image "logo"',
		);
	});

	it('never leaks a source-path element id', () => {
		const out = humanizeDiffLine(
			'Slide 1: modify table ppt/slides/slide1.xml-graphicFrame-178: "Q1"',
		);
		expect(out).not.toContain('graphicFrame');
		expect(out).not.toContain('178');
		expect(out).toBe('Slide 1: update the table "Q1"');
	});

	it('passes slide-level and unrecognised lines through unchanged', () => {
		expect(humanizeDiffLine('Add 1 slide(s) (total 4).')).toBe('Add 1 slide(s) (total 4).');
		expect(humanizeDiffLine('Slide 1: update speaker notes')).toBe('Slide 1: update speaker notes');
		expect(humanizeDiffLine('No detectable changes.')).toBe('No detectable changes.');
	});
});
