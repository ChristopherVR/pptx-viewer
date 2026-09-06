/**
 * Resolve each data point's AND each series' picture-fill blip
 * (`c:dPt|c:ser/c:spPr/a:blipFill/a:blip`) into an actual image URL (C2-G9
 * render half).
 *
 * Split out of `PptxHandlerRuntimeChartParsing.ts` (already well past the
 * repo's file-size guidance) so this integration stays a single call site
 * there instead of a ~50-line inline method.
 *
 * The synchronous `parseSeriesDataPoints`/series parse pass already captures
 * the flags (`PptxChartDataPoint.picture` / `PptxChartSeries.picture`) but
 * cannot resolve `r:embed`/`r:link` itself (that needs the chart part's
 * relationships and zip access), so this re-walks the SAME raw `c:ser` nodes,
 * in the SAME order `parseAllChartContainers` traversed them
 * (container-by-container, in `containerKeys` order), to line each
 * `series[i]` up with its source `c:ser` node and mutate
 * `dataPoints[j].picture.imageUrl` / `series[i].picture.imageUrl` in place.
 *
 * @module runtime/chart-datapoint-picture-resolver
 */
import type { PptxChartData, XmlObject } from '../../types';
import { parseChartDataPointPictureBlipRel } from '../../utils/chart-datapoint-picture';

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
	getChildrenArrayByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject[];
}

type ReadChartRels = (
	chartPartPath: string,
) => Promise<Array<{ id: string; type: string; target: string }>>;
type ResolveImagePath = (basePath: string, target: string) => string;
type GetImageData = (imagePath: string) => Promise<string | undefined>;

/**
 * Mutates `series`: resolves `dataPoints[].picture.imageUrl` in place.
 *
 * Takes the caller's `readChartRels`/`resolveImagePath`/`getImageData` as
 * plain function values (bound methods), not a `this`-shaped host object:
 * `PptxHandlerRuntime` declares all three `protected`, and TypeScript treats
 * assigning a protected class member to a structurally-public interface
 * field as an error, even from a legitimate subclass call site.
 */
export async function resolveDataPointPictureImages(
	xmlLookup: XmlLookupLike,
	readChartRels: ReadChartRels,
	resolveImagePath: ResolveImagePath,
	getImageData: GetImageData,
	plotArea: XmlObject,
	containerKeys: string[],
	series: PptxChartData['series'],
	chartPartPath: string,
): Promise<void> {
	const rawSeriesNodes = containerKeys.flatMap((key) =>
		xmlLookup.getChildrenArrayByLocalName(plotArea[key] as XmlObject | undefined, 'ser'),
	);
	let rels: Array<{ id: string; type: string; target: string }> | undefined;
	for (let si = 0; si < series.length; si++) {
		const seriesNode = rawSeriesNodes[si];
		if (!seriesNode) {
			continue;
		}

		// Series-level c:pictureOptions (CT_BarSer): the same blip lookup as a
		// c:dPt, just rooted at the c:ser node instead of a c:dPt child.
		const seriesPicture = series[si].picture;
		if (seriesPicture) {
			const seriesRelId = parseChartDataPointPictureBlipRel(seriesNode, xmlLookup);
			if (seriesRelId) {
				rels ??= await readChartRels(chartPartPath);
				const seriesRel = rels.find((r) => r.id === seriesRelId);
				if (seriesRel) {
					const imagePath = resolveImagePath(chartPartPath, seriesRel.target);
					const imageUrl = await getImageData(imagePath);
					if (imageUrl) {
						seriesPicture.imageUrl = imageUrl;
					}
				}
			}
		}

		const dataPoints = series[si].dataPoints;
		if (!dataPoints) {
			continue;
		}
		const dPtNodes = xmlLookup.getChildrenArrayByLocalName(seriesNode, 'dPt');
		for (const dPtNode of dPtNodes) {
			const idx = Number.parseInt(
				String(xmlLookup.getChildByLocalName(dPtNode, 'idx')?.['@_val'] ?? ''),
				10,
			);
			const dataPoint = dataPoints.find((dp) => dp.idx === idx);
			if (!dataPoint?.picture) {
				continue;
			}
			const relId = parseChartDataPointPictureBlipRel(dPtNode, xmlLookup);
			if (!relId) {
				continue;
			}
			rels ??= await readChartRels(chartPartPath);
			const rel = rels.find((r) => r.id === relId);
			if (!rel) {
				continue;
			}
			const imagePath = resolveImagePath(chartPartPath, rel.target);
			const imageUrl = await getImageData(imagePath);
			if (imageUrl) {
				dataPoint.picture.imageUrl = imageUrl;
			}
		}
	}
}
