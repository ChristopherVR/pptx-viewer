export function parseDataUrlToBytes(
	dataUrl: string,
): { bytes: Uint8Array; extension: string } | null {
	const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
	if (!match) {
		return null;
	}

	const mime = match[1].toLowerCase();
	const base64Payload = match[2];

	const extensionByMime: Record<string, string> = {
		'image/jpeg': 'jpg',
		'image/jpg': 'jpg',
		'image/png': 'png',
		'image/gif': 'gif',
		'image/webp': 'webp',
		'image/svg+xml': 'svg',
		'image/bmp': 'bmp',
		'image/tiff': 'tiff',
		'image/tif': 'tiff',
		'image/avif': 'avif',
		'image/heic': 'heic',
		'video/mp4': 'mp4',
		'video/webm': 'webm',
		'video/ogg': 'ogv',
		'video/quicktime': 'mov',
		'video/x-msvideo': 'avi',
		'video/x-ms-wmv': 'wmv',
		'audio/mpeg': 'mp3',
		'audio/mp3': 'mp3',
		'audio/mp4': 'm4a',
		'audio/x-m4a': 'm4a',
		'audio/wav': 'wav',
		'audio/x-wav': 'wav',
		'audio/ogg': 'ogg',
		'audio/flac': 'flac',
		'model/gltf-binary': 'glb',
		'model/gltf.binary': 'glb',
	};
	const extension = extensionByMime[mime] || 'bin';

	try {
		const bufferCtor = (
			globalThis as unknown as {
				Buffer?: { from: (value: string, encoding: string) => Uint8Array };
			}
		).Buffer;
		const bytes = bufferCtor
			? new Uint8Array(bufferCtor.from(base64Payload, 'base64'))
			: Uint8Array.from(atob(base64Payload), (char) => char.charCodeAt(0));

		return {
			bytes,
			extension,
		};
	} catch {
		return null;
	}
}

/** Extension lookup for MIME types from URL responses. */
const extensionByResponseMime: Record<string, string> = {
	'video/mp4': 'mp4',
	'video/webm': 'webm',
	'video/ogg': 'ogv',
	'video/quicktime': 'mov',
	'video/x-msvideo': 'avi',
	'video/x-ms-wmv': 'wmv',
	'audio/mpeg': 'mp3',
	'audio/mp3': 'mp3',
	'audio/mp4': 'm4a',
	'audio/x-m4a': 'm4a',
	'audio/wav': 'wav',
	'audio/x-wav': 'wav',
	'audio/ogg': 'ogg',
	'audio/flac': 'flac',
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/svg+xml': 'svg',
	'application/octet-stream': 'bin',
};

/**
 * Options for {@link fetchUrlToBytes}.
 *
 * `allowExternalFetch` (default `false`) gates `http:`/`https:` URLs to
 * prevent SSRF during save: a deck whose mediaData was populated by an
 * untrusted source could otherwise force the host to issue arbitrary HTTP
 * requests (e.g. to cloud-metadata endpoints).
 *
 * `allowedSchemes` further constrains the accepted URL schemes. The default
 * permits only `pptx-resource:`, `blob:`, and `data:` — schemes that cannot
 * reach a remote network.
 */
export interface FetchUrlToBytesOptions {
	allowExternalFetch?: boolean;
	allowedSchemes?: ReadonlySet<string>;
}

const DEFAULT_SAFE_SCHEMES: ReadonlySet<string> = new Set(['pptx-resource:', 'blob:', 'data:']);

/**
 * Resolve a media source URL (pptx-resource://, blob:, http(s)://) to raw
 * bytes by fetching it. Returns null on failure or when the URL scheme is
 * not permitted by {@link FetchUrlToBytesOptions}.
 *
 * This is used during PPTX save to embed media that was streamed from disk
 * (via pptx-resource:// URLs) rather than stored as base64 data URLs.
 */
export async function fetchUrlToBytes(
	url: string,
	options: FetchUrlToBytesOptions = {},
): Promise<{ bytes: Uint8Array; extension: string } | null> {
	// Validate scheme up front to prevent SSRF on save.
	let scheme: string;
	try {
		scheme = new URL(url).protocol;
	} catch {
		return null;
	}
	const allowedSchemes = options.allowedSchemes ?? DEFAULT_SAFE_SCHEMES;
	const isHttp = scheme === 'http:' || scheme === 'https:';
	if (isHttp) {
		if (options.allowExternalFetch !== true) {
			return null;
		}
	} else if (!allowedSchemes.has(scheme)) {
		return null;
	}

	try {
		const response = await fetch(url);
		if (!response.ok) {
			return null;
		}

		const arrayBuffer = await response.arrayBuffer();
		const contentType = (response.headers.get('Content-Type') ?? 'application/octet-stream')
			.split(';')[0]
			.trim()
			.toLowerCase();

		// Try to infer extension from Content-Type header
		let extension = extensionByResponseMime[contentType];

		// Fall back to URL path extension
		if (!extension) {
			try {
				const urlPath = new URL(url).pathname;
				const dotIdx = urlPath.lastIndexOf('.');
				if (dotIdx !== -1) {
					extension = urlPath.substring(dotIdx + 1).toLowerCase();
				}
			} catch {
				// URL parsing failed — use default
			}
		}

		return {
			bytes: new Uint8Array(arrayBuffer),
			extension: extension || 'bin',
		};
	} catch {
		return null;
	}
}
