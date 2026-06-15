/**
 * signatures.service.test.ts — Unit tests for the SignaturesService signals.
 *
 * Mirrors the reactive-source assertions of the Vue `useSignatures.test.ts`
 * (the Angular equivalent of a changing ref is calling `setSignatures`).
 * No TestBed — the service has no DI dependencies, so it is constructed
 * directly.
 */

import type { ParsedSignature, SignatureStatus } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { SignaturesService } from './signatures.service';

function sig(status: SignatureStatus, overrides: Partial<ParsedSignature> = {}): ParsedSignature {
	return {
		signaturePath: '_xmlsignatures/sig1.xml',
		status,
		references: [],
		...overrides,
	} satisfies ParsedSignature;
}

describe('signaturesService', () => {
	it('reports unsigned before any signatures are set', () => {
		const svc = new SignaturesService();
		expect(svc.signatures()).toStrictEqual([]);
		expect(svc.isSigned()).toBeFalsy();
		expect(svc.status()).toBeUndefined();
		expect(svc.overall()).toBe('unsigned');
		expect(svc.signatureCount()).toBe(0);
	});

	it('reports signed/valid when all signatures are valid', () => {
		const svc = new SignaturesService();
		svc.setSignatures([sig('valid'), sig('valid')]);
		expect(svc.isSigned()).toBeTruthy();
		expect(svc.status()).toBe('valid');
		expect(svc.overall()).toBe('signed');
		expect(svc.signatureCount()).toBe(2);
	});

	it('picks the worst status (worst-wins aggregation)', () => {
		const svc = new SignaturesService();
		svc.setSignatures([sig('valid'), sig('expired'), sig('unverified')]);
		expect(svc.status()).toBe('expired');
		expect(svc.overall()).toBe('signed');
	});

	it('classifies an invalid signature as overall invalid', () => {
		const svc = new SignaturesService();
		svc.setSignatures([sig('valid'), sig('invalid')]);
		expect(svc.status()).toBe('invalid');
		expect(svc.overall()).toBe('invalid');
	});

	it('reacts to a changing source via setSignatures', () => {
		const svc = new SignaturesService();
		expect(svc.isSigned()).toBeFalsy();
		svc.setSignatures([sig('valid')]);
		expect(svc.isSigned()).toBeTruthy();
		expect(svc.overall()).toBe('signed');
		svc.setSignatures([sig('invalid')]);
		expect(svc.overall()).toBe('invalid');
	});

	it('treats null/undefined input as an empty list', () => {
		const svc = new SignaturesService();
		svc.setSignatures([sig('valid')]);
		svc.setSignatures(null);
		expect(svc.signatures()).toStrictEqual([]);
		expect(svc.overall()).toBe('unsigned');
		svc.setSignatures(undefined);
		expect(svc.signatureCount()).toBe(0);
	});

	it('copies the input so external mutation does not leak in', () => {
		const svc = new SignaturesService();
		const src = [sig('valid')];
		svc.setSignatures(src);
		src.push(sig('invalid'));
		expect(svc.signatureCount()).toBe(1);
		expect(svc.overall()).toBe('signed');
	});

	it('clear() resets to the unsigned state', () => {
		const svc = new SignaturesService();
		svc.setSignatures([sig('valid')]);
		svc.clear();
		expect(svc.isSigned()).toBeFalsy();
		expect(svc.signatures()).toStrictEqual([]);
	});
});
