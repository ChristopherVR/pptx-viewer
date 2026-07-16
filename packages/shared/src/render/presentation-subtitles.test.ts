import { describe, expect, it } from 'vitest';

import { captionDisplayText, mergeCaptionResults } from './presentation-subtitles';
import type { SpeechResultList } from './presentation-subtitles';

describe('presentation subtitles', () => {
	it('merges stable and interim caption fragments', () => {
		const results = {
			length: 2,
			0: { isFinal: true, length: 1, 0: { transcript: 'Hello ', confidence: 1 } },
			1: { isFinal: false, length: 1, 0: { transcript: 'world', confidence: 1 } },
		} satisfies SpeechResultList;
		expect(mergeCaptionResults(0, results)).toBe('Hello  world');
	});

	it('selects the correct fallback display text', () => {
		expect(captionDisplayText('unsupported', '', 'Unavailable', 'Listening')).toBe('Unavailable');
		expect(captionDisplayText('supported', '', 'Unavailable', 'Listening')).toBe('Listening');
		expect(captionDisplayText('supported', 'Caption', 'Unavailable', 'Listening')).toBe('Caption');
	});
});
