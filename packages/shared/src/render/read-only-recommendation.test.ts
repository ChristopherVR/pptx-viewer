import { describe, expect, it } from 'vitest';

import { readOnlyRecommendation } from './read-only-recommendation';

describe('readOnlyRecommendation', () => {
	it('returns null recommendation for an unprotected, unmarked deck', () => {
		expect(readOnlyRecommendation({})).toStrictEqual({
			kind: null,
			messageKey: '',
			defaultReadOnly: false,
		});
	});

	it('recommends read-only for a modifyVerifier with hash data', () => {
		const result = readOnlyRecommendation({
			modifyVerifier: { hashData: 'abc==', algorithmName: 'SHA-512' },
		});
		expect(result.kind).toBe('modifyVerifier');
		expect(result.messageKey).toBe('pptx.readOnly.modifyVerifierRecommended');
		expect(result.defaultReadOnly).toBeTruthy();
	});

	it('recommends read-only for _MarkAsFinal="true"', () => {
		const result = readOnlyRecommendation({
			customProperties: [{ name: '_MarkAsFinal', value: 'true', type: 'bool' }],
		});
		expect(result.kind).toBe('markedFinal');
		expect(result.messageKey).toBe('pptx.readOnly.markedFinal');
		expect(result.defaultReadOnly).toBeTruthy();
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

	it('tolerates undefined data', () => {
		expect(readOnlyRecommendation(undefined).kind).toBeNull();
	});
});
