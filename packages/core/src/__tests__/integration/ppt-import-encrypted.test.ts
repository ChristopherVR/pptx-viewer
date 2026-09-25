/**
 * Password-protected legacy .ppt import, against files PowerPoint encrypted
 * itself (RC4 CryptoAPI, [MS-OFFCRYPTO] 2.3.5):
 *
 * - encrypted-powerpoint.ppt: authored by
 *   `scripts/make-encrypted-ppt-fixture.ps1` (Password = 'pptx-viewer'), two
 *   slides with a title, a body, a filled rectangle and a PNG, so both the
 *   "PowerPoint Document" persist objects and the "Pictures" stream are
 *   enciphered.
 * - encrypted.ppt: sample-deck.pptx saved by PowerPoint with Password =
 *   'secret'.
 *
 * Both were rejected as a wrong password while the importer derived the key
 * with Standard Encryption's 50,000 SHA-1 spin rounds; the RC4 CryptoAPI
 * derivation has none, so every check here is fast.
 *
 * @module __tests__/integration/ppt-import-encrypted.test
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxSlide } from '../../core/types/presentation';
import { EncryptedFileError, IncorrectPasswordError } from '../../core/utils';

const FIXTURES = path.resolve(__dirname, '../fixtures');
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function fixtureBuffer(name: string): ArrayBuffer {
	const buf = readFileSync(path.join(FIXTURES, name));
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** Normalized, sorted visible text of a slide. */
function slideTexts(slide: PptxSlide): string[] {
	return slide.elements
		.map((e) => (e as { text?: unknown }).text)
		.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
		.map((t) => t.replace(/\s+/g, ' ').trim())
		.sort();
}

describe('password-protected .ppt written by PowerPoint', () => {
	it('opens with the right password and decrypts text, shapes and pictures', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(fixtureBuffer('encrypted-powerpoint.ppt'), {
			password: 'pptx-viewer',
		});
		expect(data.isPasswordProtected).toBeTruthy();
		expect(data.slides).toHaveLength(2);
		const [first, second] = data.slides as [PptxSlide, PptxSlide];
		expect(slideTexts(first).join('|')).toContain('Encrypted by PowerPoint');
		expect(slideTexts(first).join('|')).toContain('First point');
		expect(slideTexts(second)).toContain('Second slide shape');

		const picture = second.elements.find((e) => e.type === 'picture');
		const imagePath = (picture as { imagePath?: string } | undefined)?.imagePath;
		expect(imagePath).toBeDefined();
		const bytes = imagePath ? await handler.getMediaArrayBuffer(imagePath) : undefined;
		expect(bytes).toBeDefined();
		expect(Array.from(new Uint8Array(bytes!).subarray(0, 8))).toStrictEqual(PNG_SIGNATURE);
	});

	it('rejects a wrong password with IncorrectPasswordError', async () => {
		await expect(
			new PptxHandler().load(fixtureBuffer('encrypted-powerpoint.ppt'), { password: 'nope' }),
		).rejects.toThrow(IncorrectPasswordError);
	});

	it('asks for a password when none is given', async () => {
		const load = new PptxHandler().load(fixtureBuffer('encrypted-powerpoint.ppt'));
		await expect(load).rejects.toThrow(EncryptedFileError);
		await expect(new PptxHandler().load(fixtureBuffer('encrypted.ppt'))).rejects.toThrow(
			/password-protected PowerPoint 97-2003/,
		);
	});

	it('opens encrypted.ppt with its documented password and matches the plain deck', async () => {
		const plain = await new PptxHandler().load(fixtureBuffer('sample-deck.ppt'));
		const decrypted = await new PptxHandler().load(fixtureBuffer('encrypted.ppt'), {
			password: 'secret',
		});
		expect(decrypted.slides).toHaveLength(plain.slides.length);
		expect(decrypted.slides.map(slideTexts)).toStrictEqual(plain.slides.map(slideTexts));
	});
});
