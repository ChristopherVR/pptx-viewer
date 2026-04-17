import { describe, it, expect, expectTypeOf } from 'vitest';

import {
	DIGITAL_SIGNATURE_ORIGIN_REL_TYPE,
	DIGITAL_SIGNATURE_REL_TYPE,
	PPTX_VIEWER_MANIFEST_NS,
	XMLDSIG_NS,
	OPC_RELATIONSHIP_TRANSFORM,
	XML_TRANSFORM_ENVELOPED_SIGNATURE,
	SUPPORTED_XML_CANON_TRANSFORMS,
	ENTERPRISE_TRUST_ROOTS_FILE_ENV,
	ENTERPRISE_TRUST_ROOTS_PEM_ENV,
	ENTERPRISE_REQUIRE_REVOCATION_ENV,
	ENTERPRISE_FAIL_ON_REVOCATION_UNKNOWN_ENV,
	ENTERPRISE_REQUIRE_TIMESTAMP_ENV,
	DIGEST_ALGORITHM_TO_HASH,
	DIGEST_ALGORITHM_TO_WEB_CRYPTO,
} from './signature-constants';

describe('signature-constants', () => {
	describe('relationship type constants', () => {
		it('dIGITAL_SIGNATURE_ORIGIN_REL_TYPE contains digital-signature/origin', () => {
			expectTypeOf(DIGITAL_SIGNATURE_ORIGIN_REL_TYPE).toBeString();
			expect(DIGITAL_SIGNATURE_ORIGIN_REL_TYPE).toContain('digital-signature/origin');
		});

		it('dIGITAL_SIGNATURE_REL_TYPE contains digital-signature/signature', () => {
			expectTypeOf(DIGITAL_SIGNATURE_REL_TYPE).toBeString();
			expect(DIGITAL_SIGNATURE_REL_TYPE).toContain('digital-signature/signature');
		});
	});

	describe('namespace constants', () => {
		it('pPTX_VIEWER_MANIFEST_NS is the expected URN', () => {
			expect(PPTX_VIEWER_MANIFEST_NS).toBe('urn:pptx-viewer:ooxml-signature:v1');
		});

		it('xMLDSIG_NS is the W3C XML Digital Signature namespace', () => {
			expect(XMLDSIG_NS).toBe('http://www.w3.org/2000/09/xmldsig#');
		});
	});

	describe('transform constants', () => {
		it('oPC_RELATIONSHIP_TRANSFORM is defined', () => {
			expectTypeOf(OPC_RELATIONSHIP_TRANSFORM).toBeString();
			expect(OPC_RELATIONSHIP_TRANSFORM).toContain('RelationshipTransform');
		});

		it('xML_TRANSFORM_ENVELOPED_SIGNATURE is defined', () => {
			expectTypeOf(XML_TRANSFORM_ENVELOPED_SIGNATURE).toBeString();
			expect(XML_TRANSFORM_ENVELOPED_SIGNATURE).toContain('enveloped-signature');
		});
	});

	describe('sUPPORTED_XML_CANON_TRANSFORMS', () => {
		it('is a Set with 5 entries', () => {
			expect(SUPPORTED_XML_CANON_TRANSFORMS).toBeInstanceOf(Set);
			expect(SUPPORTED_XML_CANON_TRANSFORMS.size).toBe(5);
		});

		it('includes the C14N 1.0 algorithm', () => {
			expect(
				SUPPORTED_XML_CANON_TRANSFORMS.has('http://www.w3.org/TR/2001/REC-xml-c14n-20010315'),
			).toBeTruthy();
		});

		it('includes the C14N 1.0 with comments algorithm', () => {
			expect(
				SUPPORTED_XML_CANON_TRANSFORMS.has(
					'http://www.w3.org/TR/2001/REC-xml-c14n-20010315#WithComments',
				),
			).toBeTruthy();
		});

		it('includes the exclusive C14N algorithm', () => {
			expect(
				SUPPORTED_XML_CANON_TRANSFORMS.has('http://www.w3.org/2001/10/xml-exc-c14n#'),
			).toBeTruthy();
		});

		it('includes the exclusive C14N with comments algorithm', () => {
			expect(
				SUPPORTED_XML_CANON_TRANSFORMS.has('http://www.w3.org/2001/10/xml-exc-c14n#WithComments'),
			).toBeTruthy();
		});

		it('includes the enveloped signature transform', () => {
			expect(SUPPORTED_XML_CANON_TRANSFORMS.has(XML_TRANSFORM_ENVELOPED_SIGNATURE)).toBeTruthy();
		});
	});

	describe('dIGEST_ALGORITHM_TO_HASH', () => {
		it('maps sha256 URI to sha256', () => {
			expect(DIGEST_ALGORITHM_TO_HASH['http://www.w3.org/2001/04/xmlenc#sha256']).toBe('sha256');
		});

		it('maps sha1 URI to sha1', () => {
			expect(DIGEST_ALGORITHM_TO_HASH['http://www.w3.org/2000/09/xmldsig#sha1']).toBe('sha1');
		});

		it('maps sha384 URI to sha384', () => {
			expect(DIGEST_ALGORITHM_TO_HASH['http://www.w3.org/2001/04/xmlenc#sha384']).toBe('sha384');
		});

		it('maps sha512 URI to sha512', () => {
			expect(DIGEST_ALGORITHM_TO_HASH['http://www.w3.org/2001/04/xmlenc#sha512']).toBe('sha512');
		});
	});

	describe('dIGEST_ALGORITHM_TO_WEB_CRYPTO', () => {
		it('maps sha256 URI to SHA-256', () => {
			expect(DIGEST_ALGORITHM_TO_WEB_CRYPTO['http://www.w3.org/2001/04/xmlenc#sha256']).toBe(
				'SHA-256',
			);
		});

		it('maps sha1 URI to SHA-1', () => {
			expect(DIGEST_ALGORITHM_TO_WEB_CRYPTO['http://www.w3.org/2000/09/xmldsig#sha1']).toBe(
				'SHA-1',
			);
		});

		it('maps sha384 URI to SHA-384', () => {
			expect(DIGEST_ALGORITHM_TO_WEB_CRYPTO['http://www.w3.org/2001/04/xmlenc#sha384']).toBe(
				'SHA-384',
			);
		});

		it('maps sha512 URI to SHA-512', () => {
			expect(DIGEST_ALGORITHM_TO_WEB_CRYPTO['http://www.w3.org/2001/04/xmlenc#sha512']).toBe(
				'SHA-512',
			);
		});
	});

	describe('enterprise environment variable names', () => {
		it('eNTERPRISE_TRUST_ROOTS_FILE_ENV is a defined string', () => {
			expectTypeOf(ENTERPRISE_TRUST_ROOTS_FILE_ENV).toBeString();
			expect(ENTERPRISE_TRUST_ROOTS_FILE_ENV.length).toBeGreaterThan(0);
		});

		it('eNTERPRISE_TRUST_ROOTS_PEM_ENV is a defined string', () => {
			expectTypeOf(ENTERPRISE_TRUST_ROOTS_PEM_ENV).toBeString();
			expect(ENTERPRISE_TRUST_ROOTS_PEM_ENV.length).toBeGreaterThan(0);
		});

		it('eNTERPRISE_REQUIRE_REVOCATION_ENV is a defined string', () => {
			expectTypeOf(ENTERPRISE_REQUIRE_REVOCATION_ENV).toBeString();
			expect(ENTERPRISE_REQUIRE_REVOCATION_ENV.length).toBeGreaterThan(0);
		});

		it('eNTERPRISE_FAIL_ON_REVOCATION_UNKNOWN_ENV is a defined string', () => {
			expectTypeOf(ENTERPRISE_FAIL_ON_REVOCATION_UNKNOWN_ENV).toBeString();
			expect(ENTERPRISE_FAIL_ON_REVOCATION_UNKNOWN_ENV.length).toBeGreaterThan(0);
		});

		it('eNTERPRISE_REQUIRE_TIMESTAMP_ENV is a defined string', () => {
			expectTypeOf(ENTERPRISE_REQUIRE_TIMESTAMP_ENV).toBeString();
			expect(ENTERPRISE_REQUIRE_TIMESTAMP_ENV.length).toBeGreaterThan(0);
		});
	});
});
