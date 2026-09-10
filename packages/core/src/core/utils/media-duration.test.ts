import { describe, expect, it } from 'vitest';

import { estimateMediaDurationMs } from './media-duration';
import { estimateAdtsDurationMs } from './media-duration-adts';
import { estimateEbmlDurationMs } from './media-duration-ebml';
import { estimateIsoBmffDurationMs } from './media-duration-isobmff';
import { estimateMp3DurationMs } from './media-duration-mp3';
import { estimateOggDurationMs } from './media-duration-ogg';
import { estimateWavDurationMs } from './media-duration-wav';

function bytesOf(...groups: (number[] | Uint8Array)[]): Uint8Array {
	const parts = groups.map((g) => (g instanceof Uint8Array ? g : new Uint8Array(g)));
	const total = parts.reduce((s, p) => s + p.length, 0);
	const out = new Uint8Array(total);
	let off = 0;
	for (const p of parts) {
		out.set(p, off);
		off += p.length;
	}
	return out;
}

function u32le(v: number): number[] {
	return [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff];
}
function u32be(v: number): number[] {
	return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}
function u16le(v: number): number[] {
	return [v & 0xff, (v >> 8) & 0xff];
}
function ascii(s: string): number[] {
	return Array.from(s).map((c) => c.charCodeAt(0));
}

describe('estimateWavDurationMs', () => {
	it('computes exact duration from byteRate and data chunk size', () => {
		const sampleRate = 44100;
		const byteRate = sampleRate * 4; // 2 channels * 16-bit
		const dataSize = byteRate * 2; // 2 seconds
		const wav = bytesOf(
			ascii('RIFF'),
			u32le(36 + dataSize),
			ascii('WAVE'),
			ascii('fmt '),
			u32le(16),
			u16le(1), // PCM
			u16le(2), // channels
			u32le(sampleRate),
			u32le(byteRate),
			u16le(4), // block align
			u16le(16), // bits per sample
			ascii('data'),
			u32le(dataSize),
			new Uint8Array(dataSize),
		);
		expect(estimateWavDurationMs(wav)).toBeCloseTo(2000, 3);
	});

	it('returns undefined for non-WAV bytes', () => {
		expect(estimateWavDurationMs(new Uint8Array(20))).toBeUndefined();
	});
});

describe('estimateMp3DurationMs', () => {
	// MPEG1 Layer III, 128kbps, 44100Hz, stereo, no CRC: FF FB 90 00.
	const FRAME_HEADER = [0xff, 0xfb, 0x90, 0x00];

	it('estimates CBR duration from bitrate and remaining bytes', () => {
		// 128kbps = 16000 bytes/sec; 16000 audio bytes (incl. header) = 1000ms.
		const audio = bytesOf(FRAME_HEADER, new Uint8Array(16000 - FRAME_HEADER.length));
		expect(estimateMp3DurationMs(audio)).toBeCloseTo(1000, 0);
	});

	it('uses an exact Xing frame count when present', () => {
		const xingTag = bytesOf(
			ascii('Xing'),
			u32be(0x00000001), // flags: frame count present
			u32be(100), // frame count
		);
		const sideInfo = new Uint8Array(32); // stereo MPEG1 side info size
		const mp3 = bytesOf(FRAME_HEADER, sideInfo, xingTag);
		// 100 frames * 1152 samples/frame / 44100 Hz * 1000.
		expect(estimateMp3DurationMs(mp3)).toBeCloseTo(((100 * 1152) / 44100) * 1000, 3);
	});

	it('skips a leading ID3v2 tag', () => {
		const id3 = bytesOf(ascii('ID3'), [4, 0, 0], [0, 0, 0, 10], new Uint8Array(10));
		const audio = bytesOf(FRAME_HEADER, new Uint8Array(16000 - FRAME_HEADER.length));
		expect(estimateMp3DurationMs(bytesOf(id3, audio))).toBeCloseTo(1000, 0);
	});

	it('returns undefined when no frame sync is found', () => {
		expect(estimateMp3DurationMs(new Uint8Array(20))).toBeUndefined();
	});
});

describe('estimateIsoBmffDurationMs', () => {
	function box(type: string, content: number[]): number[] {
		const size = 8 + content.length;
		return [...u32be(size), ...ascii(type), ...content];
	}

	it('reads an mvhd version-0 duration/timescale', () => {
		const mvhd = box('mvhd', [
			0,
			0,
			0,
			0, // version + flags
			...u32be(0), // creation time
			...u32be(0), // modification time
			...u32be(1000), // timescale
			...u32be(5000), // duration
		]);
		const moov = box('moov', mvhd);
		const ftyp = box('ftyp', [...ascii('isom'), ...u32be(0), ...ascii('isom')]);
		const file = new Uint8Array([...ftyp, ...moov]);
		expect(estimateIsoBmffDurationMs(file)).toBeCloseTo(5000, 3);
	});

	it('reads an mvhd version-1 (64-bit) duration', () => {
		const durationHi = 0;
		const durationLo = 7000;
		const mvhd = box('mvhd', [
			1,
			0,
			0,
			0,
			...u32be(0),
			...u32be(0),
			...u32be(0),
			...u32be(0), // 64-bit creation/modification
			...u32be(1000), // timescale
			...u32be(durationHi),
			...u32be(durationLo),
		]);
		const moov = box('moov', mvhd);
		const ftyp = box('ftyp', [...ascii('isom'), ...u32be(0)]);
		const file = new Uint8Array([...ftyp, ...moov]);
		expect(estimateIsoBmffDurationMs(file)).toBeCloseTo(7000, 3);
	});

	it('returns undefined for non-ISOBMFF bytes', () => {
		expect(estimateIsoBmffDurationMs(new Uint8Array(20))).toBeUndefined();
	});
});

describe('estimateOggDurationMs', () => {
	function oggPage(opts: { headerType: number; granule: number; data: number[] }): number[] {
		const granuleLo = opts.granule % 2 ** 32;
		const granuleHi = Math.floor(opts.granule / 2 ** 32);
		const segments = [Math.min(255, opts.data.length)];
		return [
			...ascii('OggS'),
			0, // version
			opts.headerType,
			...u32le(granuleLo),
			...u32le(granuleHi),
			...u32le(1), // serial
			...u32le(0), // page sequence
			...u32le(0), // checksum (unverified)
			segments.length,
			...segments,
			...opts.data,
		];
	}

	it('computes Opus duration from the last page granule position at 48kHz', () => {
		const head = ascii('OpusHead');
		const first = oggPage({ headerType: 0x02, granule: 0, data: head });
		const last = oggPage({ headerType: 0x04, granule: 48000 * 3, data: [] });
		const ogg = new Uint8Array([...first, ...last]);
		expect(estimateOggDurationMs(ogg)).toBeCloseTo(3000, 3);
	});

	it('computes Vorbis duration using the embedded sample rate', () => {
		const idHeader = [
			0x01,
			...ascii('vorbis'),
			...u32le(0), // vorbis_version
			2, // channels
			...u32le(44100), // sample rate
		];
		const first = oggPage({ headerType: 0x02, granule: 0, data: idHeader });
		const last = oggPage({ headerType: 0x04, granule: 44100 * 2, data: [] });
		const ogg = new Uint8Array([...first, ...last]);
		expect(estimateOggDurationMs(ogg)).toBeCloseTo(2000, 3);
	});

	it('returns undefined for non-Ogg bytes', () => {
		expect(estimateOggDurationMs(new Uint8Array(20))).toBeUndefined();
	});
});

describe('estimateEbmlDurationMs', () => {
	function vintSize(value: number): number[] {
		// 1-byte VINT is plenty for this test's tiny element sizes.
		return [0x80 | value];
	}
	function element(idBytes: number[], content: number[]): number[] {
		return [...idBytes, ...vintSize(content.length), ...content];
	}
	function f64be(value: number): number[] {
		const buf = new ArrayBuffer(8);
		new DataView(buf).setFloat64(0, value, false);
		return Array.from(new Uint8Array(buf));
	}

	it('reads Duration * TimecodeScale from Segment/Info', () => {
		const timecodeScale = element([0x2a, 0xd7, 0xb1], u32be(1_000_000));
		const duration = element([0x44, 0x89], f64be(5000));
		const info = element([0x15, 0x49, 0xa9, 0x66], [...timecodeScale, ...duration]);
		const segment = element([0x18, 0x53, 0x80, 0x67], info);
		const ebml = element([0x1a, 0x45, 0xdf, 0xa3], []);
		const file = new Uint8Array([...ebml, ...segment]);
		// TimecodeScale = 1,000,000ns = 1ms/tick, Duration = 5000 ticks -> 5000ms.
		expect(estimateEbmlDurationMs(file)).toBeCloseTo(5000, 3);
	});

	it('returns undefined for non-EBML bytes', () => {
		expect(estimateEbmlDurationMs(new Uint8Array(20))).toBeUndefined();
	});
});

describe('estimateAdtsDurationMs', () => {
	function adtsFrame(frameLength: number, freqIndex = 3 /* 48000 */): number[] {
		return [
			0xff,
			0xf1, // MPEG-4, no CRC
			(1 << 6) | (freqIndex << 2), // profile=1(LC), freqIndex, channel-config high bit
			0x40 | ((frameLength >> 11) & 0x03),
			(frameLength >> 3) & 0xff,
			((frameLength & 0x07) << 5) | 0x1f,
			0xfc,
		];
	}

	it('estimates duration as frameCount * 1024 / sampleRate', () => {
		const frame = adtsFrame(7); // header-only frames (no payload) for simplicity
		const threeFrames = [...frame, ...frame, ...frame];
		// freqIndex 3 -> 48000 Hz; 3 frames * 1024 / 48000 * 1000.
		expect(estimateAdtsDurationMs(new Uint8Array(threeFrames))).toBeCloseTo(
			((3 * 1024) / 48000) * 1000,
			3,
		);
	});

	it('returns undefined for non-ADTS bytes', () => {
		expect(estimateAdtsDurationMs(new Uint8Array(20))).toBeUndefined();
	});
});

describe('estimateMediaDurationMs (dispatcher)', () => {
	it('routes WAV bytes to the WAV estimator', () => {
		const wav = bytesOf(
			ascii('RIFF'),
			u32le(36 + 100),
			ascii('WAVE'),
			ascii('fmt '),
			u32le(16),
			u16le(1),
			u16le(1),
			u32le(8000),
			u32le(8000),
			u16le(1),
			u16le(8),
			ascii('data'),
			u32le(100),
			new Uint8Array(100),
		);
		expect(estimateMediaDurationMs(wav)).toBeCloseTo(12.5, 1);
	});

	it('returns undefined for an unrecognised format', () => {
		expect(estimateMediaDurationMs(new Uint8Array([1, 2, 3, 4, 5]))).toBeUndefined();
	});
});
