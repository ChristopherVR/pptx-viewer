import { describe, expect, it } from 'vitest';

import type { MediaPptxElement, PptxNativeAnimation } from '../types';
import { attachRealMediaDurations } from './native-animation-media-duration';

function wavBytes(durationMs: number): Uint8Array {
	const sampleRate = 8000;
	const byteRate = sampleRate; // mono, 8-bit
	const dataSize = Math.round((byteRate * durationMs) / 1000);
	const buf = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buf);
	const writeAscii = (offset: number, s: string) => {
		for (let i = 0; i < s.length; i++) {
			view.setUint8(offset + i, s.charCodeAt(i));
		}
	};
	writeAscii(0, 'RIFF');
	view.setUint32(4, 36 + dataSize, true);
	writeAscii(8, 'WAVE');
	writeAscii(12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, byteRate, true);
	view.setUint16(32, 1, true);
	view.setUint16(34, 8, true);
	writeAscii(36, 'data');
	view.setUint32(40, dataSize, true);
	return new Uint8Array(buf);
}

function mediaElement(id: string, mediaPath: string): MediaPptxElement {
	return {
		id: 'el-1',
		type: 'media',
		mediaType: 'audio',
		mediaPath,
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		rawXml: { 'p:nvPicPr': { 'p:cNvPr': { '@_id': id } } },
	} as unknown as MediaPptxElement;
}

describe('attachRealMediaDurations', () => {
	it("overwrites the media animation's durationMs and stamps element.metadata.duration from real bytes", async () => {
		const element = mediaElement('7', 'ppt/media/audio1.wav');
		const mediaAnim: PptxNativeAnimation = {
			kind: 'media',
			mediaType: 'audio',
			targetId: '7',
			nodeId: 3,
			durationMs: 999999, // PowerPoint's stale authored estimate
		} as PptxNativeAnimation;

		await attachRealMediaDurations([element], [mediaAnim], async (path) => {
			expect(path).toBe('ppt/media/audio1.wav');
			return wavBytes(2000);
		});

		expect(mediaAnim.durationMs).toBeCloseTo(2000, 0);
		expect(element.metadata?.duration).toBeCloseTo(2, 2);
	});

	it('patches an onStopAudio condition (by @tn) elsewhere with the real duration', async () => {
		const element = mediaElement('7', 'ppt/media/audio1.wav');
		const mediaAnim: PptxNativeAnimation = {
			kind: 'media',
			mediaType: 'audio',
			targetId: '7',
			nodeId: 3,
		} as PptxNativeAnimation;
		const dependentAnim: PptxNativeAnimation = {
			targetId: 'shape-2',
			startConditions: [{ event: 'onStopAudio', targetTimeNodeId: 3, delay: 12345 }],
		} as PptxNativeAnimation;

		await attachRealMediaDurations([element], [mediaAnim, dependentAnim], async () =>
			wavBytes(1500),
		);

		expect(dependentAnim.startConditions![0]!.delay).toBeCloseTo(1500, 0);
	});

	it('patches an onStopAudio condition named by shape id (p:tgtEl/p:spTgt) too', async () => {
		const element = mediaElement('7', 'ppt/media/audio1.wav');
		const mediaAnim: PptxNativeAnimation = {
			kind: 'media',
			mediaType: 'audio',
			targetId: '7',
			// No nodeId this time: only the shape-targeted condition form applies.
		} as PptxNativeAnimation;
		const dependentAnim: PptxNativeAnimation = {
			targetId: 'shape-2',
			endConditions: [{ event: 'onStopAudio', targetShapeId: '7', delay: 999 }],
		} as PptxNativeAnimation;

		await attachRealMediaDurations([element], [mediaAnim, dependentAnim], async () =>
			wavBytes(750),
		);

		expect(dependentAnim.endConditions![0]!.delay).toBeCloseTo(750, 0);
	});

	it('leaves everything untouched when the media bytes cannot be decoded', async () => {
		const element = mediaElement('7', 'ppt/media/mystery.bin');
		const mediaAnim: PptxNativeAnimation = {
			kind: 'media',
			mediaType: 'audio',
			targetId: '7',
			durationMs: 4000,
		} as PptxNativeAnimation;

		await attachRealMediaDurations([element], [mediaAnim], async () => new Uint8Array([1, 2, 3]));

		expect(mediaAnim.durationMs).toBe(4000);
		expect(element.metadata).toBeUndefined();
	});

	it('leaves everything untouched when the media part cannot be read at all', async () => {
		const element = mediaElement('7', 'ppt/media/gone.wav');
		const mediaAnim: PptxNativeAnimation = {
			kind: 'media',
			mediaType: 'audio',
			targetId: '7',
			durationMs: 4000,
		} as PptxNativeAnimation;

		await attachRealMediaDurations([element], [mediaAnim], async () => undefined);

		expect(mediaAnim.durationMs).toBe(4000);
	});

	it('is a no-op with no native animations', async () => {
		await expect(
			attachRealMediaDurations([], undefined, async () => undefined),
		).resolves.toBeUndefined();
	});
});
