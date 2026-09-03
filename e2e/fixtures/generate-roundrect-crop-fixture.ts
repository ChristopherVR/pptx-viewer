/**
 * Generates `roundrect-crop.pptx`: a one-slide deck with a picture that carries
 * BOTH its own preset geometry (`prstGeom prst="roundRect"`) AND a source crop
 * (`a:srcRect`). This is the case the picture-geometry-mask change had to get
 * right: on load `cropShape` is derived from the roundRect geometry, and the
 * picture's source is cropped, so the img is transformed inside the frame.
 *
 * The five bindings must agree on where the mask rides. Vue, Svelte and React
 * clip the STATIONARY container (correct rounded corners); Angular and Vanilla
 * clip the transformed `<img>` (the rounded shape scales and shifts with the
 * crop). Open the deck in several bindings and compare the corner curvature of
 * the orange picture.
 *
 * Run with: bun run e2e/fixtures/generate-roundrect-crop-fixture.ts
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
const JSZip = coreRequire('jszip');

const EMU_PER_PT = 12700;
const SLIDE_W = 720 * EMU_PER_PT;
const SLIDE_H = 405 * EMU_PER_PT;

const rel = (id: string, type: string, target: string) =>
	`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;

/** A picture: roundRect preset geometry, an explicit source crop, embedded art. */
const picture = (id: number, name: string, x: number, y: number, w: number, h: number) =>
	`<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${name}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:srcRect r="50000"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x * EMU_PER_PT}" y="${y * EMU_PER_PT}"/><a:ext cx="${w * EMU_PER_PT}" cy="${h * EMU_PER_PT}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 16667"/></a:avLst></a:prstGeom></p:spPr></p:pic>`;

const pictureEl = picture(2, 'Rounded Crop', 40, 120, 400, 225);

const zip = new JSZip();
zip.file(
	'[Content_Types].xml',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/media/image1.png" ContentType="image/png"/></Types>`,
);
zip.file(
	'_rels/.rels',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'officeDocument', 'ppt/presentation.xml')}</Relationships>`,
);
zip.file(
	'ppt/presentation.xml',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}"/><p:notesSz cx="${SLIDE_H}" cy="${SLIDE_W}"/></p:presentation>`,
);
zip.file(
	'ppt/_rels/presentation.xml.rels',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideMaster', 'slideMasters/slideMaster1.xml')}${rel('rId2', 'slide', 'slides/slide1.xml')}</Relationships>`,
);
zip.file(
	'ppt/theme/theme1.xml',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="T"><a:themeElements><a:clrScheme name="T"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="000000"/></a:dk2><a:lt2><a:srgbClr val="FFFFFF"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="T"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="T"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`,
);
zip.file(
	'ppt/slideMasters/slideMaster1.xml',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`,
);
zip.file(
	'ppt/slideMasters/_rels/slideMaster1.xml.rels',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml')}${rel('rId2', 'theme', '../theme/theme1.xml')}</Relationships>`,
);
zip.file(
	'ppt/slideLayouts/slideLayout1.xml',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
);
zip.file(
	'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideMaster', '../slideMasters/slideMaster1.xml')}</Relationships>`,
);
zip.file(
	'ppt/slides/slide1.xml',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${pictureEl}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
);
zip.file(
	'ppt/slides/_rels/slide1.xml.rels',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml')}${rel('rId2', 'image', '../media/image1.png')}</Relationships>`,
);
zip.file(
	'ppt/media/image1.png',
	Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAMgAAAB4CAYAAAC3kr3rAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAARrSURBVHhe7ZNJbhtBEAT5Jr/OL/Y3bNCuhqxUcsQkZ+klEohLAXWLuP36+eM3AHhuegCADwgEYAMCAdiAQAA2sIHcbjeAJfnSgh5aIHoDmB3nPYEAFM57AgEonPcEAlA47wkEoHDeEwhA4bwnEIDCeU8gAIXznkAACuc9gQAUznsCASic9wQCUDjvCQSgcN4TCEDhvN89kPvvHcaumPqY4LzfPZA2QmFXTH1McN4fFkgbobAzpz4mOO8PD6SNUNgZUx8TnPenBdJGKOzIqY8JzvvTA2kjFHbE1McE5/1lgbQRCttz6mOC8/7yQNoIhe0x9THBed9NIG2Ewt6Z+pjgvO8ukDZCYa9MfUxw3ncbSBuhsGTqY4LzvvtA2giFPTP1McF5P0wgbYTCtqY+JjjvhwukjVCYm/qY4LwfNpA2QmH/T31McN4PH0gbobD71McE5/00gbQRytpTHxOc99MF0kYoa059THDeTxtIG6GsNfUxwXk/fSBthLLG1McE5/0ygbQRytxTHxOc98sF0kYoc059THDeLxtIG6HMNfUxwXm/fCBthDLH1McE5z2ByAhl7KmPCc57AnkwQhlz6mOC855AvhmhjDX1McF5TyBPjlDGmPqY4LwnkHCE0vfUxwTnPYG8OELpc+pjgvOeQN4cofQ19THBeU8gO41Q+pj6mOC8J5CdRyjXTn1McN4TyEEjlGumPiY47wnk4BHKuVMfE5z3BHLSCOWcqY8JznsCOXmEcuzUxwTnPYFcNEI5ZupjgvOeQC4eoew79THBeU8gnYxQ9pn6mOC8J5DORijvTX1McN4TSKcjlNemPiY47wmk8xFKNvUxwXlPIIOMUJ6b+pjgvCeQwUYo21MfE5z3BDLoCMVPfUxw3hPI4COUz1MfE5z3BDLJCOXf1McE5z2BTLbVQ1EfE5z3BDLpVg1FfUxw3hPI5FstFPUxwXlPIItslVDUxwTnPYEsttlDUR8TnPcEsuhmDUV9THDeE8jimy0U9THBeU8g7O9mCUV9THDeEwj7tNFDUR8TnPcEwuxGDUV9THDeEwjb3GihqI8JznsCYU9tlFDUxwTnPYGwaL2Hoj4mOO8JhL20XkNRHxOc9wTC3lpvoaiPCc57AmG7rJdQ1McE5z2BsF13dSjqY4LznkDYIbsqFPUxwXlPIOzQnR2K+pjgvCcQdsrOCkV9THDeEwg7dUeHoj4mOO8JhF2yo0JRHxOc9wTCLt3eoaiPCc57AmFdbK9Q1McE5z2BsK72bijqY4LznkBYl3s1FPUxwXlPIKzrpaGojwnOewJhQ+zZUNTHBOc9gbCh9l0o6mOC855A2JB7FIr6mOC8JxA29DQU9THBeU8gbIq1UNTHBPe/eyAAV/KOu+6XQAAK5z2BABTOewIBKJz3BAJQOO8JBKBw3hMIQOG8JxCAwnlPIACF855AAArnPYEAFM57AgEonPcEAlA47wkEoHDeEwhA4bx/GAjAinxpQQ8A8AGBAGxAIAAbEAjABn8AFzmw8OBQpasAAAAASUVORK5CYII=',
		'base64',
	),
);

const out = fileURLToPath(new URL('./roundrect-crop.pptx', import.meta.url));
writeFileSync(out, await zip.generateAsync({ type: 'nodebuffer' }));
console.log(`wrote ${out}`);
