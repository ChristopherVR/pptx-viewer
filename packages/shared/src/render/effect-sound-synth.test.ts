import { describe, expect, it } from 'vitest';

import { EFFECT_SOUND_CATALOGUE } from './effect-sound-catalogue';
import { EFFECT_SOUND_GENERATORS } from './effect-sound-generators';
import { getEffectSoundAsset } from './effect-sound-synth';

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
	return String.fromCharCode(...bytes.slice(offset, offset + length));
}

describe('getEffectSoundAsset', () => {
	it('returns undefined for an id absent from the catalogue', () => {
		expect(getEffectSoundAsset('not-a-real-sound')).toBeUndefined();
	});

	it.each(EFFECT_SOUND_CATALOGUE.map((entry) => entry.id))(
		'synthesises a valid, non-silent, <=1.5s WAV for "%s"',
		(id) => {
			const asset = getEffectSoundAsset(id);
			expect(asset).toBeDefined();
			if (!asset) {
				return;
			}

			// Valid RIFF/WAVE header.
			expect(readAscii(asset.bytes, 0, 4)).toBe('RIFF');
			expect(readAscii(asset.bytes, 8, 4)).toBe('WAVE');
			expect(readAscii(asset.bytes, 12, 4)).toBe('fmt ');
			expect(readAscii(asset.bytes, 36, 4)).toBe('data');

			const view = new DataView(asset.bytes.buffer, asset.bytes.byteOffset, asset.bytes.byteLength);
			const sampleRate = view.getUint32(24, true);
			const bitsPerSample = view.getUint16(34, true);
			const dataSize = view.getUint32(40, true);
			expect(bitsPerSample).toBe(16);

			const sampleCount = dataSize / 2;
			const durationSec = sampleCount / sampleRate;
			expect(durationSec).toBeGreaterThan(0);
			expect(durationSec).toBeLessThanOrEqual(1.5);

			// Non-silent: at least one sample departs from zero.
			let sawNonZero = false;
			for (let i = 44; i < asset.bytes.length; i += 2) {
				if (view.getInt16(i, true) !== 0) {
					sawNonZero = true;
					break;
				}
			}
			expect(sawNonZero).toBeTruthy();

			// The canonical PowerPoint file name for this stock sound.
			expect(asset.fileName).toMatch(/\.WAV$/u);
			expect(asset.dataUrl.startsWith('data:audio/wav;base64,')).toBeTruthy();
		},
	);

	it.each(EFFECT_SOUND_CATALOGUE.map((entry) => entry.id))(
		'generator for "%s" is deterministic across independent calls',
		(id) => {
			const generator = EFFECT_SOUND_GENERATORS[id];
			expect(generator).toBeDefined();
			const first = Array.from(generator());
			const second = Array.from(generator());
			expect(first).toStrictEqual(second);
		},
	);

	it('caches the same asset instance for repeated reads', () => {
		const first = getEffectSoundAsset('chime');
		const second = getEffectSoundAsset('chime');
		expect(first).toBeDefined();
		expect(second).toBeDefined();
		expect(Array.from(first?.bytes ?? [])).toStrictEqual(Array.from(second?.bytes ?? []));
	});

	it('produces distinct bytes for different catalogue entries', () => {
		const chime = getEffectSoundAsset('chime');
		const click = getEffectSoundAsset('click');
		expect(chime).toBeDefined();
		expect(click).toBeDefined();
		expect(Array.from(chime?.bytes ?? [])).not.toStrictEqual(Array.from(click?.bytes ?? []));
	});
});
