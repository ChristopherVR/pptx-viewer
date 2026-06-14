---
title: Encryption
description: Load password-protected PPTX files and save encrypted output with pptx-viewer-core — AES-128/256 OOXML agile encryption via Web Crypto.
---

# Encryption

`pptx-viewer-core` reads and writes password-protected PPTX files using OOXML encryption (per [MS-OFFCRYPTO]). Encrypted files are OLE2/CFB compound documents wrapping the encrypted ZIP package. All cryptography runs on the platform's Web Crypto (`crypto.subtle`) — no native modules.

| Capability          | Detail                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| **Decrypt on load** | Reads password-protected files. Supports both standard (Office 2007) and agile (Office 2010+) encryption. |
| **Encrypt on save** | Writes agile-encrypted output (AES-128 / AES-256).                                                        |
| **Detection**       | Identifies the OLE2/CFB wrapper around an encrypted package.                                              |

## Loading an encrypted file

Pass the password through `load` options. The handler detects the encrypted OLE2 container, decrypts it, and then parses the resulting ZIP:

```ts
import { PptxHandler } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(buffer, { password: 'secret' });
```

::: warning Missing password
If the file is encrypted and you call `load()` without `options.password`, the engine throws `EncryptedFileError` (`"This presentation is encrypted. Provide a password via options.password to open it."`). A wrong password throws `IncorrectPasswordError`; tampered data throws `DataIntegrityError`.
:::

A non-encrypted file ignores the `password` option, so it's safe to pass through optimistically.

## Saving encrypted output

Use `saveEncrypted` on the handler. It serializes the slides exactly like [`save`](/core/saving), then encrypts the bytes into an OLE2 package that PowerPoint will prompt for a password to open:

```ts
const bytes = await handler.saveEncrypted(data.slides, 'secret');
// => Uint8Array of an encrypted OLE2 file
```

### Encryption options

`saveEncrypted(slides, password, options?)` accepts the normal save options plus an `encryption` sub-object:

```ts
const bytes = await handler.saveEncrypted(data.slides, 'secret', {
	encryption: {
		algorithm: 'AES256', // 'AES128' | 'AES256' (default 'AES256')
		spinCount: 100000, // key-derivation iterations (default 100000)
	},
});
```

| Option      | Type                   | Default    | Purpose                                                                          |
| ----------- | ---------------------- | ---------- | -------------------------------------------------------------------------------- |
| `algorithm` | `'AES128' \| 'AES256'` | `'AES256'` | Cipher key length.                                                               |
| `spinCount` | `number`               | `100000`   | Hash iterations for password-based key derivation. Lower only to speed up tests. |

::: info Agile encryption, SHA-512
Encrypted output uses the agile scheme with SHA-512 hashing and CBC chaining. Salts and the document key are generated with `crypto.getRandomValues`.
:::

## Low-level crypto functions

The underlying functions are also exported for advanced use — they operate on raw `ArrayBuffer`s rather than the data model:

```ts
import { decryptPptx, encryptPptx, verifyPassword } from 'pptx-viewer-core';

const plain = await decryptPptx(encryptedBuffer, 'secret'); // => ArrayBuffer (ZIP)
const enc = await encryptPptx(pptxBuffer, 'secret', { algorithm: 'AES256' });
```

- `decryptPptx(encryptedBuffer, password)` → decrypted ZIP `ArrayBuffer`. Throws `IncorrectPasswordError` / `DataIntegrityError`.
- `encryptPptx(pptxBuffer, password, options?)` → encrypted OLE2 `ArrayBuffer`.
- `verifyPassword(...)` → check a password without fully decrypting.

::: tip
Prefer `handler.load({ password })` and `handler.saveEncrypted(...)` for normal workflows — they handle detection and serialization for you. Reach for the low-level functions only when you're working with raw buffers outside the handler lifecycle.
:::

## Related security features

Beyond encryption, the engine also detects modify-password (write-protection) verifiers and XML digital signatures, and can strip signatures on save. See [/guide/limitations](/guide/limitations) for what is and isn't editable.
