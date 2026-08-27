/**
 * Legacy .ppt import integration tests.
 *
 * Fixture provenance: the .ppt files in ../fixtures were generated on this
 * machine with PowerPoint COM automation (SaveAs FileFormat 1 =
 * ppSaveAsPresentation97) from the corresponding .pptx decks:
 *   - sample-deck.ppt        <- e2e/fixtures/sample-deck.pptx
 *   - text-features.ppt      <- e2e/fixtures/text-features.pptx
 *   - picture-fixture.ppt(x) <- authored via COM (picture + shape + textbox)
 *   - encrypted.ppt          <- sample-deck.pptx with Password="secret" (per
 *                               the commit that added it). That password does
 *                               not verify against the documented
 *                               [MS-OFFCRYPTO] 2.3.5.1 key derivation despite
 *                               an extensive parameter search (iteration
 *                               count, password encoding, salt/password
 *                               order, hash algorithm), so its real password
 *                               could not be recovered; it is only used below
 *                               to exercise the "needs a password" and "wrong
 *                               password" error paths. The successful
 *                               decryption round trip uses a synthetic
 *                               encrypted .ppt built from sample-deck.ppt
 *                               with a known password (see
 *                               legacy-ppt-encryption-fixture.ts).
 *
 * The tests assert that loading the .ppt through the same PptxHandler API
 * produces a model equivalent to loading the original .pptx.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxData, PptxSlide } from '../../core/types/presentation';
import { EncryptedFileError, IncorrectPasswordError } from '../../core/utils';
import { buildSyntheticEncryptedPpt } from './legacy-ppt-encryption-fixture';

const FIXTURES = path.resolve(__dirname, '../fixtures');
const E2E_FIXTURES = path.resolve(__dirname, '../../../../../e2e/fixtures');

function fixtureBuffer(fullPath: string): ArrayBuffer {
	const buf = readFileSync(fullPath);
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function load(fullPath: string): Promise<{ handler: PptxHandler; data: PptxData }> {
	const handler = new PptxHandler();
	const data = await handler.load(fixtureBuffer(fullPath));
	return { handler, data };
}

/** Normalized, sorted visible text of a slide (groups included). */
function slideTexts(slide: PptxSlide): string[] {
	const texts: string[] = [];
	const walk = (elements: PptxSlide['elements']): void => {
		for (const element of elements) {
			const record = element as unknown as Record<string, unknown>;
			if (typeof record.text === 'string' && record.text.trim().length > 0) {
				texts.push(record.text.replace(/\s+/g, ' ').trim());
			}
			if (Array.isArray(record.elements)) {
				walk(record.elements as PptxSlide['elements']);
			}
		}
	};
	walk(slide.elements);
	return texts.sort();
}

describe('legacy .ppt import (sample-deck)', () => {
	it('matches the original .pptx deck structure and content', async () => {
		const { data: fromPpt } = await load(path.join(FIXTURES, 'sample-deck.ppt'));
		const { data: fromPptx } = await load(path.join(E2E_FIXTURES, 'sample-deck.pptx'));

		// Slide count and slide size match exactly.
		expect(fromPpt.slides).toHaveLength(fromPptx.slides.length);
		expect(fromPpt.widthEmu).toBe(fromPptx.widthEmu);
		expect(fromPpt.heightEmu).toBe(fromPptx.heightEmu);

		for (let i = 0; i < fromPpt.slides.length; i++) {
			const pptSlide = fromPpt.slides[i];
			const pptxSlide = fromPptx.slides[i];

			// Per-slide text content matches (normalized).
			expect(slideTexts(pptSlide), `slide ${i + 1} texts`).toStrictEqual(slideTexts(pptxSlide));

			// Element counts are in the same ballpark (within 25% or 2).
			const tolerance = Math.max(2, Math.ceil(pptxSlide.elements.length * 0.25));
			expect(
				Math.abs(pptSlide.elements.length - pptxSlide.elements.length),
				`slide ${i + 1} element count`,
			).toBeLessThanOrEqual(tolerance);
		}
	});

	it('imports shape positions within tolerance of the original', async () => {
		const { data: fromPpt } = await load(path.join(FIXTURES, 'sample-deck.ppt'));
		const { data: fromPptx } = await load(path.join(E2E_FIXTURES, 'sample-deck.pptx'));

		// Match elements by their text and compare geometry (px units in the
		// model; master units are 1/576 inch so allow a 2px rounding window).
		for (let i = 0; i < fromPpt.slides.length; i++) {
			const byText = new Map<string, Record<string, number>>();
			for (const element of fromPptx.slides[i].elements) {
				const record = element as unknown as Record<string, unknown>;
				if (typeof record.text === 'string' && record.text.trim()) {
					byText.set(record.text.replace(/\s+/g, ' ').trim(), {
						x: element.x,
						y: element.y,
						width: element.width,
						height: element.height,
					});
				}
			}
			for (const element of fromPpt.slides[i].elements) {
				const record = element as unknown as Record<string, unknown>;
				const key = typeof record.text === 'string' ? record.text.replace(/\s+/g, ' ').trim() : '';
				const reference = key ? byText.get(key) : undefined;
				if (!reference) {
					continue;
				}
				expect(Math.abs(element.x - reference.x), `slide ${i + 1} "${key}" x`).toBeLessThanOrEqual(
					2,
				);
				expect(Math.abs(element.y - reference.y), `slide ${i + 1} "${key}" y`).toBeLessThanOrEqual(
					2,
				);
				expect(
					Math.abs(element.width - reference.width),
					`slide ${i + 1} "${key}" width`,
				).toBeLessThanOrEqual(2);
				expect(
					Math.abs(element.height - reference.height),
					`slide ${i + 1} "${key}" height`,
				).toBeLessThanOrEqual(2);
			}
		}
	});

	it('imports text-features.ppt with matching per-slide text', async () => {
		const { data: fromPpt } = await load(path.join(FIXTURES, 'text-features.ppt'));
		const { data: fromPptx } = await load(path.join(E2E_FIXTURES, 'text-features.pptx'));
		expect(fromPpt.slides).toHaveLength(fromPptx.slides.length);
		for (let i = 0; i < fromPpt.slides.length; i++) {
			// The slide-number field renders as "*" in the binary format; both
			// sides are normalized to ignore that placeholder difference.
			const normalize = (texts: string[]): string[] =>
				texts.map((t) => t.replace(/Slide [#*]/g, 'Slide N'));
			expect(normalize(slideTexts(fromPpt.slides[i])), `slide ${i + 1}`).toStrictEqual(
				normalize(slideTexts(fromPptx.slides[i])),
			);
		}
	});
});

describe('legacy .ppt import (pictures)', () => {
	it('extracts an on-slide picture with matching geometry and bytes', async () => {
		const { handler, data } = await load(path.join(FIXTURES, 'picture-fixture.ppt'));
		const { handler: refHandler, data: refData } = await load(
			path.join(FIXTURES, 'picture-fixture.pptx'),
		);

		const picture = data.slides[0].elements.find((e) => e.type === 'picture');
		const reference = refData.slides[0].elements.find((e) => e.type === 'picture');
		expect(picture).toBeDefined();
		expect(reference).toBeDefined();
		if (!picture || !reference) {
			return;
		}

		expect(Math.abs(picture.x - reference.x)).toBeLessThanOrEqual(2);
		expect(Math.abs(picture.y - reference.y)).toBeLessThanOrEqual(2);
		expect(Math.abs(picture.width - reference.width)).toBeLessThanOrEqual(2);
		expect(Math.abs(picture.height - reference.height)).toBeLessThanOrEqual(2);

		const imagePath = (picture as unknown as { imagePath?: string }).imagePath;
		const referencePath = (reference as unknown as { imagePath?: string }).imagePath;
		expect(imagePath).toBeDefined();
		const bytes = imagePath ? await handler.getMediaArrayBuffer(imagePath) : undefined;
		const referenceBytes = referencePath
			? await refHandler.getMediaArrayBuffer(referencePath)
			: undefined;
		expect(bytes).toBeDefined();
		expect(referenceBytes).toBeDefined();
		if (!bytes || !referenceBytes) {
			return;
		}
		// PNG payload extracted from the Pictures stream is byte-identical.
		expect(new Uint8Array(bytes)).toStrictEqual(new Uint8Array(referenceBytes));
	});

	it('imports solid shape fills faithfully', async () => {
		const { data } = await load(path.join(FIXTURES, 'picture-fixture.ppt'));
		const shapes = data.slides[0].elements.filter((e) => e.type === 'shape');
		const filled = shapes
			.map((s) => (s as unknown as { shapeStyle?: { fillColor?: string } }).shapeStyle?.fillColor)
			.filter((c) => c && c !== 'transparent');
		expect(filled).toContain('#4080C0');
	});
});

describe('legacy .ppt import (error cases)', () => {
	it('asks for a password when a password-protected .ppt is loaded without one', async () => {
		const handler = new PptxHandler();
		await expect(handler.load(fixtureBuffer(path.join(FIXTURES, 'encrypted.ppt')))).rejects.toThrow(
			EncryptedFileError,
		);
		await expect(handler.load(fixtureBuffer(path.join(FIXTURES, 'encrypted.ppt')))).rejects.toThrow(
			/password-protected PowerPoint 97-2003/,
		);
	});

	it('rejects a wrong password for a password-protected .ppt with IncorrectPasswordError', async () => {
		const handler = new PptxHandler();
		await expect(
			handler.load(fixtureBuffer(path.join(FIXTURES, 'encrypted.ppt')), {
				password: 'definitely-the-wrong-password',
			}),
		).rejects.toThrow(IncorrectPasswordError);
	}, // machine, so it gets extra headroom. // this one has run past that budget when the suite saturates the // tests in ooxml-crypto.test.ts budget 120s for the same reason, and // ([MS-OFFCRYPTO] 2.3.6.2); the existing real-fixture Standard/Agile // A single password check is one 50,000-iteration SHA-1 key derivation
	180_000);

	it('rejects an OLE2 file that is not a presentation', async () => {
		// Corrupt the stream directory name lookup by using an encrypted OOXML
		// container path: an OLE2 file without a PowerPoint Document stream and
		// without a password falls into the encrypted-OOXML branch.
		const handler = new PptxHandler();
		const garbage = new Uint8Array(64);
		garbage.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
		await expect(handler.load(garbage.buffer as ArrayBuffer)).rejects.toThrow();
	});
});

describe('legacy .ppt import (RC4 decryption round trip)', () => {
	// `encrypted.ppt`'s real password could not be recovered (see
	// legacy-ppt-encryption-fixture.ts), so this exercises the real
	// decryption pipeline end to end against a synthetic encrypted .ppt built
	// from the plain `sample-deck.ppt` fixture with a password we control.
	// Built once (not per-test): each build pays for one 50,000-iteration
	// SHA-1 key derivation, which is the expensive part of MS-OFFCRYPTO
	// 2.3.6.2 password key generation.
	const PASSWORD = 'r0undtr!p-Secret';
	let encryptedBuffer: ArrayBuffer;

	beforeAll(async () => {
		const plainBuffer = fixtureBuffer(path.join(FIXTURES, 'sample-deck.ppt'));
		encryptedBuffer = await buildSyntheticEncryptedPpt(plainBuffer, PASSWORD);
	}, 180_000);

	it('decrypts a password-protected .ppt and matches the plain deck', async () => {
		const plainHandler = new PptxHandler();
		const plainData = await plainHandler.load(
			fixtureBuffer(path.join(FIXTURES, 'sample-deck.ppt')),
		);

		const encryptedHandler = new PptxHandler();
		const decryptedData = await encryptedHandler.load(encryptedBuffer, { password: PASSWORD });

		expect(decryptedData.isPasswordProtected).toBeTruthy();
		expect(decryptedData.slides).toHaveLength(plainData.slides.length);
		expect(decryptedData.slides.map(slideTexts)).toStrictEqual(plainData.slides.map(slideTexts));
	}, 180_000);

	it('rejects a wrong password for the synthetic encrypted .ppt', async () => {
		const handler = new PptxHandler();
		await expect(handler.load(encryptedBuffer, { password: 'not-the-password' })).rejects.toThrow(
			IncorrectPasswordError,
		);
	}, 180_000);

	it('asks for a password when the synthetic encrypted .ppt is loaded without one', async () => {
		const handler = new PptxHandler();
		await expect(handler.load(encryptedBuffer)).rejects.toThrow(EncryptedFileError);
	});
});
