/**
 * OLE2 compound binary file writer.
 *
 * Creates a minimal v3 OLE2 container from named streams,
 * suitable for encrypted OOXML packages.
 *
 * Split across three files to stay under the repo's ~300 LOC convention:
 * `ole2-parser-write-helpers.ts` (pure name/sector-chain helpers) and
 * `ole2-parser-write-serialize.ts` (header/directory/stream serialization)
 * hold everything this file's `buildOle2` orchestrates.
 *
 * Reference: [MS-CFB] Compound Binary File Format
 * @see https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-cfb
 *
 * @module ole2-parser-write
 */

import {
	ENDOFCHAIN,
	ENTRY_TYPE_ROOT,
	ENTRY_TYPE_STREAM,
	FATSECT,
	DIR_ENTRY_SIZE,
} from './ole2-parser-types';
import {
	compareDirEntryNames,
	writeFatChain,
	writeFatRun,
	writeInt32Sectors,
} from './ole2-parser-write-helpers';
import type { DirEntry, SectorChain } from './ole2-parser-write-helpers';
import {
	serializeDirectoryEntries,
	writeHeader,
	writeStreamSectors,
} from './ole2-parser-write-serialize';

/**
 * Build an OLE2 compound binary file from named streams.
 *
 * Creates a minimal v3 OLE2 container suitable for encrypted OOXML packages
 * (or, with `rootClsid`, for a document format such as legacy `.ppt` whose
 * host application identifies the storage by its root entry's CLSID).
 *
 * @param streams - Map of stream names to their binary data.
 * @param rootClsid - Optional 16-byte storage CLSID for the root entry. See
 *   `DirEntry.clsid` in `ole2-parser-write-helpers.ts`. Omit to keep the
 *   previous all-zero behaviour.
 * @param miniStreamCutoff - Minimum size (bytes) a stream must reach to be
 *   allocated from the regular FAT instead of the mini FAT/mini stream.
 *   Defaults to the [MS-CFB] convention (0x1000 = 4096). Pass 0 to disable
 *   the mini stream entirely (every stream goes through the regular FAT
 *   regardless of size): real PowerPoint COM-authored `.ppt` files always do
 *   this in practice (`Current User` and `\5DocumentSummaryInformation` are
 *   padded to exactly 4096 bytes specifically so they never dip under the
 *   cutoff), and a from-scratch `.ppt` whose tiny `Current User` /
 *   `PowerPoint Document` streams instead landed in a spec-correct mini
 *   stream (this writer's mini-FAT implementation matches
 *   `ole2-parser-read.ts`'s reader byte-for-byte) was rejected by real
 *   PowerPoint ("the file or directory is corrupted and unreadable",
 *   0x80070570, confirmed distinct from Office File Validation by retrying
 *   with `Application.FileValidation` set to skip) while the same content
 *   routed through the regular FAT opened. See `ppt/writer/write-ppt.ts`'s
 *   caller for the `.ppt`-specific override, and
 *   `ppt/writer/document-stream-layout.ts`'s `ensureMinimumDocumentStreamSize`
 *   for the SECOND half of that same requirement: even routed through the
 *   regular FAT, `Current User` must stay in a strictly smaller CFB sector
 *   count than "PowerPoint Document" itself, confirmed by a from-scratch
 *   deck small enough to tie them failing to open the same way.
 * @returns ArrayBuffer of the complete OLE2 file.
 */
export function buildOle2(
	streams: Map<string, Uint8Array>,
	rootClsid?: Uint8Array,
	miniStreamCutoff = 0x1000,
): ArrayBuffer {
	const sectorSize = 512;
	const miniSectorSize = 64;

	// Separate mini-streams from regular streams
	const regularStreams: Array<{ name: string; data: Uint8Array }> = [];
	const miniStreams: Array<{ name: string; data: Uint8Array }> = [];

	for (const [name, data] of streams) {
		if (data.length < miniStreamCutoff) {
			miniStreams.push({ name, data });
		} else {
			regularStreams.push({ name, data });
		}
	}

	// Allocate sectors for regular streams
	let nextSector = 0;
	const fatChains: Map<string, SectorChain> = new Map();

	for (const stream of regularStreams) {
		const numSectors = Math.ceil(stream.data.length / sectorSize);
		const sectors: number[] = [];
		for (let i = 0; i < numSectors; i++) {
			sectors.push(nextSector++);
		}
		fatChains.set(stream.name, { start: sectors[0] ?? 0, sectors });
	}

	// Build mini stream container (concatenated mini streams)
	let miniStreamContainer = new Uint8Array(0);
	const miniFatChains: Map<string, SectorChain> = new Map();
	let nextMiniSector = 0;

	if (miniStreams.length > 0) {
		let miniStreamSize = 0;
		for (const s of miniStreams) {
			miniStreamSize += Math.ceil(s.data.length / miniSectorSize) * miniSectorSize;
		}
		miniStreamContainer = new Uint8Array(miniStreamSize);
		let miniOffset = 0;

		for (const stream of miniStreams) {
			const numMiniSectors = Math.ceil(stream.data.length / miniSectorSize);
			const miniSectors: number[] = [];
			for (let i = 0; i < numMiniSectors; i++) {
				miniSectors.push(nextMiniSector++);
				const srcOffset = i * miniSectorSize;
				const srcEnd = Math.min(srcOffset + miniSectorSize, stream.data.length);
				miniStreamContainer.set(stream.data.subarray(srcOffset, srcEnd), miniOffset);
				miniOffset += miniSectorSize;
			}
			miniFatChains.set(stream.name, {
				start: miniSectors[0] ?? 0,
				sectors: miniSectors,
			});
		}
	}

	// Allocate sectors for mini stream container (root entry data)
	let rootStartSector = -1;
	const rootSectors: number[] = [];
	if (miniStreamContainer.length > 0) {
		const numSectors = Math.ceil(miniStreamContainer.length / sectorSize);
		rootStartSector = nextSector;
		for (let i = 0; i < numSectors; i++) {
			rootSectors.push(nextSector++);
		}
	}

	// Build directory entries: Root + all streams
	const dirEntries: DirEntry[] = [];

	dirEntries.push({
		name: 'Root Entry',
		type: ENTRY_TYPE_ROOT,
		startSector: rootStartSector === -1 ? ENDOFCHAIN : rootStartSector,
		size: miniStreamContainer.length,
		clsid: rootClsid,
	});

	for (const stream of regularStreams) {
		const chain = fatChains.get(stream.name)!;
		dirEntries.push({
			name: stream.name,
			type: ENTRY_TYPE_STREAM,
			startSector: chain.start,
			size: stream.data.length,
		});
	}

	for (const stream of miniStreams) {
		const chain = miniFatChains.get(stream.name)!;
		dirEntries.push({
			name: stream.name,
			type: ENTRY_TYPE_STREAM,
			startSector: chain.start,
			size: stream.data.length,
		});
	}

	// Sort the non-root entries into [MS-CFB] directory order. Each DirEntry is
	// self-contained (it already carries its own start sector + size), so the
	// stream/mini-FAT allocations above are unaffected by the reorder. Sorting
	// here lets serializeDirectoryEntries emit an ascending right-sibling chain,
	// which is a valid binary search tree that conformant readers (PowerPoint)
	// can traverse to find every stream by name.
	const [rootEntry, ...streamEntries] = dirEntries;
	streamEntries.sort((a, b) => compareDirEntryNames(a.name, b.name));
	const sortedDirEntries = [rootEntry!, ...streamEntries];

	// Allocate directory sectors
	const numDirSectors = Math.ceil((dirEntries.length * DIR_ENTRY_SIZE) / sectorSize);
	const firstDirSector = nextSector;
	nextSector += numDirSectors;

	// Allocate mini FAT sectors
	let firstMiniFATSector = ENDOFCHAIN;
	let numMiniFATSectors = 0;
	if (miniStreams.length > 0) {
		numMiniFATSectors = Math.ceil((nextMiniSector * 4) / sectorSize);
		firstMiniFATSector = nextSector;
		nextSector += numMiniFATSectors;
	}

	// Allocate FAT sectors
	// Total sectors so far + FAT sectors must be coverable by FAT
	let numFATSectors = 1;
	while (true) {
		const totalSectors = nextSector + numFATSectors;
		const entriesPerFAT = sectorSize / 4;
		const neededFATSectors = Math.ceil(totalSectors / entriesPerFAT);
		if (neededFATSectors <= numFATSectors) {
			break;
		}
		numFATSectors = neededFATSectors;
	}
	const firstFATSector = nextSector;
	nextSector += numFATSectors;

	const totalSectors = nextSector;

	// Build FAT
	const fat = new Int32Array(numFATSectors * (sectorSize / 4));
	fat.fill(-1); // FREESECT

	for (const [, chain] of fatChains) {
		writeFatChain(fat, chain);
	}
	writeFatChain(fat, { start: rootSectors[0] ?? 0, sectors: rootSectors });
	writeFatRun(fat, firstDirSector, numDirSectors);
	if (numMiniFATSectors > 0) {
		writeFatRun(fat, firstMiniFATSector, numMiniFATSectors);
	}
	for (let i = 0; i < numFATSectors; i++) {
		fat[firstFATSector + i] = FATSECT;
	}

	// Build mini FAT
	let miniFat: Int32Array | undefined;
	if (miniStreams.length > 0) {
		miniFat = new Int32Array(numMiniFATSectors * (sectorSize / 4));
		miniFat.fill(-1); // FREESECT
		for (const [, chain] of miniFatChains) {
			writeFatChain(miniFat, chain);
		}
	}

	// Build the output file
	const fileSize = (totalSectors + 1) * sectorSize; // +1 for header
	const output = new ArrayBuffer(fileSize);
	const outView = new DataView(output);
	const outBytes = new Uint8Array(output);

	// Write header
	writeHeader(outView, outBytes, {
		numFATSectors,
		firstDirSector,
		miniStreamCutoff,
		firstMiniFATSector,
		numMiniFATSectors,
		firstFATSector,
	});

	// Write regular stream data
	for (const stream of regularStreams) {
		writeStreamSectors(outBytes, stream.data, fatChains.get(stream.name)!, sectorSize);
	}

	// Write mini stream container
	if (miniStreamContainer.length > 0) {
		writeStreamSectors(
			outBytes,
			miniStreamContainer,
			{ start: rootSectors[0] ?? 0, sectors: rootSectors },
			sectorSize,
		);
	}

	// Write directory entries
	const dirData = serializeDirectoryEntries(sortedDirEntries, numDirSectors, sectorSize);
	for (let i = 0; i < numDirSectors; i++) {
		const sectorOff = (firstDirSector + i + 1) * sectorSize;
		outBytes.set(dirData.subarray(i * sectorSize, (i + 1) * sectorSize), sectorOff);
	}

	// Write mini FAT
	if (miniFat) {
		writeInt32Sectors(outBytes, miniFat, firstMiniFATSector, numMiniFATSectors, sectorSize);
	}

	// Write FAT sectors
	writeInt32Sectors(outBytes, fat, firstFATSector, numFATSectors, sectorSize);

	return output;
}
