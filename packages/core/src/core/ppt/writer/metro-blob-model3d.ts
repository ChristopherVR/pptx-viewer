/**
 * `metroBlob` source for 3D models. This project models a 3D model as its
 * own `p16:model3D` markup, which is not what PowerPoint writes, so the
 * package root cannot be lifted from the `.pptx` slide the way ink, SmartArt
 * and charts are. Instead it is synthesised from the element in PowerPoint's
 * own markup: a `p:graphicFrame` (renamed `p:E2oFrame`) carrying an
 * `am3d:model3d` graphic, the `.glb` bytes, and the poster as `am3d:raster`.
 *
 * Ground truth: PowerPoint 16.0's `Shapes.Add3DModel` output. Measured over
 * COM by writing from-scratch `.ppt` files with trimmed variants of it: the
 * shape reopens as `msoModel3D` (`Shape.Type` = 30) with `spPr` + `camera` +
 * `trans` + `objViewport`; dropping `objViewport` (with or without
 * `raster`) makes PowerPoint ignore the package. The camera/transform below
 * are PowerPoint's own defaults for a freshly inserted model (a model has no
 * view state in this project's element to carry over).
 *
 * @module ppt/writer/metro-blob-model3d
 */

import type { Model3DPptxElement } from '../../types';
import { parseDataUrlToBytes } from '../../utils/data-url-utils';
import { elementRectEmu } from './element-rect';
import type { MetroBlobInput } from './metro-blob-package';

const NS =
	'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" ' +
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
	'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
	'xmlns:am3d="http://schemas.microsoft.com/office/drawing/2017/model3d"';
const MODEL3D_URI = 'http://schemas.microsoft.com/office/drawing/2017/model3d';
const MODEL3D_REL = 'http://schemas.microsoft.com/office/2017/06/relationships/model3d';
const IMAGE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';

function escapeAttr(value: string): string {
	return value.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;').replace(/</gu, '&lt;');
}

function modelBody(cx: number, cy: number, hasPoster: boolean): string {
	const raster = hasPoster
		? '<am3d:raster rName="Office3DRenderer" rVer="16.0.8326"><am3d:blip r:embed="rId2"/></am3d:raster>'
		: '';
	return [
		`<am3d:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`,
		'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></am3d:spPr>',
		'<am3d:camera><am3d:pos x="0" y="0" z="66519324"/><am3d:up dx="0" dy="36000000" dz="0"/>',
		'<am3d:lookAt x="0" y="0" z="0"/><am3d:perspective fov="2700000"/></am3d:camera>',
		'<am3d:trans><am3d:meterPerModelUnit n="1000000" d="1000000"/><am3d:preTrans dx="0" dy="0" dz="0"/>',
		'<am3d:scale><am3d:sx n="1000000" d="1000000"/><am3d:sy n="1000000" d="1000000"/>',
		'<am3d:sz n="1000000" d="1000000"/></am3d:scale><am3d:rot/><am3d:postTrans dx="0" dy="0" dz="0"/>',
		'</am3d:trans>',
		raster,
		'<am3d:objViewport viewportSz="3888064"/>',
		'<am3d:ambientLight><am3d:clr><a:scrgbClr r="50000" g="50000" b="50000"/></am3d:clr>',
		'<am3d:illuminance n="500000" d="1000000"/></am3d:ambientLight>',
	].join('');
}

/**
 * Build the `metroBlob` inputs for a 3D model, or `undefined` when its `.glb`
 * bytes are unavailable (`glbBytes` comes from the saved `.pptx` when the
 * element only carries a package path).
 */
export function buildModel3dMetroInput(
	element: Model3DPptxElement,
	glbBytes: Uint8Array | undefined,
): MetroBlobInput | undefined {
	const glb =
		glbBytes ?? (element.modelData ? parseDataUrlToBytes(element.modelData)?.bytes : undefined);
	if (!glb || glb.length === 0) {
		return undefined;
	}
	const poster = element.posterImage ? parseDataUrlToBytes(element.posterImage) : null;
	const posterExt =
		poster && /^(png|jpe?g)$/iu.test(poster.extension) ? poster.extension : undefined;
	const rect = elementRectEmu(element);
	const cx = Math.max(1, Math.round(rect.w));
	const cy = Math.max(1, Math.round(rect.h));
	const id = element.shapeId && /^\d+$/u.test(element.shapeId) ? element.shapeId : '2';
	const name = escapeAttr(element.name ?? '3D Model');
	const rootXml =
		`<p:E2oFrame ${NS}><p:nvGraphicFramePr><p:cNvPr id="${id}" name="${name}"/>` +
		'<p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>' +
		`<p:xfrm><a:off x="${Math.round(rect.x)}" y="${Math.round(rect.y)}"/><a:ext cx="${cx}" cy="${cy}"/></p:xfrm>` +
		`<a:graphic><a:graphicData uri="${MODEL3D_URI}"><am3d:model3d r:embed="rId1">` +
		`${modelBody(cx, cy, Boolean(posterExt))}</am3d:model3d></a:graphicData></a:graphic></p:E2oFrame>`;
	const parts = new Map<string, Uint8Array>([['drs/media/model3d1.glb', glb]]);
	const contentTypes = new Map<string, string>([['drs/media/model3d1.glb', 'model/gltf-binary']]);
	const rootRels = [
		{ id: 'rId1', type: MODEL3D_REL, target: 'media/model3d1.glb', external: false },
	];
	if (poster && posterExt) {
		const ext = posterExt.toLowerCase().startsWith('png') ? 'png' : 'jpeg';
		const path = `drs/media/image1.${ext === 'png' ? 'png' : 'jpg'}`;
		parts.set(path, poster.bytes);
		contentTypes.set(path, `image/${ext}`);
		rootRels.push({ id: 'rId2', type: IMAGE_REL, target: path.slice(4), external: false });
	}
	return { kind: 'graphicFrame', rootXml, shapeId: id, parts: { rootRels, parts, contentTypes } };
}
