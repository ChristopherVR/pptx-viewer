import type { PptxSlide, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	NOTES_FONT_SIZE_DEFAULT,
	NOTES_FONT_SIZE_MAX,
	NOTES_FONT_SIZE_MIN,
	NOTES_FONT_SIZE_STEP,
	PRESENTER_TIMER_SEGMENT_MS,
	buildNotesSegments,
	clampNotesFontSize,
	currentSlideAt,
	elapsedSince,
	formatElapsed,
	formatTime,
	nextSlideAfter,
	presenterTimerProgress,
	resolvePresenterNotes,
	slideCounter,
	slideLabel,
} from './presenter-view-helpers';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function slide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 's1',
		rId: 'rId1',
		slideNumber: 1,
		elements: [],
		...overrides,
	} as PptxSlide;
}

function segment(text: string, style: Partial<TextSegment['style']> = {}): TextSegment {
	return { text, style: style as TextSegment['style'] };
}

// ---------------------------------------------------------------------------
// formatElapsed
// ---------------------------------------------------------------------------

describe('formatElapsed', () => {
	it('formats 0 ms as 00:00', () => {
		expect(formatElapsed(0)).toBe('00:00');
	});

	it('formats 1000 ms as 00:01', () => {
		expect(formatElapsed(1000)).toBe('00:01');
	});

	it('formats 60000 ms as 01:00', () => {
		expect(formatElapsed(60000)).toBe('01:00');
	});

	it('formats 90000 ms as 01:30', () => {
		expect(formatElapsed(90000)).toBe('01:30');
	});

	it('pads single-digit minutes and seconds', () => {
		expect(formatElapsed(5000)).toBe('00:05');
		expect(formatElapsed(65000)).toBe('01:05');
	});

	it('switches to HH:MM:SS when >= 1 hour', () => {
		expect(formatElapsed(3600000)).toBe('01:00:00');
	});

	it('formats large values with hours correctly', () => {
		expect(formatElapsed(3661000)).toBe('01:01:01');
	});

	it('formats 2 hours 30 minutes 45 seconds', () => {
		const ms = (2 * 3600 + 30 * 60 + 45) * 1000;
		expect(formatElapsed(ms)).toBe('02:30:45');
	});

	it('uses MM:SS for values just under 1 hour', () => {
		expect(formatElapsed(3599000)).toBe('59:59');
	});

	it('truncates sub-second values (floor)', () => {
		expect(formatElapsed(1500)).toBe('00:01');
		expect(formatElapsed(999)).toBe('00:00');
	});

	it('formats 10 minutes exactly', () => {
		expect(formatElapsed(600000)).toBe('10:00');
	});

	// Negative input is NOT clamped by the shared formatter (see
	// `presenter-view-helpers.ts`); `elapsedSince` clamps at the point the
	// duration is derived, which is the case covered below.
});

// ---------------------------------------------------------------------------
// formatTime
// ---------------------------------------------------------------------------

describe('formatTime', () => {
	it('returns a non-empty time string for a Date', () => {
		const out = formatTime(new Date(2026, 0, 1, 13, 5, 9));
		expect(out).toBeTypeOf('string');
		expect(out.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// clampNotesFontSize
// ---------------------------------------------------------------------------

describe('clampNotesFontSize', () => {
	it('returns the value when within range', () => {
		expect(clampNotesFontSize(16)).toBe(16);
		expect(clampNotesFontSize(NOTES_FONT_SIZE_DEFAULT)).toBe(NOTES_FONT_SIZE_DEFAULT);
	});

	it('clamps to minimum when below range', () => {
		expect(clampNotesFontSize(0)).toBe(NOTES_FONT_SIZE_MIN);
		expect(clampNotesFontSize(-5)).toBe(NOTES_FONT_SIZE_MIN);
		expect(clampNotesFontSize(NOTES_FONT_SIZE_MIN - 1)).toBe(NOTES_FONT_SIZE_MIN);
	});

	it('clamps to maximum when above range', () => {
		expect(clampNotesFontSize(100)).toBe(NOTES_FONT_SIZE_MAX);
		expect(clampNotesFontSize(NOTES_FONT_SIZE_MAX + 1)).toBe(NOTES_FONT_SIZE_MAX);
	});

	it('returns exact boundary values', () => {
		expect(clampNotesFontSize(NOTES_FONT_SIZE_MIN)).toBe(NOTES_FONT_SIZE_MIN);
		expect(clampNotesFontSize(NOTES_FONT_SIZE_MAX)).toBe(NOTES_FONT_SIZE_MAX);
	});
});

// ---------------------------------------------------------------------------
// Font size constants
// ---------------------------------------------------------------------------

describe('font size constants', () => {
	it('min is less than max', () => {
		expect(NOTES_FONT_SIZE_MIN).toBeLessThan(NOTES_FONT_SIZE_MAX);
	});

	it('default is within range', () => {
		expect(NOTES_FONT_SIZE_DEFAULT).toBeGreaterThanOrEqual(NOTES_FONT_SIZE_MIN);
		expect(NOTES_FONT_SIZE_DEFAULT).toBeLessThanOrEqual(NOTES_FONT_SIZE_MAX);
	});

	it('step is positive', () => {
		expect(NOTES_FONT_SIZE_STEP).toBeGreaterThan(0);
	});

	it('stepping from MIN reaches MAX in a finite number of steps', () => {
		const steps = Math.ceil((NOTES_FONT_SIZE_MAX - NOTES_FONT_SIZE_MIN) / NOTES_FONT_SIZE_STEP);
		expect(steps).toBeGreaterThan(0);
		expect(steps).toBeLessThan(100);
	});
});

// ---------------------------------------------------------------------------
// presenterTimerProgress (shared; re-exported here, so the Angular presenter
// view and every other binding pace a talk in the same five-minute segment)
// ---------------------------------------------------------------------------

describe('presenterTimerProgress', () => {
	it('reports 0% / segment 0 at the start', () => {
		expect(presenterTimerProgress(0)).toStrictEqual({ percent: 0, segment: 0 });
	});

	it('reports 50% halfway through the first segment', () => {
		const result = presenterTimerProgress(PRESENTER_TIMER_SEGMENT_MS / 2);
		expect(result.percent).toBeCloseTo(50);
		expect(result.segment).toBe(0);
	});

	it('rolls over to segment 1 at the segment boundary', () => {
		const result = presenterTimerProgress(PRESENTER_TIMER_SEGMENT_MS);
		expect(result.segment).toBe(1);
		expect(result.percent).toBeCloseTo(0);
	});

	it('caps percent at 100', () => {
		// Construct a value whose modulo would exceed the segment if mis-computed.
		const result = presenterTimerProgress(
			PRESENTER_TIMER_SEGMENT_MS * 2 + PRESENTER_TIMER_SEGMENT_MS / 4,
		);
		expect(result.percent).toBeLessThanOrEqual(100);
		expect(result.segment).toBe(2);
	});

	it('treats negative elapsed as zero', () => {
		expect(presenterTimerProgress(-5000)).toStrictEqual({ percent: 0, segment: 0 });
	});

	it('paces a talk in five-minute segments', () => {
		expect(PRESENTER_TIMER_SEGMENT_MS).toBe(5 * 60 * 1000);
	});
});

// ---------------------------------------------------------------------------
// elapsedSince
// ---------------------------------------------------------------------------

describe('elapsedSince', () => {
	it('returns 0 when the start time is null', () => {
		expect(elapsedSince(null, 10_000)).toBe(0);
	});

	it('returns the positive delta from start to now', () => {
		expect(elapsedSince(1000, 4000)).toBe(3000);
	});

	it('clamps to 0 when now precedes start', () => {
		expect(elapsedSince(5000, 1000)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// currentSlideAt / nextSlideAfter
// ---------------------------------------------------------------------------

describe('currentSlideAt', () => {
	const deck = [slide({ id: 'a' }), slide({ id: 'b' }), slide({ id: 'c' })];

	it('returns the slide at the index', () => {
		expect(currentSlideAt(deck, 1)?.id).toBe('b');
	});

	it('returns undefined for out-of-range indices', () => {
		expect(currentSlideAt(deck, -1)).toBeUndefined();
		expect(currentSlideAt(deck, 3)).toBeUndefined();
	});

	it('returns undefined for an empty deck', () => {
		expect(currentSlideAt([], 0)).toBeUndefined();
	});
});

describe('nextSlideAfter', () => {
	const deck = [slide({ id: 'a' }), slide({ id: 'b' }), slide({ id: 'c' })];

	it('returns the following visible slide', () => {
		expect(nextSlideAfter(deck, 0)?.id).toBe('b');
		expect(nextSlideAfter(deck, 1)?.id).toBe('c');
	});

	it('skips hidden slides', () => {
		const hiddenDeck = [slide({ id: 'a' }), slide({ id: 'b', hidden: true }), slide({ id: 'c' })];
		expect(nextSlideAfter(hiddenDeck, 0)?.id).toBe('c');
	});

	it('returns undefined past the last slide', () => {
		expect(nextSlideAfter(deck, 2)).toBeUndefined();
	});

	it('returns undefined for an empty deck', () => {
		expect(nextSlideAfter([], 0)).toBeUndefined();
	});

	// The three below are the shared `nextPresentedSlide` contract rather than a
	// naive `slides[index + 1]`. They exist because the preview and the SHOW must
	// agree: a preview that promises a slide the show then skips is worse than no
	// preview at all.
	it('skips a run of consecutive hidden slides', () => {
		const hiddenRun = [
			slide({ id: 'a' }),
			slide({ id: 'b', hidden: true }),
			slide({ id: 'c', hidden: true }),
			slide({ id: 'd' }),
		];
		expect(nextSlideAfter(hiddenRun, 0)?.id).toBe('d');
	});

	it('reports the end of the show when every later slide is hidden', () => {
		const trailingHidden = [slide({ id: 'a' }), slide({ id: 'b', hidden: true })];
		expect(nextSlideAfter(trailingHidden, 0)).toBeUndefined();
	});

	it('still advances when the CURRENT slide is itself hidden', () => {
		const fromHidden = [slide({ id: 'a', hidden: true }), slide({ id: 'b' })];
		expect(nextSlideAfter(fromHidden, 0)?.id).toBe('b');
	});

	// The deck's authored `p:showPr/p:sldRg` range must gate the preview the
	// same way a custom show does: on the last slide of a range-restricted
	// show, the "up next" preview must be empty, not the deck's own next slide.
	it('honours the authored slide range, stopping at its end', () => {
		expect(nextSlideAfter(deck, 1, null, { fromIndex: 0, toIndex: 1 })).toBeUndefined();
	});

	it('honours the authored slide range mid-show', () => {
		expect(nextSlideAfter(deck, 0, null, { fromIndex: 0, toIndex: 2 })?.id).toBe('b');
	});
});

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

describe('slideLabel / slideCounter', () => {
	it('produces a 1-based "Slide n of total" label', () => {
		expect(slideLabel(0, 12)).toBe('Slide 1 of 12');
		expect(slideLabel(11, 12)).toBe('Slide 12 of 12');
	});

	it('produces a compact "n / total" counter', () => {
		expect(slideCounter(0, 12)).toBe('1 / 12');
		expect(slideCounter(2, 12)).toBe('3 / 12');
	});
});

// ---------------------------------------------------------------------------
// buildNotesSegments
// ---------------------------------------------------------------------------

describe('buildNotesSegments', () => {
	it('marks paragraph breaks as break tokens', () => {
		const out = buildNotesSegments([
			{ text: '', style: {}, isParagraphBreak: true } as TextSegment,
		]);
		expect(out).toHaveLength(1);
		expect(out[0].isBreak).toBeTruthy();
		expect(out[0].text).toBe('');
	});

	it('carries plain text with an empty style', () => {
		const out = buildNotesSegments([segment('hello')]);
		expect(out[0].isBreak).toBeFalsy();
		expect(out[0].text).toBe('hello');
		expect(out[0].style).toStrictEqual({});
	});

	it('maps bold / italic styles', () => {
		const out = buildNotesSegments([segment('x', { bold: true, italic: true })]);
		expect(out[0].style['font-weight']).toBe('bold');
		expect(out[0].style['font-style']).toBe('italic');
	});

	it('combines underline and strikethrough into one text-decoration', () => {
		const out = buildNotesSegments([segment('x', { underline: true, strikethrough: true })]);
		expect(out[0].style['text-decoration']).toBe('underline line-through');
	});

	it('maps color, font size (pt), and font family', () => {
		const out = buildNotesSegments([
			segment('x', { color: '#ff0000', fontSize: 18, fontFamily: 'Arial' }),
		]);
		expect(out[0].style['color']).toBe('#ff0000');
		// POINTS, not pixels. Angular used to emit `18px` from a forked builder
		// while shared (and therefore every other binding) emitted `18pt`, so the
		// same notes run rendered a third smaller here than anywhere else.
		expect(out[0].style['font-size']).toBe('18pt');
		expect(out[0].style['font-family']).toBe('Arial');
	});

	it('emits kebab-case style keys for the Angular ngStyle binding', () => {
		const out = buildNotesSegments([segment('x', { bold: true, fontSize: 12 })]);
		expect(Object.keys(out[0].style).some((key) => /[A-Z]/u.test(key))).toBeFalsy();
	});

	it('produces stable, unique keys per token', () => {
		const out = buildNotesSegments([
			segment('a'),
			{ text: '', style: {}, isParagraphBreak: true } as TextSegment,
			segment('b'),
		]);
		const keys = out.map((s) => s.key);
		expect(new Set(keys).size).toBe(keys.length);
	});
});

// ---------------------------------------------------------------------------
// resolvePresenterNotes
// ---------------------------------------------------------------------------

describe('resolvePresenterNotes', () => {
	it('reports no notes for an undefined slide', () => {
		const notes = resolvePresenterNotes(undefined);
		expect(notes.hasRichNotes).toBeFalsy();
		expect(notes.hasAnyNotes).toBeFalsy();
		expect(notes.segments).toStrictEqual([]);
		expect(notes.plainText).toBe('');
	});

	it('reports no notes for a slide with only whitespace plain notes', () => {
		const notes = resolvePresenterNotes(slide({ notes: '   ' }));
		expect(notes.hasRichNotes).toBeFalsy();
		expect(notes.hasAnyNotes).toBeFalsy();
	});

	it('uses plain notes when no rich segments exist', () => {
		const notes = resolvePresenterNotes(slide({ notes: 'Remember to smile' }));
		expect(notes.hasRichNotes).toBeFalsy();
		expect(notes.hasAnyNotes).toBeTruthy();
		expect(notes.plainText).toBe('Remember to smile');
		expect(notes.segments).toStrictEqual([]);
	});

	it('prefers rich notes segments when present', () => {
		const notes = resolvePresenterNotes(
			slide({ notes: 'plain', notesSegments: [segment('rich', { bold: true })] }),
		);
		expect(notes.hasRichNotes).toBeTruthy();
		expect(notes.hasAnyNotes).toBeTruthy();
		expect(notes.segments).toHaveLength(1);
		expect(notes.segments[0].text).toBe('rich');
		expect(notes.segments[0].style['font-weight']).toBe('bold');
	});

	it('treats an empty rich-segments array as no rich notes', () => {
		const notes = resolvePresenterNotes(slide({ notesSegments: [] }));
		expect(notes.hasRichNotes).toBeFalsy();
	});
});
