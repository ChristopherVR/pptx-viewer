import type { ConversionOptions, FileSystemAdapter } from './types';
import { MediaContext } from './media-context';

export type { ConversionOptions, ConversionResult, FileSystemAdapter } from './types';

/**
 * Normalises a file path by trimming whitespace and converting
 * backslashes to forward slashes for cross-platform consistency.
 *
 * @param pathValue - The raw file path string.
 * @returns The normalised path with forward slashes.
 *
 * @example
 * ```ts
 * normalizePath('  C:\\Users\\docs\\file.md  ');
 * // "C:/Users/docs/file.md"
 * ```
 */
export function normalizePath(pathValue: string): string {
	return pathValue.trim().replace(/\\/g, '/');
}

/**
 * Extracts the directory portion of a file path (everything before the
 * last `/` separator).
 *
 * @param filePath - A file path (backslashes are normalised automatically).
 * @returns The parent directory, `"."` if there is no separator, or `"/"` for root paths.
 *
 * @example
 * ```ts
 * getDirectory('/home/user/doc.md'); // "/home/user"
 * getDirectory('file.txt');          // "."
 * ```
 */
export function getDirectory(filePath: string): string {
	const normalized = normalizePath(filePath);
	const index = normalized.lastIndexOf('/');
	if (index < 0) return '.';
	if (index === 0) return '/';
	return normalized.slice(0, index);
}

/**
 * Derives a `.md` output path from a source file path when no explicit
 * output path has been provided. Simply replaces the source extension
 * with `.md`.
 *
 * @param sourcePath - Original source file path (e.g. `"presentation.pptx"`).
 * @param explicitPath - An explicit output path; if provided, it is returned as-is.
 * @returns The derived markdown path, the explicit path, or `undefined` if both inputs are absent.
 *
 * @example
 * ```ts
 * deriveOutputPath('slides.pptx', undefined); // "slides.md"
 * deriveOutputPath('slides.pptx', '/tmp/out.md'); // "/tmp/out.md"
 * ```
 */
export function deriveOutputPath(
	sourcePath: string | undefined,
	explicitPath: string | undefined
): string | undefined {
	if (explicitPath) return explicitPath;
	if (!sourcePath) return undefined;
	const normalized = normalizePath(sourcePath);
	const dotIndex = normalized.lastIndexOf('.');
	if (dotIndex < 0) return `${normalized}.md`;
	return `${normalized.slice(0, dotIndex)}.md`;
}

/**
 * Abstract base class for document-to-Markdown converters.
 *
 * Provides shared infrastructure for media extraction ({@link MediaContext}),
 * YAML front-matter generation, and file output. Concrete subclasses implement
 * the {@link convert} method to handle a specific document type.
 *
 * @typeParam TSource - The parsed document data structure that this converter consumes.
 */
export abstract class DocumentConverter<TSource> {
	/** Shared context for extracting and saving media (images) during conversion. */
	protected readonly mediaContext: MediaContext;

	/**
	 * @param outputDir - Root directory for all output files (markdown + media).
	 * @param options - Conversion options (output path, media folder name, metadata flag).
	 * @param fs - Optional file system adapter for writing files to disk.
	 */
	protected constructor(
		protected readonly outputDir: string,
		protected readonly options: ConversionOptions,
		protected readonly fs?: FileSystemAdapter
	) {
		this.mediaContext = new MediaContext(
			outputDir,
			options.mediaFolderName,
			fs
		);
	}

	/**
	 * Converts the given source document into a Markdown string.
	 *
	 * @param source - The parsed document data to convert.
	 * @returns The generated Markdown content.
	 */
	public abstract convert(source: TSource): Promise<string>;

	/**
	 * Builds a YAML front-matter block from a key-value metadata dictionary.
	 * String values are quoted; numeric values are emitted bare.
	 *
	 * @param metadata - Key-value pairs to include in the front matter.
	 * @returns A complete front-matter string (including `---` delimiters and trailing blank lines).
	 */
	protected buildFrontMatter(
		metadata: Record<string, string | number>
	): string {
		const lines: string[] = ['---'];
		for (const [key, value] of Object.entries(metadata)) {
			if (typeof value === 'string') {
				lines.push(`${key}: "${value}"`);
			} else {
				lines.push(`${key}: ${value}`);
			}
		}
		lines.push('---', '', '');
		return lines.join('\n');
	}

	/**
	 * Writes the generated markdown content to an output file using the
	 * configured {@link FileSystemAdapter}.
	 *
	 * @param content - The markdown string to write.
	 * @param outputPath - Destination file path.
	 * @throws Error if no `FileSystemAdapter` was provided at construction time.
	 */
	protected async writeOutput(
		content: string,
		outputPath: string
	): Promise<void> {
		if (!this.fs) {
			throw new Error(
				'FileSystemAdapter is required for writing output files. ' +
				'Provide one via the constructor or use convert() without outputPath.'
			);
		}
		await this.fs.writeFile(outputPath, content);
	}
}
