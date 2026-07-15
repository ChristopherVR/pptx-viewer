import { describe, expect, it } from 'vitest';

import type { MediaPptxElement, XmlObject } from '../types';
import { applyDrawingMediaReference, parseDrawingMediaReference } from './drawing-media-reference';

describe('drawingML media references', () => {
	it('parses embedded WAV metadata', () => {
		const raw = { '@_r:embed': 'rId7', '@_name': 'Chime', 'a:extLst': { 'a:ext': {} } };
		expect(parseDrawingMediaReference({ 'a:wavAudioFile': raw })).toMatchObject({
			kind: 'wavAudioFile',
			mediaType: 'audio',
			relationshipId: 'rId7',
			isLinked: false,
			name: 'Chime',
			rawXml: raw,
		});
	});

	it('parses linked QuickTime media', () => {
		expect(parseDrawingMediaReference({ 'a:quickTimeFile': { '@_r:link': 'rId9' } })).toMatchObject(
			{
				kind: 'quickTimeFile',
				mediaType: 'video',
				relationshipId: 'rId9',
				isLinked: true,
			},
		);
	});

	it('parses Audio CD start and end positions', () => {
		const result = parseDrawingMediaReference({
			'a:audioCd': {
				'a:st': { '@_track': '2', '@_time': '1500' },
				'a:end': { '@_track': '4', '@_time': '2500' },
			},
		});
		expect(result?.audioCdStart).toStrictEqual({ track: 2, time: 1500 });
		expect(result?.audioCdEnd).toStrictEqual({ track: 4, time: 2500 });
	});

	it('serializes dirty Audio CD positions while preserving extensions', () => {
		const container: XmlObject = { 'a:audioFile': { '@_r:link': 'old' } };
		const element = {
			type: 'media',
			mediaReferenceKind: 'audioCd',
			audioCdStart: { track: 3, time: 100 },
			audioCdEnd: { track: 5, time: 200 },
			rawMediaReferenceXml: { 'a:extLst': { 'a:ext': { '@_uri': 'keep' } } },
		} as MediaPptxElement;
		applyDrawingMediaReference(container, element);
		expect(container['a:audioFile']).toBeUndefined();
		expect(container['a:audioCd']).toStrictEqual({
			'a:extLst': { 'a:ext': { '@_uri': 'keep' } },
			'a:st': { '@_track': '3', '@_time': '100' },
			'a:end': { '@_track': '5', '@_time': '200' },
		});
	});

	it('serializes WAV and QuickTime relationship attributes correctly', () => {
		const wav: XmlObject = {};
		applyDrawingMediaReference(
			wav,
			{
				type: 'media',
				mediaReferenceKind: 'wavAudioFile',
				mediaReferenceName: 'Bell',
			} as MediaPptxElement,
			'rId1',
		);
		expect(wav['a:wavAudioFile']).toStrictEqual({ '@_r:embed': 'rId1', '@_name': 'Bell' });

		const quickTime: XmlObject = {};
		applyDrawingMediaReference(
			quickTime,
			{
				type: 'media',
				mediaReferenceKind: 'quickTimeFile',
			} as MediaPptxElement,
			'rId2',
		);
		expect(quickTime['a:quickTimeFile']).toStrictEqual({ '@_r:link': 'rId2' });
	});
});
