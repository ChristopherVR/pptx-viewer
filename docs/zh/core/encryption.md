---
title: 加密
description: 加载受密码保护的 PPTX，并通过 Web Crypto 使用 OOXML agile AES-128/256 保存加密文件。
---

# 加密 {#encryption}

`pptx-viewer-core` 按 [MS-OFFCRYPTO] 使用 OOXML 加密读取和写入受密码保护的 PPTX。加密文件不是 ZIP，而是包含 `EncryptionInfo` 和加密 ZIP 数据 `EncryptedPackage` 的 OLE2/CFB 复合文档。加密运算均使用平台的 Web Crypto（`globalThis.crypto.subtle`），无需原生模块，支持浏览器、Node 19+、Bun、Deno 和 Workers。Node 18 需要 `--experimental-global-webcrypto`。没有 `globalThis.crypto` 时会明确报告 crypto API 不可用。

| 能力           | 说明                                                                               |
| -------------- | ---------------------------------------------------------------------------------- |
| **检测**       | `detectFileFormat` 区分 ZIP（`50 4B`）、加密 OLE2（`D0 CF 11 E0 ...`）和未知数据。 |
| **加载时解密** | 支持 Office 2007 的 **standard** 和 Office 2010+ 的 **agile** 方案。               |
| **保存时加密** | 只输出 **agile**，使用 AES-128 或 AES-256、SHA-512、CBC。                          |
| **完整性**     | agile 解密验证文档 HMAC，拒绝被篡改的文件。                                        |

## 加载加密文件 {#loading-an-encrypted-file}

通过 `load` 选项传入密码。处理器检测 OLE2 容器，解密并解析恢复出的 ZIP，在结果中设置 `data.isPasswordProtected = true`：

```ts
import { PptxHandler } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(buffer, { password: 'secret' });

console.log(data.isPasswordProtected); // true
```

未加密文件完全忽略 `password`，只有检测到 OLE2 魔数才尝试解密，因此可以直接传入已有密码而不先判断。

### 错误处理 {#error-handling}

三种错误均有可区分的 `name`，其中 `EncryptedFileError` 还提供 `isEncrypted: true`：

| 错误                     | 触发条件                      | 默认消息                                                                              |
| ------------------------ | ----------------------------- | ------------------------------------------------------------------------------------- |
| `EncryptedFileError`     | 文件加密但未提供 `password`   | "This presentation is encrypted. Provide a password via options.password to open it." |
| `IncorrectPasswordError` | 密码未通过验证                | "The password is incorrect."                                                          |
| `DataIntegrityError`     | HMAC 不匹配，文件损坏或被篡改 | "Data integrity check failed. The encrypted file may be corrupted or tampered with."  |

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

## 保存加密文件 {#saving-encrypted-output}

调用处理器的 `saveEncrypted`，先按与 [`save`](/zh/core/saving) 相同的方式序列化，所有保存选项仍适用，再加密为 OLE2。PowerPoint 打开时会要求输入密码：

```ts
const bytes = await handler.saveEncrypted(data.slides, 'secret');
// => Uint8Array of an encrypted OLE2 file
```

### 加密选项 {#encryption-options}

`saveEncrypted(slides, password, options?)` 接受普通 `PptxHandlerSaveOptions`，加上 `EncryptionOptions` 类型的 `encryption` 子对象：

```ts
const bytes = await handler.saveEncrypted(data.slides, 'secret', {
	coreProperties: data.coreProperties, // regular save options still work
	encryption: {
		algorithm: 'AES256', // 'AES128' | 'AES256' (default 'AES256')
		spinCount: 100000, // key-derivation iterations (default 100000)
	},
});
```

| 选项        | 类型                   | 默认值     | 用途                                                 |
| ----------- | ---------------------- | ---------- | ---------------------------------------------------- |
| `algorithm` | `'AES128' \| 'AES256'` | `'AES256'` | 密钥长度，128 或 256 位。                            |
| `spinCount` | `number`               | `100000`   | 从密码派生密钥时的哈希迭代次数。仅在加速测试时降低。 |

::: info agile 加密内部机制
使用配置迭代次数的 **SHA-512** 密码哈希，密钥加密器和文档本身均采用 **AES-CBC**（`ChainingModeCBC`），通过 `crypto.getRandomValues` 生成 16 字节随机盐和随机文档密钥，并附带基于 HMAC 的 `dataIntegrity` 块，以便解密时检测篡改。`EncryptionInfo` 是标准 XML，可由 Microsoft PowerPoint、LibreOffice 和其他符合 MS-OFFCRYPTO 的程序打开。
:::

::: warning 旧方案只支持解密
Office 2007 的 **standard** 方案使用二进制 `EncryptionInfo`，仅支持解密。保存始终使用 Office 2010 之后采用的 agile 方案。
:::

## 底层加密函数 {#low-level-crypto-functions}

这些函数从根入口导出，操作原始 `ArrayBuffer`，不依赖模型：

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

- `decryptPptx(encryptedBuffer, password)`：解析 OLE2，验证密码和 agile 完整性，返回解密后的 ZIP，失败时抛出 `IncorrectPasswordError` 或 `DataIntegrityError`。
- `encryptPptx(pptxBuffer, password, options?)`：将普通 `.pptx` 缓冲区包装为加密 OLE2。
- `verifyPassword(encryptedBuffer, password)`：根据验证流检查密码，密码错误或输入未加密时返回 `false`，不抛出错误。

::: tip 提示
普通流程优先使用 `handler.load(buffer, { password })` 和 `handler.saveEncrypted(...)`，它们自动处理检测与序列化。已有独立缓冲区，例如无需解析而重新加密文件时，再使用底层函数。
:::

## 相关安全功能 {#related-security-features}

引擎还将修改密码的写保护验证器解析到 `data.modifyVerifier`，通过[保存选项](/zh/core/saving)传回可保留，传 `null` 可移除写保护。`data.hasDigitalSignatures` 检测 XML 数字签名，保存时会移除已因修改而失效的签名。Node 专用签名和 PKI 校验工具位于 `pptx-viewer-core/signature-node`。可编辑范围见[功能限制](/zh/guide/limitations)。
