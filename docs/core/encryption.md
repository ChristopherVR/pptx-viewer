---
title: Encryption
description: Load password-protected PPTX files and save encrypted output with pptx-viewer-core - AES-128/256 OOXML agile encryption via Web Crypto.
---

# Encryption

`pptx-viewer-core` reads and writes password-protected PPTX files using OOXML encryption (per [MS-OFFCRYPTO]). Encrypted files are not ZIPs at all: they are OLE2/CFB compound documents wrapping an `EncryptionInfo` stream and the encrypted ZIP package (`EncryptedPackage`). All cryptography runs on the platform's Web Crypto (`globalThis.crypto.subtle`) - no native modules - so it works in browsers, Node 19+ (Node 18 needs `--experimental-global-webcrypto`), Bun, Deno, and Workers; environments without `globalThis.crypto` get a clear "crypto API is not available" error.

| Capability          | Detail                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| **Detection**       | `detectFileFormat` distinguishes ZIP (`50 4B`), encrypted OLE2 (`D0 CF 11 E0 ...`), and unknown buffers. |
| **Decrypt on load** | Both **standard** encryption (Office 2007) and **agile** encryption (Office 2010+) are supported.        |
| **Encrypt on save** | Writes **agile**-encrypted output only (AES-128 or AES-256, SHA-512, CBC).                               |
| **Integrity**       | Agile decryption verifies the package HMAC and rejects tampered files.                                   |

## Loading an encrypted file

Pass the password through the `load` options. The handler detects the OLE2 container, decrypts it, parses the recovered ZIP, and sets `data.isPasswordProtected = true` on the result:

```ts
import { PptxHandler } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(buffer, { password: 'secret' });

console.log(data.isPasswordProtected); // true
```

A non-encrypted file ignores the `password` option entirely (decryption only kicks in when the OLE2 magic is detected), so it is safe to pass a password through optimistically.

### Error handling

Three typed error classes cover the failure modes. All carry a distinguishing `name`, and `EncryptedFileError` additionally exposes `isEncrypted: true`:

| Error                    | Thrown when                                          | Message (default)                                                                     |
| ------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `EncryptedFileError`     | file is encrypted but no `password` option was given | "This presentation is encrypted. Provide a password via options.password to open it." |
| `IncorrectPasswordError` | the password fails verifier validation               | "The password is incorrect."                                                          |
| `DataIntegrityError`     | the package HMAC does not match (corrupted/tampered) | "Data integrity check failed. The encrypted file may be corrupted or tampered with."  |

```ts
import {
	PptxHandler,
	EncryptedFileError,
	IncorrectPasswordError,
	DataIntegrityError,
} from 'pptx-viewer-core';

async function open(buffer: ArrayBuffer, password?: string) {
	const handler = new PptxHandler();
	try {
		return await handler.load(buffer, { password });
	} catch (err) {
		if (err instanceof EncryptedFileError) {
			// Prompt the user for a password, then retry.
			throw new Error('Password required');
		}
		if (err instanceof IncorrectPasswordError) {
			throw new Error('Wrong password, try again');
		}
		if (err instanceof DataIntegrityError) {
			throw new Error('File is corrupted or has been tampered with');
		}
		throw err;
	}
}
```

## Saving encrypted output

Use `saveEncrypted` on the handler. It serializes the slides exactly like [`save`](/core/saving) (all save options apply), then encrypts the resulting bytes into an OLE2 package that PowerPoint will prompt for a password to open:

```ts
const bytes = await handler.saveEncrypted(data.slides, 'secret');
// => Uint8Array of an encrypted OLE2 file
```

### Encryption options

`saveEncrypted(slides, password, options?)` accepts the normal `PptxHandlerSaveOptions` plus an `encryption` sub-object (`EncryptionOptions`):

```ts
const bytes = await handler.saveEncrypted(data.slides, 'secret', {
	coreProperties: data.coreProperties, // regular save options still work
	encryption: {
		algorithm: 'AES256', // 'AES128' | 'AES256' (default 'AES256')
		spinCount: 100000, // key-derivation iterations (default 100000)
	},
});
```

| Option      | Type                   | Default    | Purpose                                                                          |
| ----------- | ---------------------- | ---------- | -------------------------------------------------------------------------------- |
| `algorithm` | `'AES128' \| 'AES256'` | `'AES256'` | Cipher key length (128 or 256 bits).                                             |
| `spinCount` | `number`               | `100000`   | Hash iterations for password-based key derivation. Lower only to speed up tests. |

::: info Agile encryption internals
Encrypted output uses the agile scheme: **SHA-512** password hashing with the configured spin count, **AES-CBC** (`ChainingModeCBC`) for both the key encryptors and the package, 16-byte random salts and a random document key from `crypto.getRandomValues`, and an HMAC-based `dataIntegrity` block so tampering is detectable on decryption. The `EncryptionInfo` stream is standard XML, so the file opens in Microsoft PowerPoint, LibreOffice, and other MS-OFFCRYPTO-compliant consumers.
:::

::: warning One-way support for the legacy scheme
The old **standard** scheme (Office 2007, binary `EncryptionInfo`) is supported for _decryption only_. Saving always produces agile encryption, which is what every Office release since 2010 writes.
:::

## Low-level crypto functions

The underlying functions are exported from the package root for advanced use. They operate on raw `ArrayBuffer`s rather than the data model (verified signatures):

```ts
import { detectFileFormat, decryptPptx, encryptPptx, verifyPassword } from 'pptx-viewer-core';

detectFileFormat(buffer);
// => { format: 'zip', encrypted: false }
//  | { format: 'ole', encrypted: true }
//  | { format: 'unknown', encrypted: false }

const plainZip = await decryptPptx(encryptedBuffer, 'secret'); // => ArrayBuffer (the ZIP)
const encrypted = await encryptPptx(pptxBuffer, 'secret', { algorithm: 'AES128' }); // => ArrayBuffer (OLE2)
const ok = await verifyPassword(encryptedBuffer, 'secret'); // => boolean, no full decryption
```

- `decryptPptx(encryptedBuffer, password)` parses the OLE2 container, validates the password, checks integrity (agile), and returns the decrypted ZIP. Throws `IncorrectPasswordError` / `DataIntegrityError`.
- `encryptPptx(pptxBuffer, password, options?)` wraps a plain `.pptx` buffer into an encrypted OLE2 container.
- `verifyPassword(encryptedBuffer, password)` checks the password against the verifier streams and returns `false` (never throws) for wrong passwords or non-encrypted buffers.

::: tip
Prefer `handler.load(buffer, { password })` and `handler.saveEncrypted(...)` for normal workflows - they handle detection and serialization for you. Reach for the low-level functions when you already have raw buffers outside the handler lifecycle, e.g. re-encrypting a file without parsing it.
:::

## Related security features

Beyond encryption, the engine also parses the modify-password (write-protection) verifier into `data.modifyVerifier` (pass it back - or `null` to remove write protection - via the [save options](/core/saving)), detects XML digital signatures (`data.hasDigitalSignatures`), and strips signatures on save since an edited file's signatures would no longer validate. Node-only signing and PKI validation helpers live under the `pptx-viewer-core/signature-node` subpath. See [/guide/limitations](/guide/limitations) for what is and is not editable.
