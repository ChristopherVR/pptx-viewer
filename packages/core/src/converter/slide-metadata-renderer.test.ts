import { describe, it, expect } from 'vitest';
import { SlideMetadataRenderer } from './SlideMetadataRenderer';
import { TextSegmentRenderer } from './TextSegmentRenderer';
import type { PptxSlide } from '../core';

function makeSlide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 'slide1',
		rId: 'rId1',
		slideNumber: 1,
		elements: [],
		...overrides,
	} as PptxSlide;
}

describe('SlideMetadataRenderer', () => {
	const textRenderer = new TextSegmentRenderer();
	const renderer = new SlideMetadataRenderer(textRenderer);

	describe('renderTransition', () => {
		it('should return empty string when no transition', () => {
			expect(renderer.renderTransition(makeSlide())).toBe('');
		});

		it('should return empty string when transition type is "none"', () => {
			const slide = makeSlide({
				transition: { type: 'none' } as any,
			});
			expect(renderer.renderTransition(slide)).toBe('');
		});

		it('should render basic transition type', () => {
			const slide = makeSlide({
				transition: { type: 'fade' } as any,
			});
			const result = renderer.renderTransition(slide);
			expect(result).toContain('Transition');
			expect(result).toContain('fade');
		});

		it('should include direction when present', () => {
			const slide = makeSlide({
				transition: { type: 'push', direction: 'left' } as any,
			});
			const result = renderer.renderTransition(slide);
			expect(result).toContain('direction: left');
		});

		it('should include duration', () => {
			const slide = makeSlide({
				transition: { type: 'fade', durationMs: 500 } as any,
			});
			const result = renderer.renderTransition(slide);
			expect(result).toContain('500ms');
		});

		it('should include auto-advance timing', () => {
			const slide = makeSlide({
				transition: { type: 'fade', advanceAfterMs: 3000 } as any,
			});
			const result = renderer.renderTransition(slide);
			expect(result).toContain('auto-advance: 3000ms');
		});

		it('should include "no click advance" when advanceOnClick is false', () => {
			const slide = makeSlide({
				transition: { type: 'fade', advanceOnClick: false } as any,
			});
			const result = renderer.renderTransition(slide);
			expect(result).toContain('no click advance');
		});

		it('should include sound file name', () => {
			const slide = makeSlide({
				transition: { type: 'fade', soundFileName: 'chime.wav' } as any,
			});
			const result = renderer.renderTransition(slide);
			expect(result).toContain('sound: chime.wav');
		});
	});

	describe('renderComments', () => {
		it('should return empty string when no comments', () => {
			expect(renderer.renderComments(makeSlide())).toBe('');
		});

		it('should return empty string for empty comments array', () => {
			expect(renderer.renderComments(makeSlide({ comments: [] }))).toBe('');
		});

		it('should render a single comment', () => {
			const slide = makeSlide({
				comments: [
					{ author: 'Alice', text: 'Fix this', createdAt: '2025-01-01' },
				] as any,
			});
			const result = renderer.renderComments(slide);
			expect(result).toContain('### Comments');
			expect(result).toContain('**Alice**');
			expect(result).toContain('Fix this');
			expect(result).toContain('2025-01-01');
		});

		it('should show "Unknown" for missing author', () => {
			const slide = makeSlide({
				comments: [{ text: 'A note' }] as any,
			});
			const result = renderer.renderComments(slide);
			expect(result).toContain('**Unknown**');
		});

		it('should show [resolved] for resolved comments', () => {
			const slide = makeSlide({
				comments: [
					{ author: 'Bob', text: 'Done', resolved: true },
				] as any,
			});
			const result = renderer.renderComments(slide);
			expect(result).toContain('[resolved]');
		});

		it('should render multiple comments', () => {
			const slide = makeSlide({
				comments: [
					{ author: 'Alice', text: 'First' },
					{ author: 'Bob', text: 'Second' },
				] as any,
			});
			const result = renderer.renderComments(slide);
			expect(result).toContain('Alice');
			expect(result).toContain('Bob');
		});
	});

	describe('renderNotes', () => {
		it('should return empty string when no notes', () => {
			expect(renderer.renderNotes(makeSlide())).toBe('');
		});

		it('should render plain notes as blockquote', () => {
			const slide = makeSlide({ notes: 'Remember this point.' });
			const result = renderer.renderNotes(slide);
			expect(result).toContain('> **Speaker Notes**');
			expect(result).toContain('> Remember this point.');
		});

		it('should handle multi-line notes', () => {
			const slide = makeSlide({ notes: 'Line 1\nLine 2' });
			const result = renderer.renderNotes(slide);
			expect(result).toContain('> Line 1');
			expect(result).toContain('> Line 2');
		});

		it('should prefer notesSegments over plain notes', () => {
			const slide = makeSlide({
				notes: 'Fallback',
				notesSegments: [{ text: 'Rich notes', style: {} }],
			});
			const result = renderer.renderNotes(slide);
			expect(result).toContain('Rich notes');
		});
	});

	describe('renderWarnings', () => {
		it('should return empty string when no warnings', () => {
			expect(renderer.renderWarnings(makeSlide())).toBe('');
		});

		it('should render warnings with severity icons', () => {
			const slide = makeSlide({
				warnings: [
					{ message: 'Font missing', severity: 'warning' },
					{ message: 'SmartArt simplified', severity: 'info' },
				] as any,
			});
			const result = renderer.renderWarnings(slide);
			expect(result).toContain('### Warnings');
			expect(result).toContain('Font missing');
			expect(result).toContain('SmartArt simplified');
		});
	});

	describe('renderAnimations', () => {
		it('should return empty string when no animations', () => {
			expect(renderer.renderAnimations(makeSlide())).toBe('');
		});

		it('should render native animations grouped by click', () => {
			const slide = makeSlide({
				nativeAnimations: [
					{
						trigger: 'onClick',
						presetClass: 'entr',
						presetName: 'Fade',
						durationMs: 500,
					},
					{
						trigger: 'afterPrevious',
						presetClass: 'emph',
						presetName: 'Pulse',
						durationMs: 300,
					},
				] as any,
			});
			const result = renderer.renderAnimations(slide);
			expect(result).toContain('### Animations');
			expect(result).toContain('Click 1');
			expect(result).toContain('Entrance: Fade');
			expect(result).toContain('Emphasis: Pulse');
		});

		it('should start a new group for each onClick trigger', () => {
			const slide = makeSlide({
				nativeAnimations: [
					{ trigger: 'onClick', presetClass: 'entr', presetName: 'Fly In' },
					{ trigger: 'onClick', presetClass: 'exit', presetName: 'Fly Out' },
				] as any,
			});
			const result = renderer.renderAnimations(slide);
			expect(result).toContain('Click 1');
			expect(result).toContain('Click 2');
		});
	});
});
