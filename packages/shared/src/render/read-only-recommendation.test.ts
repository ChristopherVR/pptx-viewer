import { describe, expect, it } from 'vitest';

import { readOnlyRecommendation } from './read-only-recommendation';

describe('readOnlyRecommendation', () => {
	it('returns null recommendation for an unprotected, unmarked deck', () => {
		expect(readOnlyRecommendation({})).toStrictEqual({
			kind: null,
			messageKey: '',
			defaultReadOnly: false,
			requiresPassword: false,
		});
	});

	it('recommends read-only for a modifyVerifier with hash data but no salt (unverifiable)', () => {
		const result = readOnlyRecommendation({
			modifyVerifier: { hashData: 'abc==', algorithmName: 'SHA-512' },
		});
		expect(result.kind).toBe('modifyVerifier');
		expect(result.messageKey).toBe('pptx.readOnly.modifyVerifierRecommended');
		expect(result.defaultReadOnly).toBeTruthy();
		// No saltData: this viewer cannot run the hash, so "Edit anyway" stays plain.
		expect(result.requiresPassword).toBeFalsy();
	});

	it('requires a password for a modifyVerifier with a full, checkable hash', () => {
		const result = readOnlyRecommendation({
			modifyVerifier: { hashData: 'abc==', saltData: 'def==', algorithmName: 'SHA-512' },
		});
		expect(result.kind).toBe('modifyVerifier');
		expect(result.defaultReadOnly).toBeTruthy();
		expect(result.requiresPassword).toBeTruthy();
	});

	it('requires a password for the form PowerPoint itself writes (cryptAlgorithmSid, no algorithmName)', () => {
		// PowerPoint's own "Set Password to Modify" (COM `Presentation.
		// WritePassword`) writes ONLY `cryptAlgorithmSid`, never `algorithmName`.
		// Without resolving that legacy CAPI id, a real PowerPoint-authored
		// modify-protected deck would never require its password here.
		const result = readOnlyRecommendation({
			modifyVerifier: { hashData: 'abc==', saltData: 'def==', cryptAlgorithmSid: 14 },
		});
		expect(result.kind).toBe('modifyVerifier');
		expect(result.requiresPassword).toBeTruthy();
	});

	it('does not require a password for an unrecognised cryptAlgorithmSid', () => {
		const result = readOnlyRecommendation({
			modifyVerifier: { hashData: 'abc==', saltData: 'def==', cryptAlgorithmSid: 9999 },
		});
		expect(result.kind).toBe('modifyVerifier');
		expect(result.requiresPassword).toBeFalsy();
	});

	it('recommends read-only for _MarkAsFinal="true"', () => {
		const result = readOnlyRecommendation({
			customProperties: [{ name: '_MarkAsFinal', value: 'true', type: 'bool' }],
		});
		expect(result.kind).toBe('markedFinal');
		expect(result.messageKey).toBe('pptx.readOnly.markedFinal');
		expect(result.defaultReadOnly).toBeTruthy();
		expect(result.requiresPassword).toBeFalsy();
	});

	it('accepts the "1" and "yes" spellings PowerPoint may write', () => {
		expect(
			readOnlyRecommendation({ customProperties: [{ name: '_MarkAsFinal', value: '1' }] }).kind,
		).toBe('markedFinal');
		expect(
			readOnlyRecommendation({ customProperties: [{ name: '_MarkAsFinal', value: 'yes' }] }).kind,
		).toBe('markedFinal');
	});

	it('ignores a falsy _MarkAsFinal value', () => {
		expect(
			readOnlyRecommendation({ customProperties: [{ name: '_MarkAsFinal', value: 'false' }] }).kind,
		).toBeNull();
	});

	it('ignores unrelated custom properties', () => {
		expect(
			readOnlyRecommendation({ customProperties: [{ name: 'Department', value: 'Engineering' }] })
				.kind,
		).toBeNull();
	});

	it('prefers modifyVerifier over markedFinal when both are present', () => {
		const result = readOnlyRecommendation({
			modifyVerifier: { hashData: 'abc==' },
			customProperties: [{ name: '_MarkAsFinal', value: 'true' }],
		});
		expect(result.kind).toBe('modifyVerifier');
	});

	it('ignores an empty modifyVerifier object', () => {
		expect(readOnlyRecommendation({ modifyVerifier: {} }).kind).toBeNull();
	});

	// "Unrecognised verifier algorithms are not checked" limitation: MD2, MD4,
	// MD5, RIPEMD-128, RIPEMD-160 and WHIRLPOOL are legal `algorithmName`
	// values (ECMA-376 19.2.1.22) core can now digest via pure-TypeScript
	// implementations, so `requiresPassword` must go through the same
	// resolver `checkModifyPassword` uses and agree with it, not report a
	// password requirement this viewer then cannot actually verify.
	it.each(['MD2', 'MD4', 'MD5', 'RIPEMD-128', 'RIPEMD-160', 'WHIRLPOOL'])(
		'requires a password for a %s-named verifier with hash and salt',
		(algorithmName) => {
			const result = readOnlyRecommendation({
				modifyVerifier: { hashData: 'abc==', saltData: 'def==', algorithmName },
			});
			expect(result.kind).toBe('modifyVerifier');
			expect(result.requiresPassword).toBeTruthy();
		},
	);

	it('accepts hyphen-less and lower-case algorithmName spellings the same as canonical ones', () => {
		const result = readOnlyRecommendation({
			modifyVerifier: { hashData: 'abc==', saltData: 'def==', algorithmName: 'ripemd160' },
		});
		expect(result.requiresPassword).toBeTruthy();
	});

	it('tolerates undefined data', () => {
		expect(readOnlyRecommendation(undefined).kind).toBeNull();
	});
});
