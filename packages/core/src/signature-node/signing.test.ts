import { describe, it, expect, expectTypeOf } from 'vitest';

import { signPptxWithCertificate } from './signing';

// ---------------------------------------------------------------------------
// signPptxWithCertificate
// ---------------------------------------------------------------------------

describe('signPptxWithCertificate', () => {
	it('is exported as a function', () => {
		expectTypeOf(signPptxWithCertificate).toBeFunction();
	});

	it('returns error report for invalid data', async () => {
		const result = await signPptxWithCertificate(new Uint8Array([0]), new Uint8Array([0]), {
			certificatePath: 'test.pem',
		});
		expect(result.success).toBeFalsy();
		expect(result.report.verificationStatus).toBe('error');
	});

	it('returns error report for empty data', async () => {
		const result = await signPptxWithCertificate(new Uint8Array([]), new Uint8Array([]), {
			certificatePath: 'test.pfx',
		});
		expect(result.success).toBeFalsy();
		expect(result.report.verificationStatus).toBe('error');
		expect(result.error).toBeDefined();
	});

	it('error report has correct structure', async () => {
		const result = await signPptxWithCertificate(new Uint8Array([0xff]), new Uint8Array([0xff]), {
			certificatePath: 'cert.pem',
		});
		expect(result.report).toMatchObject({
			supported: true,
			hasSignature: false,
			signatureCount: 0,
			signaturePaths: [],
		});
	});
});
