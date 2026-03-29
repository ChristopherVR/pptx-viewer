import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { inspectPptxDigitalSignatures } from './inspection';

// ---------------------------------------------------------------------------
// inspectPptxDigitalSignatures
// ---------------------------------------------------------------------------

describe('inspectPptxDigitalSignatures', () => {
	it('returns "invalid-package" for non-ZIP data', async () => {
		const result = await inspectPptxDigitalSignatures(new Uint8Array([0x00, 0x01, 0x02, 0x03]));
		expect(result.verificationStatus).toBe('invalid-package');
		expect(result.hasSignature).toBeFalsy();
		expect(result.signatureCount).toBe(0);
		expect(result.error).toBeDefined();
	});

	it('returns "invalid-package" for empty data', async () => {
		const result = await inspectPptxDigitalSignatures(new Uint8Array([]));
		expect(result.verificationStatus).toBe('invalid-package');
	});

	it('returns "unsigned" for a minimal valid ZIP with no signatures', async () => {
		const zip = new JSZip();
		zip.file('test.txt', 'hello');
		const data = await zip.generateAsync({ type: 'uint8array' });
		const result = await inspectPptxDigitalSignatures(data);

		expect(result.verificationStatus).toBe('unsigned');
		expect(result.hasSignature).toBeFalsy();
		expect(result.signatureCount).toBe(0);
		expect(result.signaturePaths).toStrictEqual([]);
		expect(result.supported).toBeTruthy();
	});

	it('returns "unsigned" for a ZIP with non-signature XML files', async () => {
		const zip = new JSZip();
		zip.file('[Content_Types].xml', '<Types/>');
		zip.file('ppt/presentation.xml', '<Presentation/>');
		const data = await zip.generateAsync({ type: 'uint8array' });
		const result = await inspectPptxDigitalSignatures(data);

		expect(result.verificationStatus).toBe('unsigned');
		expect(result.hasSignature).toBeFalsy();
	});
});
