import type { FileSystemAdapter } from './types';

/**
 * Lookup table mapping common MIME types to their canonical file extensions.
 * Used to determine the correct extension when saving extracted images.
 */
const MIME_TO_EXT: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/jpg': 'jpg',
	'image/gif': 'gif',
	'image/svg+xml': 'svg',
	'image/webp': 'webp',
	'image/bmp': 'bmp',
	'image/tiff': 'tiff',
};

/**
 * Derives a file extension from a MIME type by extracting and sanitising
 * the sub-type portion (e.g. `"image/png"` -> `"png"`).
 *
 * @param mime - Full MIME type string (e.g. `"image/png"`).
 * @returns A sanitised extension string, or `"bin"` if the MIME format is unexpected.
 */
function mimeSubtypeToExt(mime: string): string {
	const parts = mime.split('/');
	if (parts.length === 2) {
		// Strip any non-alphanumeric characters (e.g. "+xml" becomes "xml")
		return parts[1].replace(/[^a-z0-9]/g, '');
	}
	return 'bin';
}

/**
 * Parses a Base64-encoded `data:` URL and returns the decoded binary
 * content along with a suitable file extension.
 *
 * @param dataUrl - A complete `data:` URL in the form `data:<mime>;base64,<payload>`.
 * @returns An object with `bytes` (the decoded binary data) and `ext` (the file extension).
 * @throws Error if the data URL does not match the expected `data:<mime>;base64,<payload>` format.
 *
 * @example
 * ```ts
 * const { bytes, ext } = dataUrlToMediaBytes('data:image/png;base64,iVBOR...');
 * // bytes: Uint8Array of PNG data
 * // ext: 'png'
 * ```
 */
export function dataUrlToMediaBytes(dataUrl: string): {
	bytes: Uint8Array;
	ext: string;
} {
	// Match the MIME type and Base64 payload from the data URL (dotall flag handles newlines in payload)
	const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
	if (!match) {
		throw new Error('Invalid data URL format');
	}
	const mime = match[1].toLowerCase();
	const ext = MIME_TO_EXT[mime] ?? mimeSubtypeToExt(mime);

	// Decode Base64 payload into a binary byte array
	const base64 = match[2];
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}

	return { bytes, ext };
}

/**
 * Generates a deterministic, zero-padded filename for an extracted image.
 *
 * @param index - The 1-based ordinal of the image within the conversion session.
 * @param ext - File extension (with or without leading dot).
 * @returns A filename like `"image-001.png"`.
 *
 * @example
 * ```ts
 * generateMediaFilename(7, 'jpg'); // "image-007.jpg"
 * ```
 */
export function generateMediaFilename(index: number, ext: string): string {
	const padded = String(index).padStart(3, '0');
	const cleanExt = ext.startsWith('.') ? ext.slice(1) : ext;
	return `image-${padded}.${cleanExt}`;
}

/**
 * Manages the extraction and persistence of media files (images) during
 * a PPTX-to-Markdown conversion session.
 *
 * Each `MediaContext` tracks a running count of saved images and ensures
 * the target media directory is lazily created on first write. When no
 * {@link FileSystemAdapter} is provided, filenames are still generated
 * (for in-memory usage) but nothing is written to disk.
 */
export class MediaContext {
	/** Running counter used to assign unique sequential filenames. */
	private imageIndex = 0;

	/** Whether the media output directory has been created yet. */
	private initialized = false;

	/** Fully resolved path to the media output directory. */
	private readonly resolvedMediaDir: string;

	/**
	 * @param outputDir - Root output directory for the conversion.
	 * @param folderName - Sub-folder name for media files (e.g. `"media"`).
	 * @param fs - Optional file system adapter; omit for in-memory-only conversion.
	 */
	public constructor(
		outputDir: string,
		private readonly folderName: string,
		private readonly fs?: FileSystemAdapter
	) {
		this.resolvedMediaDir = `${outputDir}/${this.folderName}`;
	}

	/** Returns the total number of images saved so far in this session. */
	public get totalImages(): number {
		return this.imageIndex;
	}

	/** Returns the absolute path to the media output directory. */
	public get mediaDir(): string {
		return this.resolvedMediaDir;
	}

	/**
	 * Decodes a Base64 `data:` URL, saves the image to disk (if a FS adapter
	 * is available), and returns a relative path suitable for embedding in markdown.
	 *
	 * @param dataUrl - The Base64-encoded data URL of the image.
	 * @param prefix - Optional filename prefix (e.g. `"slide3"`) for disambiguation.
	 * @returns A relative path like `"./media/slide3-image-001.png"`.
	 * @throws Error if the data URL is malformed.
	 */
	public async saveImage(dataUrl: string, prefix?: string): Promise<string> {
		const decoded = dataUrlToMediaBytes(dataUrl);
		return this.saveImageBytes(decoded.bytes, decoded.ext, prefix);
	}

	/**
	 * Saves raw image bytes to disk and returns a relative path for markdown embedding.
	 *
	 * @param bytes - Raw binary content of the image.
	 * @param ext - File extension (e.g. `"png"`, `"jpg"`).
	 * @param prefix - Optional filename prefix for disambiguation.
	 * @returns A relative path like `"./media/image-001.png"`.
	 */
	public async saveImageBytes(
		bytes: Uint8Array,
		ext: string,
		prefix?: string
	): Promise<string> {
		await this.ensureInitialized();
		this.imageIndex += 1;
		const baseName = generateMediaFilename(this.imageIndex, ext);
		const filename = prefix ? `${prefix}-${baseName}` : baseName;
		if (this.fs) {
			const filePath = `${this.resolvedMediaDir}/${filename}`;
			await this.fs.writeBinaryFile(filePath, bytes);
		}
		return `./${this.folderName}/${filename}`;
	}

	/**
	 * Lazily creates the media output directory on the first call.
	 * Subsequent calls are no-ops.
	 */
	private async ensureInitialized(): Promise<void> {
		if (this.initialized) return;
		if (this.fs) {
			await this.fs.createFolder(this.resolvedMediaDir);
		}
		this.initialized = true;
	}
}
