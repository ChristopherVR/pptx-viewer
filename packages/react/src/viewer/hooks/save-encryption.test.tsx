/**
 * save-encryption.test.tsx: File > Info > Protect Presentation must produce a
 * file that is actually encrypted.
 *
 * The parity audit found four bindings storing the password and saving a plain
 * ZIP anyway. The decision now lives in the shared `planDeckSave`, and every
 * binding (React included) routes through `saveDeckWithPassword`. This test
 * drives the real `useSerialize` callback and asserts the BYTES it returns:
 * OLE compound-file magic when a password is set, ZIP magic when it is not.
 * Asserting `saveEncrypted` was called would have proved nothing.
 */
import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { PptxHandler as Handler } from 'pptx-viewer-core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { useSerialize } from './useSerialize';
import type { UseSerializeInput } from './useSerialize';

/**
 * Keep the REAL encryptor (the bytes must be a genuine OLE2 container) but drop
 * the agile key derivation from 100,000 rounds to 100. Nothing in the path
 * under test is replaced; full strength just costs tens of seconds per call,
 * which blows the test budget under parallel suite load.
 */
function weakenKeyDerivation(handler: PptxHandler): void {
	const real = handler.saveEncrypted.bind(handler);
	vi.spyOn(handler, 'saveEncrypted').mockImplementation((slides, password, options) =>
		real(slides, password, { ...options, encryption: { spinCount: 100 } }),
	);
}

function buildInput(
	handler: PptxHandler,
	slides: PptxSlide[],
	password: string | undefined,
): UseSerializeInput {
	return {
		slides,
		templateElementsBySlideId: {},
		activeSlideIndex: 0,
		guides: [],
		headerFooter: {},
		presentationProperties: {},
		customShows: [],
		sections: [],
		coreProperties: undefined,
		appProperties: undefined,
		customProperties: [],
		tagCollections: [],
		notesMaster: undefined,
		handoutMaster: undefined,
		handlerRef: { current: handler },
		inlineEditingElementIdRef: { current: null },
		inlineEditingTextRef: { current: '' },
		password,
	};
}

/** Run the hook once (SSR render is enough for a `useCallback`) and grab it. */
function serializerFor(input: UseSerializeInput): () => Promise<Uint8Array | null> {
	let captured: (() => Promise<Uint8Array | null>) | null = null;
	function Harness(): null {
		captured = useSerialize(input);
		return null;
	}
	renderToStaticMarkup(<Harness />);
	if (!captured) {
		throw new Error('useSerialize did not return a callback');
	}
	return captured;
}

describe('useSerialize password protection', () => {
	it('writes an encrypted OLE container when a password is set, a ZIP when not', async () => {
		const { handler, data } = await Handler.create({ initialSlideCount: 1 });
		weakenKeyDerivation(handler);
		try {
			const plain = await serializerFor(buildInput(handler, data.slides, undefined))();
			const secret = await serializerFor(buildInput(handler, data.slides, 'hunter2!A'))();

			expect(plain).not.toBeNull();
			expect(secret).not.toBeNull();
			// "PK\x03\x04": a normal OOXML package.
			expect(Array.from((plain as Uint8Array).slice(0, 4))).toStrictEqual([0x50, 0x4b, 0x03, 0x04]);
			// "D0 CF 11 E0 A1 B1 1A E1": an OLE compound file (EncryptionInfo +
			// EncryptedPackage), which is what a protected .pptx must be.
			expect(Array.from((secret as Uint8Array).slice(0, 8))).toStrictEqual([
				0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
			]);
		} finally {
			handler.dispose();
		}
	}, 30_000);
});
