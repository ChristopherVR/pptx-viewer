/**
 * Platform adapter for file system operations.
 *
 * Consumers must provide an implementation of this interface
 * when using the converter with file output (writing markdown
 * and extracting media to disk).
 *
 * For in-memory-only conversion (just getting the markdown string),
 * no adapter is required.
 */
export interface FileSystemAdapter {
	writeFile(path: string, content: string): Promise<void>;
	writeBinaryFile(path: string, data: Uint8Array): Promise<void>;
	createFolder(path: string): Promise<void>;
}

export interface ConversionOptions {
	outputPath?: string;
	mediaFolderName: string;
	includeMetadata: boolean;
}

export interface ConversionResult {
	success: boolean;
	outputPath: string;
	markdownLength: number;
	imagesExtracted: number;
	mediaFolder: string | null;
	[key: string]: unknown;
}
