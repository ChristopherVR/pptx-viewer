// oxlint-disable react-hooks/rules-of-hooks
import type { ParsedSignature, SignatureStatus } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { useSignatures } from './useSignatures';

function sig(status: SignatureStatus, overrides: Partial<ParsedSignature> = {}): ParsedSignature {
	return {
		signaturePath: '_xmlsignatures/sig1.xml',
		status,
		references: [],
		...overrides,
	};
}

describe('useSignatures', () => {
	it('reports unsigned for an empty list', () => {
		const { signatures, isSigned, status, overall } = useSignatures([]);
		expect(signatures.value).toStrictEqual([]);
		expect(isSigned.value).toBeFalsy();
		expect(status.value).toBeUndefined();
		expect(overall.value).toBe('unsigned');
	});

	it('reports signed/valid when all signatures are valid', () => {
		const { isSigned, status, overall } = useSignatures([sig('valid'), sig('valid')]);
		expect(isSigned.value).toBeTruthy();
		expect(status.value).toBe('valid');
		expect(overall.value).toBe('signed');
	});

	it('picks the worst status (worst-wins aggregation)', () => {
		const { status, overall } = useSignatures([sig('valid'), sig('expired'), sig('unverified')]);
		expect(status.value).toBe('expired');
		expect(overall.value).toBe('signed');
	});

	it('classifies an invalid signature as overall invalid', () => {
		const { status, overall } = useSignatures([sig('valid'), sig('invalid')]);
		expect(status.value).toBe('invalid');
		expect(overall.value).toBe('invalid');
	});

	it('ranks unknownCA above unverified but below expired/invalid', () => {
		expect(useSignatures([sig('unverified'), sig('unknownCA')]).status.value).toBe('unknownCA');
		expect(useSignatures([sig('unknownCA'), sig('invalid')]).status.value).toBe('invalid');
	});

	it('reacts to a changing ref source', () => {
		const source = ref<ParsedSignature[]>([]);
		const { isSigned, overall } = useSignatures(source);
		expect(isSigned.value).toBeFalsy();
		source.value = [sig('valid')];
		expect(isSigned.value).toBeTruthy();
		expect(overall.value).toBe('signed');
		source.value = [sig('invalid')];
		expect(overall.value).toBe('invalid');
	});

	it('accepts a getter source backed by a reactive ref', () => {
		const list = ref<ParsedSignature[]>([sig('valid')]);
		const { overall } = useSignatures(() => list.value);
		expect(overall.value).toBe('signed');
		list.value = [];
		expect(overall.value).toBe('unsigned');
	});
});
