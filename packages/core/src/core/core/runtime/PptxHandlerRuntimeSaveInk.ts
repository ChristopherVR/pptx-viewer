import type { InkPptxElement, XmlObject } from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveOleEmbedding';

const INK_GRAPHIC_DATA_URI = 'http://schemas.microsoft.com/office/drawing/2010/ink';
const INK_NAMESPACE = 'http://schemas.microsoft.com/office/drawing/2010/ink';

function pathToTrace(path: string): string {
	const points: string[] = [];
	for (const match of path.matchAll(/[ML]\s*(?<x>[\d.eE+-]+)[,\s]+(?<y>[\d.eE+-]+)/giu)) {
		const x = Number(match.groups?.x);
		const y = Number(match.groups?.y);
		if (Number.isFinite(x) && Number.isFinite(y)) {
			points.push(`${x},${y}`);
		}
	}
	return points.join(' ');
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/** Build editable Office 2010 ink plus a custGeom fallback for older consumers. */
	protected createInkGraphicFrameXml(el: InkPptxElement): XmlObject {
		const emu = PptxHandlerRuntime.EMU_PER_PX;
		const x = String(Math.round(el.x * emu));
		const y = String(Math.round(el.y * emu));
		const width = String(Math.round(Math.max(el.width, 1) * emu));
		const height = String(Math.round(Math.max(el.height, 1) * emu));
		const traces = el.inkPaths
			.map((path, index): XmlObject | undefined => {
				const text = pathToTrace(path);
				if (!text) {
					return undefined;
				}
				return {
					'@_brushColor': (el.inkColors?.[index] ?? '#000000').replace('#', ''),
					'@_brushSize': String(el.inkWidths?.[index] ?? 2),
					'#text': text,
				};
			})
			.filter((trace): trace is XmlObject => Boolean(trace));
		const fallbackShape = this.createInkShapeXml(el);

		return {
			'p:nvGraphicFramePr': {
				'p:cNvPr': { '@_id': '0', '@_name': el.name || el.id },
				'p:cNvGraphicFramePr': {},
				'p:nvPr': {},
			},
			'p:xfrm': {
				'a:off': { '@_x': x, '@_y': y },
				'a:ext': { '@_cx': width, '@_cy': height },
			},
			'a:graphic': {
				'a:graphicData': {
					'@_uri': INK_GRAPHIC_DATA_URI,
					'mc:AlternateContent': {
						'@_xmlns:mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
						'mc:Choice': {
							'@_Requires': 'aink',
							'@_xmlns:aink': INK_NAMESPACE,
							'aink:ink': {
								'aink:inkBrush': {
									'@_brushColor': (el.inkColors?.[0] ?? '#000000').replace('#', ''),
									'@_brushSize': String(el.inkWidths?.[0] ?? 2),
								},
								'aink:trace': traces,
							},
						},
						'mc:Fallback': { 'p:sp': fallbackShape },
					},
				},
			},
		};
	}
}
