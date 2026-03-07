import type { ConversionOptions, FileSystemAdapter } from './types';
import { MediaContext } from './media-context';

export type { ConversionOptions, ConversionResult, FileSystemAdapter } from './types';

export function normalizePath(pathValue: string): string {
	return pathValue.trim().replace(/\\/g, '/');
}

export function getDirectory(filePath: string): string {
	const normalized = normalizePath(filePath);
	const index = normalized.lastIndexOf('/');
	if (index < 0) return '.';
	if (index === 0) return '/';
	return normalized.slice(0, index);
}

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

export abstract class DocumentConverter<TSource> {
	protected readonly mediaContext: MediaContext;

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

	public abstract convert(source: TSource): Promise<string>;

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
