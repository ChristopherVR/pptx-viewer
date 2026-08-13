/**
 * The signatures panel must show the certificate name the certificate says.
 *
 * `parseSignaturesFromBuffer` builds its own `XMLParser` rather than going
 * through core's loader, and it used to take fast-xml-parser's defaults.
 * Those decode the five predefined entities but NOT numeric character
 * references, so an `X509IssuerName` written `CN=M&#xFC;ller CA` - which is
 * exactly how a producer escapes a non-ASCII signer name - reached the panel
 * as the literal seven characters `&#xFC;`. Core's parser decodes it, so the
 * two disagreed about what the same certificate said.
 *
 * Angular carries an identical copy of this function and an identical test; they
 * are the only two bindings that read signatures at all.
 */
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { parseSignaturesFromBuffer } from './useLoadContent';

/** A minimal `ds:Signature` part whose DNs are escaped with numeric refs. */
const SIGNATURE_XML =
	'<?xml version="1.0" encoding="UTF-8"?>' +
	'<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">' +
	'<SignedInfo><SignatureMethod Algorithm="rsa-sha256"/>' +
	'<Reference URI="/ppt/presentation.xml"><DigestMethod Algorithm="sha256"/>' +
	'<DigestValue>ZGln</DigestValue></Reference></SignedInfo>' +
	'<SignatureValue>c2ln</SignatureValue>' +
	'<KeyInfo><X509Data>' +
	'<X509Certificate>QUJD</X509Certificate>' +
	'<X509IssuerSerial>' +
	'<X509IssuerName>CN=M&#xFC;ller CA, O=R&amp;D</X509IssuerName>' +
	'<X509SerialNumber>17</X509SerialNumber>' +
	'</X509IssuerSerial>' +
	'<X509SubjectName>CN=Caf&#xE9; Ltd</X509SubjectName>' +
	'</X509Data></KeyInfo></Signature>';

/** Wrap `SIGNATURE_XML` in the ZIP shape the loader looks for. */
async function signedBuffer(xml = SIGNATURE_XML): Promise<ArrayBuffer> {
	const zip = new JSZip();
	zip.file('_xmlsignatures/sig1.xml', xml);
	return zip.generateAsync({ type: 'arraybuffer' });
}

describe('parseSignaturesFromBuffer entity decoding', () => {
	it('decodes numeric character references in certificate names', async () => {
		const [signature] = await parseSignaturesFromBuffer(await signedBuffer());

		expect(signature).toBeDefined();
		expect(signature.certificate?.issuer).toBe('CN=Müller CA, O=R&D');
		expect(signature.certificate?.subject).toBe('CN=Café Ltd');
	});

	it('does not double-decode a predefined entity', async () => {
		// `&amp;amp;` is a literal "&amp;" in the DN, not a second escape to peel.
		const [signature] = await parseSignaturesFromBuffer(
			await signedBuffer(SIGNATURE_XML.replace('O=R&amp;D', 'O=R&amp;amp;D')),
		);

		expect(signature.certificate?.issuer).toBe('CN=Müller CA, O=R&amp;D');
	});

	it('still reads a signature out of a package that carries a DTD', async () => {
		// With `processEntities` at its default, fast-xml-parser rejects an
		// internal entity over 10,000 characters by THROWING, which the catch in
		// `parseSignaturesFromBuffer` turns into "this deck has no signatures".
		const dtd = `<!DOCTYPE Signature [<!ENTITY pad "${'x'.repeat(20000)}">]>`;
		const withDtd = SIGNATURE_XML.replace('?>', `?>${dtd}`);

		const signatures = await parseSignaturesFromBuffer(await signedBuffer(withDtd));

		expect(signatures).toHaveLength(1);
		expect(signatures[0].certificate?.subject).toBe('CN=Café Ltd');
	});
});
