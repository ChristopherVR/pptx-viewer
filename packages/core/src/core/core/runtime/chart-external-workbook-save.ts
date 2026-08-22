/**
 * Save-side glue between an edited chart's cache-write loop and the
 * embedded-workbook writer in `utils/chart-xlsx-writer.ts`.
 *
 * Resolves a chart's `c:externalData` reference to its embedded xlsx part
 * inside the SAME package zip already being saved, hands the collected
 * cell writes to {@link writeChartWorkbookUpdates}, and stores the result
 * back into the zip. Every way the reference can fail to resolve (no
 * linked workbook, an external/non-xlsx target, a missing or unreadable
 * part, or individual writes the range parser could not place) degrades
 * safely: the chart's `c:numCache`/`c:strCache` edit (already applied by
 * the caller) stands as the saved result, and a {@link CompatibilityWarningInput}
 * is reported instead of throwing.
 *
 * @module chart-external-workbook-save
 */

import type JSZip from 'jszip';

import type { CompatibilityWarningInput } from '../../services/PptxCompatibilityService';
import type { PptxExternalData } from '../../types';
import type { PptxChartWorkbookWrite } from '../../utils/chart-xlsx-writer';
import { writeChartWorkbookUpdates } from '../../utils/chart-xlsx-writer';

/** The runtime primitives this module needs, kept explicit for testability. */
export interface ChartExternalWorkbookSaveDeps {
	zip: JSZip;
	resolveImagePath(basePath: string, target: string): string;
	reportWarning(warning: CompatibilityWarningInput): void;
}

/**
 * Rewrite a chart's embedded workbook to match its edited series/category/
 * name data, or report why it could not be, without ever throwing.
 */
export async function saveChartExternalWorkbookUpdates(
	deps: ChartExternalWorkbookSaveDeps,
	chartPartPath: string,
	slidePath: string,
	externalData: PptxExternalData | undefined,
	writes: readonly PptxChartWorkbookWrite[],
): Promise<void> {
	if (writes.length === 0 || !externalData?.targetPath) {
		// No data edits collected, or the chart has no linked external data at
		// all (the normal case for most charts) - nothing to reconcile.
		return;
	}

	const embeddingPath = deps.resolveImagePath(chartPartPath, externalData.targetPath);
	const looksEmbedded = embeddingPath.includes('embeddings/') && /\.xlsx$/iu.test(embeddingPath);
	if (!looksEmbedded) {
		// e.g. TargetMode="External" pointing outside the package, or a legacy
		// .xls/.xlsb workbook this module does not parse.
		deps.reportWarning({
			code: 'CHART_EXTERNAL_DATA_WRITEBACK_UNSUPPORTED',
			message:
				'Chart data changes were saved to the cached values only: the linked data source is external or not an embedded .xlsx workbook, so it was not updated.',
			severity: 'info',
			scope: 'save',
			slideId: slidePath,
			xmlPath: chartPartPath,
		});
		return;
	}

	const xlsxFile = deps.zip.file(embeddingPath);
	if (!xlsxFile) {
		deps.reportWarning({
			code: 'CHART_EMBEDDED_WORKBOOK_MISSING',
			message:
				'Chart data changes were saved to the cached values only: the referenced embedded workbook was not found in the package.',
			severity: 'warning',
			scope: 'save',
			slideId: slidePath,
			xmlPath: embeddingPath,
		});
		return;
	}

	let xlsxBytes: Uint8Array;
	try {
		xlsxBytes = await xlsxFile.async('uint8array');
	} catch {
		deps.reportWarning({
			code: 'CHART_EMBEDDED_WORKBOOK_UNREADABLE',
			message:
				'Chart data changes were saved to the cached values only: the referenced embedded workbook could not be read.',
			severity: 'warning',
			scope: 'save',
			slideId: slidePath,
			xmlPath: embeddingPath,
		});
		return;
	}

	const result = await writeChartWorkbookUpdates(xlsxBytes, writes);
	if (result.bytes) {
		deps.zip.file(embeddingPath, result.bytes);
	}
	if (result.unresolved > 0) {
		deps.reportWarning({
			code: 'CHART_EMBEDDED_WORKBOOK_PARTIAL_WRITEBACK',
			message: `${result.unresolved} chart data update(s) could not be matched to a cell in the linked workbook and were saved to the cached values only.`,
			severity: 'info',
			scope: 'save',
			slideId: slidePath,
			xmlPath: embeddingPath,
		});
	}
}
