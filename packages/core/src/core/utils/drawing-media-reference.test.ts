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

	it('parses linked QuickTime media when the relationship is external', () => {
		expect(
			parseDrawingMediaReference({ 'a:quickTimeFile': { '@_r:link': 'rId9' } }, new Set(['rId9'])),
		).toMatchObject({
			kind: 'quickTimeFile',
			mediaType: 'video',
			relationshipId: 'rId9',
			isLinked: true,
		});
	});

	it('treats r:link to an INTERNAL media part as embedded (isLinked false)', () => {
		// Regression for issue #79: embedded media legitimately references an
		// internal media part via r:link; link presence must not imply linked.
		expect(
			parseDrawingMediaReference(
				{ 'a:videoFile': { '@_r:link': 'rId5' } },
				new Set(['rId9']), // rId5 is NOT external
			),
		).toMatchObject({
			kind: 'videoFile',
			mediaType: 'video',
			relationshipId: 'rId5',
			isLinked: false,
		});
	});

	it('treats r:link to an EXTERNAL target as linked', () => {
		expect(
			parseDrawingMediaReference({ 'a:videoFile': { '@_r:link': 'rId5' } }, new Set(['rId5'])),
		).toMatchObject({ kind: 'videoFile', relationshipId: 'rId5', isLinked: true });
	});

	it('treats r:embed video as embedded regardless of external set', () => {
		expect(
			parseDrawingMediaReference({ 'a:videoFile': { '@_r:embed': 'rId5' } }, new Set(['rId5'])),
		).toMatchObject({ kind: 'videoFile', relationshipId: 'rId5', isLinked: false });
	});

	it('treats r:link as embedded when no external-rels set is provided', () => {
		expect(parseDrawingMediaReference({ 'a:videoFile': { '@_r:link': 'rId5' } })).toMatchObject({
			isLinked: false,
		});
	});

	it('parses Audio CD start and end positions', () => {
		const result = parseDrawingMediaReference({
			'a:audioCd': {
				'a:st': { '@_track': '2', '@_time': '1500' },
				'a:end': { '@_track': '4', '@_time': '2500' },
			},
		});
		expect(result?.audioCdStart).toMatchObject({ track: 2, time: 1500 });
		expect(result?.audioCdEnd).toMatchObject({ track: 4, time: 2500 });
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

	it('parses arbitrary element and relationship prefixes', () => {
		const result = parseDrawingMediaReference(
			{
				'd:audioFile': {
					'@_rel:link': 'rId12',
					'@_contentType': 'audio/flac',
					'd:extLst': { 'd:ext': { '@_uri': 'keep' } },
				},
			},
			new Set(['rId12']),
		);
		expect(result).toMatchObject({
			kind: 'audioFile',
			relationshipId: 'rId12',
			isLinked: true,
			contentType: 'audio/flac',
		});
	});

	it('validates Audio CD track and time bounds', () => {
		expect(
			parseDrawingMediaReference({
				'a:audioCd': {
					'a:st': { '@_track': '256' },
					'a:end': { '@_track': '1', '@_time': '4294967296' },
				},
			})?.audioCdStart,
		).toBeUndefined();
		expect(
			parseDrawingMediaReference({
				'a:audioCd': { 'a:st': { '@_track': '0' }, 'a:end': { '@_track': '255' } },
			})?.audioCdEnd,
		).toMatchObject({ track: 255, time: 0 });
	});

	it('preserves position metadata and keeps extLst after required CD children', () => {
		const source: XmlObject = {
			'd:audioCd': {
				'@_vendor': 'root',
				'd:st': { '@_track': '2', '@_vendor': 'start' },
				'd:end': { '@_track': '3', '@_time': '20', '@_vendor': 'end' },
				'd:extLst': { 'd:ext': { '@_uri': 'keep' } },
			},
		};
		const parsed = parseDrawingMediaReference(source)!;
		const element = {
			type: 'media',
			mediaReferenceKind: 'audioCd',
			audioCdStart: { ...parsed.audioCdStart, track: 4 },
			audioCdEnd: parsed.audioCdEnd,
			rawMediaReferenceXml: parsed.rawXml,
		} as MediaPptxElement;
		applyDrawingMediaReference(source, element);
		const cd = source['d:audioCd'] as XmlObject;
		expect(cd['d:st']).toStrictEqual({ '@_track': '4', '@_vendor': 'start' });
		expect(cd['d:end']).toStrictEqual({
			'@_track': '3',
			'@_time': '20',
			'@_vendor': 'end',
		});
		expect(Object.keys(cd).slice(-3)).toStrictEqual(['d:st', 'd:end', 'd:extLst']);
	});

	it('edits audioFile content type without flattening prefixes or extensions', () => {
		const container: XmlObject = {
			'd:audioFile': {
				'@_rel:link': 'old',
				'@_contentType': 'audio/old',
				'd:extLst': { 'd:ext': { '@_uri': 'keep' } },
			},
		};
		applyDrawingMediaReference(
			container,
			{
				type: 'media',
				mediaReferenceKind: 'audioFile',
				mediaReferenceContentType: 'audio/aac',
				rawMediaReferenceXml: container['d:audioFile'] as XmlObject,
			} as MediaPptxElement,
			'rId8',
		);
		expect(container['d:audioFile']).toStrictEqual({
			'@_rel:link': 'rId8',
			'@_contentType': 'audio/aac',
			'd:extLst': { 'd:ext': { '@_uri': 'keep' } },
		});
	});
});
