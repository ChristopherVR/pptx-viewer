import { describe, expect, it } from 'vitest';

import { describeToolActivity, summarizeToolArgs, toolLabel } from './tool-summary';

describe('toolLabel', () => {
	it('title-cases a snake_case tool name', () => {
		expect(toolLabel('update_text')).toBe('Update text');
		expect(toolLabel('set_slide_transition')).toBe('Set slide transition');
	});

	it('falls back to Tool for an empty name', () => {
		expect(toolLabel('')).toBe('Tool');
	});
});

describe('summarizeToolArgs', () => {
	it('presents zero-based slideIndex as a 1-based slide number', () => {
		expect(summarizeToolArgs({ slideIndex: 2 })).toBe('slide 3');
	});

	it('drops empty fields and truncates long strings', () => {
		const long = 'x'.repeat(40);
		expect(summarizeToolArgs({ text: long, note: '' })).toBe(`text: "${'x'.repeat(32)}..."`);
	});

	it('caps the summary at four fields with an ellipsis', () => {
		const summary = summarizeToolArgs({ a: 1, b: 2, c: 3, d: 4, e: 5 });
		expect(summary.endsWith('...')).toBeTruthy();
	});

	it('returns an empty string for non-object input', () => {
		expect(summarizeToolArgs(null)).toBe('');
		expect(summarizeToolArgs('hi')).toBe('');
	});
});

describe('describeToolActivity', () => {
	it('turns a read tool + slide index into a friendly past-tense phrase', () => {
		expect(describeToolActivity('get_slide', { slideIndex: 4 }).label).toBe('Looked at slide 5');
		expect(describeToolActivity('get_slide', { slideIndex: 4 }, 'present').label).toBe(
			'Looking at slide 5',
		);
	});

	it('phrases edit tools plainly and NEVER leaks element ids', () => {
		const merged = describeToolActivity('merge_tables', {
			slideIndex: 2,
			elementIdA: 'ppt/slides/slide3.xml-graphicFrame-178',
			elementIdB: 'ppt/slides/slide3.xml-graphicFrame-9',
		});
		expect(merged.label).toBe('Merged two tables on slide 3');
		expect(merged.label).not.toContain('178');
		expect(merged.label).not.toContain('graphicFrame');

		const text = describeToolActivity('update_element', {
			slideIndex: 0,
			elementId: 'ppt/slides/slide1.xml-shape-9',
			text: 'Hello',
		});
		expect(text.label).toBe('Updated an element on slide 1');
		expect(text.label).not.toContain('shape-9');
	});

	it('humanizes theme and slide tools', () => {
		expect(describeToolActivity('update_theme_colors', {}).label).toBe('Changed the theme colours');
		expect(describeToolActivity('add_slide', {}).label).toBe('Added a slide');
		expect(describeToolActivity('apply_theme_preset', { presetName: 'Vermilion' }).label).toBe(
			'Applied the Vermilion theme',
		);
	});

	it('pluralises deletion counts', () => {
		expect(
			describeToolActivity('delete_elements', { slideIndex: 1, elementIds: ['a', 'b'] }).label,
		).toBe('Deleted 2 elements on slide 2');
		expect(
			describeToolActivity('delete_elements', { slideIndex: 1, elementIds: ['a'] }).label,
		).toBe('Deleted 1 element on slide 2');
	});

	it('names the chart kind and the new insert tools', () => {
		expect(describeToolActivity('create_chart', { slideIndex: 2, chartType: 'bar' }).label).toBe(
			'Added a bar chart on slide 3',
		);
		expect(describeToolActivity('create_chart', { slideIndex: 2 }).label).toBe(
			'Added a chart on slide 3',
		);
		expect(describeToolActivity('manage_smart_art', { slideIndex: 0, layout: 'cycle' }).label).toBe(
			'Edited SmartArt on slide 1',
		);
	});

	it('carries an icon category and falls back for unknown tools', () => {
		expect(describeToolActivity('get_slide', { slideIndex: 0 }).icon).toBe('view');
		expect(describeToolActivity('update_theme_colors', {}).icon).toBe('theme');
		const unknown = describeToolActivity('some_custom_tool', {});
		expect(unknown.icon).toBe('tool');
		expect(unknown.label).toBe('Some custom tool');
	});
});
