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
	/**
	 * Writes a UTF-8 text file at the given path, creating or overwriting as needed.
	 * @param path - Absolute or relative path for the output file.
	 * @param content - Text content to write.
	 */
	writeFile(path: string, content: string): Promise<void>;

	/**
	 * Writes a binary file (e.g. an extracted image) at the given path.
	 * @param path - Absolute or relative path for the output file.
	 * @param data - Raw binary content as a typed array.
	 */
	writeBinaryFile(path: string, data: Uint8Array): Promise<void>;

	/**
	 * Creates a directory (and any missing parents) at the given path.
	 * Should be a no-op if the directory already exists.
	 * @param path - Absolute or relative path for the directory.
	 */
	createFolder(path: string): Promise<void>;
}

/**
 * Options shared by all document converters, controlling output paths,
 * media extraction folder names, and metadata inclusion.
 */
export interface ConversionOptions {
	/** Optional file path to write the generated markdown. When omitted, only the string is returned. */
	outputPath?: string;

	/** Name of the sub-folder (relative to outputDir) where extracted media will be stored. */
	mediaFolderName: string;

	/** When true, a YAML front-matter block with document metadata is prepended to the output. */
	includeMetadata: boolean;
}

/**
 * Summary of a completed conversion, including statistics about
 * the generated output and extracted media.
 */
export interface ConversionResult {
	/** Whether the conversion completed without errors. */
	success: boolean;

	/** Path where the markdown output was written. */
	outputPath: string;

	/** Character length of the generated markdown string. */
	markdownLength: number;

	/** Number of images extracted and saved to the media folder. */
	imagesExtracted: number;

	/** Absolute path to the media folder, or null if no images were extracted. */
	mediaFolder: string | null;

	/** Allows additional converter-specific metadata fields. */
	[key: string]: unknown;
}
