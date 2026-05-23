/**
 * @fileoverview Chart external data parsing for OOXML chart parts.
 *
 * This mixin adds methods for resolving external data references
 * (`c:externalData`), reading embedded xlsx workbooks, and parsing
 * a chart part's `.rels` relationship file.
 *
 * Mixin chain position:
 *   `PptxHandlerRuntimeChartParsingHelpers` → **this** → `PptxHandlerRuntimeChartColorStyle`
 */

import { XmlObject } from '../../types';
import type { PptxExternalData, PptxEmbeddedWorkbookData } from '../../types';
import { parseEmbeddedXlsx } from '../../utils/chart-xlsx-parser';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeChartParsingHelpers';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Parse `c:externalData` from the chart's `c:chartSpace` and resolve
	 * the external relationship target from the chart part's .rels file.
	 *
	 * In OOXML, `c:externalData` contains `@r:id` referencing a relationship
	 * in the chart part's own .rels file with `TargetMode="External"`, typically
	 * pointing to an external Excel workbook.
	 */
	protected async parseChartExternalData(
		chartSpace: XmlObject | undefined,
		chartPartPath: string,
	): Promise<PptxExternalData | undefined> {
		if (!chartSpace) {
			return undefined;
		}

		const externalDataNode = this.xmlLookupService.getChildByLocalName(chartSpace, 'externalData');
		if (!externalDataNode) {
			return undefined;
		}

		const relId = String(externalDataNode['@_r:id'] || externalDataNode['@_id'] || '').trim();
		if (relId.length === 0) {
			return undefined;
		}

		// autoUpdate can appear as a child element <c:autoUpdate val="1"/> or as
		// a direct attribute autoUpdate="1" on the c:externalData element itself.
		const autoUpdateNode = this.xmlLookupService.getChildByLocalName(
			externalDataNode,
			'autoUpdate',
		);
		const autoUpdateAttr = externalDataNode['@_autoUpdate'];
		const autoUpdate =
			autoUpdateNode?.['@_val'] === '1' ||
			autoUpdateNode?.['@_val'] === 'true' ||
			autoUpdateAttr === '1' ||
			autoUpdateAttr === 'true' ||
			false;

		// Resolve the external target from the chart part's .rels file
		let targetPath: string | undefined;
		try {
			const chartDir = chartPartPath.substring(0, chartPartPath.lastIndexOf('/') + 1);
			const chartFileName = chartPartPath.substring(chartPartPath.lastIndexOf('/') + 1);
			const chartRelsPath = `${chartDir}_rels/${chartFileName}.rels`;
			const chartRelsXml = await this.zip.file(chartRelsPath)?.async('string');
			if (chartRelsXml) {
				const chartRelsData = this.parser.parse(chartRelsXml) as XmlObject;
				const relsContainer = chartRelsData?.Relationships as XmlObject | undefined;
				if (relsContainer?.Relationship) {
					const rels = (
						Array.isArray(relsContainer.Relationship)
							? relsContainer.Relationship
							: [relsContainer.Relationship]
					) as XmlObject[];
					for (const rel of rels) {
						if (String(rel?.['@_Id'] || '') === relId) {
							targetPath = String(rel?.['@_Target'] || '').trim() || undefined;
							break;
						}
					}
				}
			}
		} catch {
			// Chart rels file may not exist; that's fine
		}

		// Attempt to read embedded xlsx workbook from the ZIP archive
		let embeddedWorkbookData: Uint8Array | undefined;
		if (targetPath) {
			try {
				const embeddingPath = this.resolveImagePath(chartPartPath, targetPath);
				if (embeddingPath.includes('embeddings/') && embeddingPath.endsWith('.xlsx')) {
					const xlsxBinary = await this.zip.file(embeddingPath)?.async('uint8array');
					if (xlsxBinary) {
						embeddedWorkbookData = xlsxBinary;
					}
				}
			} catch {
				// Embedded workbook may not be accessible; continue without it
			}
		}

		return {
			relId,
			targetPath,
			autoUpdate,
			...(embeddedWorkbookData ? { embeddedWorkbookData } : {}),
		};
	}

	/**
	 * Read and parse the embedded xlsx workbook referenced by chart external data.
	 *
	 * When an embedded xlsx binary is available in the external data reference,
	 * this method uses the chart-xlsx-parser utility to extract structured
	 * categories and series from the first worksheet.
	 */
	protected async parseEmbeddedWorkbook(
		externalData: PptxExternalData | undefined,
	): Promise<PptxEmbeddedWorkbookData | undefined> {
		if (!externalData?.embeddedWorkbookData) {
			return undefined;
		}
		try {
			return await parseEmbeddedXlsx(externalData.embeddedWorkbookData);
		} catch {
			return undefined;
		}
	}

	/**
	 * Read the chart part's `.rels` file and return all relationships as an
	 * array of `{ id, type, target }` objects.
	 */
	protected async readChartRels(
		chartPartPath: string,
	): Promise<Array<{ id: string; type: string; target: string }>> {
		try {
			const chartDir = chartPartPath.substring(0, chartPartPath.lastIndexOf('/') + 1);
			const chartFileName = chartPartPath.substring(chartPartPath.lastIndexOf('/') + 1);
			const chartRelsPath = `${chartDir}_rels/${chartFileName}.rels`;
			const chartRelsXml = await this.zip.file(chartRelsPath)?.async('string');
			if (!chartRelsXml) {
				return [];
			}

			const chartRelsData = this.parser.parse(chartRelsXml) as XmlObject;
			const relsContainer = chartRelsData?.Relationships as XmlObject | undefined;
			if (!relsContainer?.Relationship) {
				return [];
			}

			const rels = Array.isArray(relsContainer.Relationship)
				? relsContainer.Relationship
				: [relsContainer.Relationship];

			return rels
				.filter((rel): rel is XmlObject => Boolean(rel))
				.map((rel) => ({
					id: String(rel['@_Id'] || '').trim(),
					type: String(rel['@_Type'] || '').trim(),
					target: String(rel['@_Target'] || '').trim(),
				}));
		} catch {
			return [];
		}
	}
}
