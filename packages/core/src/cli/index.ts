#!/usr/bin/env node
/**
 * pptx-cli - Command-line PPTX operations.
 *
 * Commands:
 *   pptx info <file.pptx>                                    - Show presentation info
 *   pptx export-svg <file.pptx> [output-dir]                 - Export all slides as SVG
 *   pptx export-md <file.pptx> [output.md]                   - Export to Markdown
 *   pptx merge <file1.pptx> <file2.pptx> -o <output.pptx>   - Merge presentations
 *   pptx find <file.pptx> "search text"                      - Find text in presentation
 *   pptx replace <file.pptx> "old" "new" -o <output.pptx>   - Replace text
 *   pptx create -o <output.pptx> --title "Title"             - Create blank presentation
 *   pptx diff <file1.pptx> <file2.pptx>                     - Compare presentations
 *
 * @module cli
 */

import * as fs from "fs";
import * as path from "path";
import {
	handleInfo,
	handleExportSvg,
	handleExportMd,
	handleMerge,
	handleFind,
	handleReplace,
	handleCreate,
	handleDiff,
} from "./commands";

// ---------------------------------------------------------------------------
// Argument helpers
// ---------------------------------------------------------------------------

/**
 * Parse a named flag from args. Returns the value following the flag,
 * or undefined if the flag is not present.
 */
function getFlag(args: string[], flag: string): string | undefined {
	const idx = args.indexOf(flag);
	if (idx === -1 || idx + 1 >= args.length) return undefined;
	return args[idx + 1];
}

/**
 * Check whether a boolean flag is present.
 */
function hasFlag(args: string[], flag: string): boolean {
	return args.includes(flag);
}

/**
 * Read a file from disk and return a Uint8Array.
 */
function readFileBytes(filePath: string): Uint8Array {
	const resolved = path.resolve(filePath);
	if (!fs.existsSync(resolved)) {
		throw new Error(`File not found: ${resolved}`);
	}
	return new Uint8Array(fs.readFileSync(resolved));
}

/**
 * Write bytes to a file, creating parent directories if needed.
 */
function writeFileBytes(filePath: string, data: Uint8Array | string): void {
	const resolved = path.resolve(filePath);
	const dir = path.dirname(resolved);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	fs.writeFileSync(resolved, data);
}

// ---------------------------------------------------------------------------
// Command implementations
// ---------------------------------------------------------------------------

async function cmdInfo(args: string[]): Promise<void> {
	const file = args[1];
	if (!file) {
		console.error("Usage: pptx info <file.pptx>");
		process.exit(1);
	}

	const bytes = readFileBytes(file);
	const info = await handleInfo(bytes);

	console.log("Presentation Info");
	console.log("=================");
	console.log(`Slides:      ${info.slideCount}`);
	console.log(`Dimensions:  ${info.width} x ${info.height}`);
	if (info.slideSizeType) console.log(`Size Type:   ${info.slideSizeType}`);
	if (info.title) console.log(`Title:       ${info.title}`);
	if (info.creator) console.log(`Creator:     ${info.creator}`);
	if (info.subject) console.log(`Subject:     ${info.subject}`);
	if (info.themeName) console.log(`Theme:       ${info.themeName}`);
	if (info.majorFont || info.minorFont) {
		console.log(
			`Fonts:       ${[info.majorFont, info.minorFont].filter(Boolean).join(", ")}`,
		);
	}
	console.log(`Layouts:     ${info.layoutCount} (${info.layouts.join(", ")})`);
	if (info.sectionCount > 0) {
		console.log(
			`Sections:    ${info.sectionCount} (${info.sections.join(", ")})`,
		);
	}
	console.log(`Elements:    ${info.totalElements}`);
	if (info.hiddenSlideCount > 0)
		console.log(`Hidden:      ${info.hiddenSlideCount}`);
	if (info.notesCount > 0) console.log(`With Notes:  ${info.notesCount}`);
	if (info.commentCount > 0)
		console.log(`Comments:    ${info.commentCount}`);
	if (info.hasMacros) console.log("Macros:      yes");
	if (info.hasDigitalSignatures) console.log("Signatures:  yes");
	if (info.embeddedFontCount > 0)
		console.log(`Emb. Fonts:  ${info.embeddedFontCount}`);
	if (info.customShowCount > 0)
		console.log(`Custom Shows: ${info.customShowCount}`);
}

async function cmdExportSvg(args: string[]): Promise<void> {
	const file = args[1];
	if (!file) {
		console.error("Usage: pptx export-svg <file.pptx> [output-dir]");
		process.exit(1);
	}

	const outputDir = args[2] || ".";
	const includeHidden = hasFlag(args, "--include-hidden");

	const bytes = readFileBytes(file);
	const result = await handleExportSvg(bytes, { includeHidden });

	if (!fs.existsSync(path.resolve(outputDir))) {
		fs.mkdirSync(path.resolve(outputDir), { recursive: true });
	}

	for (let i = 0; i < result.svgs.length; i++) {
		const outPath = path.join(outputDir, `slide_${i + 1}.svg`);
		writeFileBytes(outPath, result.svgs[i]);
		console.log(`Written: ${outPath}`);
	}

	console.log(`Exported ${result.slideCount} slides as SVG.`);
}

async function cmdExportMd(args: string[]): Promise<void> {
	const file = args[1];
	if (!file) {
		console.error("Usage: pptx export-md <file.pptx> [output.md]");
		process.exit(1);
	}

	const outputFile = args[2] || file.replace(/\.pptx$/i, ".md");
	const semantic = hasFlag(args, "--semantic");
	const noNotes = hasFlag(args, "--no-notes");

	const bytes = readFileBytes(file);
	const result = await handleExportMd(bytes, {
		sourceName: path.basename(file),
		includeSpeakerNotes: !noNotes,
		semanticMode: semantic,
	});

	writeFileBytes(outputFile, result.markdown);
	console.log(
		`Exported ${result.slideCount} slides to Markdown: ${outputFile}`,
	);
}

async function cmdMerge(args: string[]): Promise<void> {
	const file1 = args[1];
	const file2 = args[2];
	const output = getFlag(args, "-o");

	if (!file1 || !file2 || !output) {
		console.error(
			"Usage: pptx merge <file1.pptx> <file2.pptx> -o <output.pptx>",
		);
		process.exit(1);
	}

	const keepTheme = hasFlag(args, "--keep-source-theme");
	const insertAtStr = getFlag(args, "--insert-at");
	const insertAt =
		insertAtStr !== undefined ? parseInt(insertAtStr, 10) : undefined;

	const bytes1 = readFileBytes(file1);
	const bytes2 = readFileBytes(file2);

	const result = await handleMerge(bytes1, bytes2, {
		keepSourceTheme: keepTheme,
		insertAt,
	});

	writeFileBytes(output, result.outputBytes);
	console.log(
		`Merged ${result.mergedSlideCount} slides. Total: ${result.totalSlideCount} slides. Output: ${output}`,
	);
}

async function cmdFind(args: string[]): Promise<void> {
	const file = args[1];
	const search = args[2];

	if (!file || !search) {
		console.error('Usage: pptx find <file.pptx> "search text"');
		process.exit(1);
	}

	const caseInsensitive = hasFlag(args, "-i");

	const bytes = readFileBytes(file);
	const result = await handleFind(bytes, search, {
		caseSensitive: !caseInsensitive,
	});

	if (result.totalCount === 0) {
		console.log(`No matches found for "${search}".`);
		return;
	}

	console.log(`Found ${result.totalCount} match(es):`);
	for (const match of result.matches) {
		console.log(
			`  Slide ${match.slideIndex + 1}, Element ${match.elementId}: "${match.text}"`,
		);
	}
}

async function cmdReplace(args: string[]): Promise<void> {
	const file = args[1];
	const search = args[2];
	const replacement = args[3];
	const output = getFlag(args, "-o");

	if (!file || !search || replacement === undefined || !output) {
		console.error(
			'Usage: pptx replace <file.pptx> "old" "new" -o <output.pptx>',
		);
		process.exit(1);
	}

	const caseInsensitive = hasFlag(args, "-i");

	const bytes = readFileBytes(file);
	const result = await handleReplace(bytes, search, replacement, {
		caseSensitive: !caseInsensitive,
	});

	writeFileBytes(output, result.outputBytes);
	console.log(
		`Replaced ${result.replacementCount} occurrence(s). Output: ${output}`,
	);
}

async function cmdCreate(args: string[]): Promise<void> {
	const output = getFlag(args, "-o");
	if (!output) {
		console.error(
			'Usage: pptx create -o <output.pptx> [--title "Title"] [--creator "Author"]',
		);
		process.exit(1);
	}

	const title = getFlag(args, "--title");
	const creator = getFlag(args, "--creator");

	const result = await handleCreate({
		title: title ?? undefined,
		creator: creator ?? undefined,
	});

	writeFileBytes(output, result.outputBytes);
	console.log(
		`Created presentation with ${result.slideCount} slide(s): ${output}`,
	);
}

async function cmdDiff(args: string[]): Promise<void> {
	const file1 = args[1];
	const file2 = args[2];

	if (!file1 || !file2) {
		console.error("Usage: pptx diff <file1.pptx> <file2.pptx>");
		process.exit(1);
	}

	const bytes1 = readFileBytes(file1);
	const bytes2 = readFileBytes(file2);

	const result = await handleDiff(bytes1, bytes2);

	console.log("Presentation Diff");
	console.log("==================");
	console.log(
		`File A: ${result.slideCountA} slides | File B: ${result.slideCountB} slides`,
	);
	console.log(`Dimensions: ${result.dimensionsMatch ? "match" : "DIFFER"}`);
	console.log(`Theme:      ${result.themeMatch ? "match" : "DIFFER"}`);
	console.log("");

	for (const diff of result.slideDiffs) {
		const statusLabel = {
			added: "[+]",
			removed: "[-]",
			modified: "[~]",
			unchanged: "[ ]",
		}[diff.status];

		let detail = "";
		if (diff.status === "modified") {
			detail = ` (elements: ${diff.elementCountA} -> ${diff.elementCountB})`;
		} else if (diff.status === "added") {
			detail = ` (${diff.elementCountB} elements)`;
		} else if (diff.status === "removed") {
			detail = ` (${diff.elementCountA} elements)`;
		}

		console.log(`  ${statusLabel} Slide ${diff.slideNumber}${detail}`);

		if (diff.textDifferences && diff.textDifferences.length > 0) {
			for (const td of diff.textDifferences) {
				console.log(`      ${td}`);
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Usage / help
// ---------------------------------------------------------------------------

function printUsage(): void {
	console.log(`
pptx-cli - Command-line PPTX operations

Usage: pptx <command> [options]

Commands:
  info <file.pptx>                                    Show presentation info
  export-svg <file.pptx> [output-dir]                 Export all slides as SVG
    --include-hidden                                   Include hidden slides
  export-md <file.pptx> [output.md]                   Export to Markdown
    --semantic                                         Use semantic mode
    --no-notes                                         Exclude speaker notes
  merge <file1.pptx> <file2.pptx> -o <output.pptx>   Merge presentations
    --keep-source-theme                                Keep source theme
    --insert-at <index>                                Insert position (0-based)
  find <file.pptx> "search text"                      Find text in presentation
    -i                                                 Case-insensitive
  replace <file.pptx> "old" "new" -o <output.pptx>   Replace text
    -i                                                 Case-insensitive
  create -o <output.pptx>                             Create blank presentation
    --title "Title"                                    Set title
    --creator "Author"                                 Set creator
  diff <file1.pptx> <file2.pptx>                     Compare presentations

Examples:
  pptx info deck.pptx
  pptx export-svg deck.pptx ./svg-output
  pptx export-md deck.pptx deck.md
  pptx merge deck1.pptx deck2.pptx -o combined.pptx
  pptx find deck.pptx "quarterly report"
  pptx replace deck.pptx "2025" "2026" -o updated.pptx
  pptx create -o blank.pptx --title "New Deck"
  pptx diff old.pptx new.pptx
`);
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const command = args[0];

	if (!command || command === "--help" || command === "-h") {
		printUsage();
		process.exit(0);
	}

	try {
		switch (command) {
			case "info":
				await cmdInfo(args);
				break;
			case "export-svg":
				await cmdExportSvg(args);
				break;
			case "export-md":
				await cmdExportMd(args);
				break;
			case "merge":
				await cmdMerge(args);
				break;
			case "find":
				await cmdFind(args);
				break;
			case "replace":
				await cmdReplace(args);
				break;
			case "create":
				await cmdCreate(args);
				break;
			case "diff":
				await cmdDiff(args);
				break;
			default:
				console.error(`Unknown command: ${command}`);
				printUsage();
				process.exit(1);
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`Error: ${message}`);
		process.exit(1);
	}
}

main();

// Re-export command handlers for programmatic use
export {
	handleInfo,
	handleExportSvg,
	handleExportMd,
	handleMerge,
	handleFind,
	handleReplace,
	handleCreate,
	handleDiff,
} from "./commands";

export type {
	InfoResult,
	ExportSvgResult,
	ExportMdResult,
	MergeResult,
	FindCommandResult,
	ReplaceResult,
	CreateResult,
	DiffResult,
	SlideDiffEntry,
} from "./commands";
