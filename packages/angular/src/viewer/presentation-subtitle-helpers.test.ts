/**
 * presentation-subtitle-helpers.test.ts: unit tests for pure caption helpers.
 * No TestBed, no DOM access.
 *
 * Ported from React:
 *   packages/react/src/viewer/components/PresentationSubtitleBar.tsx
 */

import { describe, expect, it } from 'vitest';

import { captionDisplayText, mergeCaptionResults } from './presentation-subtitle-helpers';
import type { SpeechResult, SpeechResultList } from './presentation-subtitle-helpers';

// ---------------------------------------------------------------------------
// Minimal stubs
// ---------------------------------------------------------------------------

function makeResult(transcript: string, isFinal: boolean): SpeechResult {
	const result: SpeechResult = {
		isFinal,
		length: 1,
		0: { transcript, confidence: 1 },
	};
	return result;
}

function makeResultList(results: SpeechResult[]): SpeechResultList {
	const list: SpeechResultList = {
		length: results.length,
		...Object.fromEntries(results.map((r, i) => [i, r])),
	};
	return list;
}

// ---------------------------------------------------------------------------
// mergeCaptionResults
// ---------------------------------------------------------------------------

describe('mergeCaptionResults', () => {
	it('returns empty string for an empty result list', () => {
		expect(mergeCaptionResults(0, makeResultList([]))).toBe('');
	});

	it('merges a single final result', () => {
		const list = makeResultList([makeResult('Hello world', true)]);
		expect(mergeCaptionResults(0, list)).toBe('Hello world');
	});

	it('merges a single interim result', () => {
		const list = makeResultList([makeResult('Hello', false)]);
		expect(mergeCaptionResults(0, list)).toBe('Hello');
	});

	it('concatenates final text before interim text', () => {
		const list = makeResultList([
			makeResult('Final part. ', true),
			makeResult('interim guess', false),
		]);
		const result = mergeCaptionResults(0, list);
		// final prefix + space + interim, then trimmed
		expect(result).toBe('Final part.  interim guess');
	});

	it('respects resultIndex: skips earlier results', () => {
		const list = makeResultList([makeResult('Ignored. ', true), makeResult('Included', true)]);
		expect(mergeCaptionResults(1, list)).toBe('Included');
	});

	it('trims the merged result', () => {
		const list = makeResultList([makeResult('   hello   ', true)]);
		// no interim text → "   hello    " trimmed
		expect(mergeCaptionResults(0, list).trim()).toBe('hello');
	});

	it('returns empty string when transcript is empty', () => {
		const list = makeResultList([makeResult('', true)]);
		expect(mergeCaptionResults(0, list)).toBe('');
	});
});

// ---------------------------------------------------------------------------
// captionDisplayText
// ---------------------------------------------------------------------------

describe('captionDisplayText', () => {
	it('returns the not-supported fallback when unsupported', () => {
		const result = captionDisplayText('unsupported', '', 'Not supported', 'Listening...');
		expect(result).toBe('Not supported');
	});

	it('returns the not-supported fallback even if captionText is non-empty', () => {
		const result = captionDisplayText('unsupported', 'some text', 'Not supported', 'Listening...');
		expect(result).toBe('Not supported');
	});

	it('returns the listening fallback when supported but no text yet', () => {
		expect(captionDisplayText('supported', '', 'Not supported', 'Listening...')).toBe(
			'Listening...',
		);
	});

	it('returns the listening fallback when state is unknown and text is empty', () => {
		expect(captionDisplayText('unknown', '', 'Not supported', 'Listening...')).toBe('Listening...');
	});

	it('returns the captured text when supported and text is non-empty', () => {
		const result = captionDisplayText('supported', 'Hello world', 'Not supported', 'Listening...');
		expect(result).toBe('Hello world');
	});

	it('returns captured text when state is unknown but text is present', () => {
		const result = captionDisplayText('unknown', 'Some text', 'Not supported', 'Listening...');
		expect(result).toBe('Some text');
	});
});
