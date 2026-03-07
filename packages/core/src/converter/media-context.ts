import type { FileSystemAdapter } from './types';

/** Map common MIME sub-types to file extensions. */
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

function mimeSubtypeToExt(mime: string): string {
	const parts = mime.split('/');
	if (parts.length === 2) {
		return parts[1].replace(/[^a-z0-9]/g, '');
	}
	return 'bin';
}

export function dataUrlToMediaBytes(dataUrl: string): {
	bytes: Uint8Array;
	ext: string;
} {
	const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
	if (!match) {
		throw new Error('Invalid data URL format');
	}
	const mime = match[1].toLowerCase();
	const ext = MIME_TO_EXT[mime] ?? mimeSubtypeToExt(mime);

	const base64 = match[2];
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}

	return { bytes, ext };
}

export function generateMediaFilename(index: number, ext: string): string {
	const padded = String(index).padStart(3, '0');
	const cleanExt = ext.startsWith('.') ? ext.slice(1) : ext;
	return `image-${padded}.${cleanExt}`;
}

export class MediaContext {
	private imageIndex = 0;
	private initialized = false;
	private readonly resolvedMediaDir: string;

	public constructor(
		outputDir: string,
		private readonly folderName: string,
		private readonly fs?: FileSystemAdapter
	) {
		this.resolvedMediaDir = `${outputDir}/${this.folderName}`;
	}

	public get totalImages(): number {
		return this.imageIndex;
	}

	public get mediaDir(): string {
		return this.resolvedMediaDir;
	}

	public async saveImage(dataUrl: string, prefix?: string): Promise<string> {
		const decoded = dataUrlToMediaBytes(dataUrl);
		return this.saveImageBytes(decoded.bytes, decoded.ext, prefix);
	}

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

	private async ensureInitialized(): Promise<void> {
		if (this.initialized) return;
		if (this.fs) {
			await this.fs.createFolder(this.resolvedMediaDir);
		}
		this.initialized = true;
	}
}
