import type { OpenXmlCoverageFacets } from './openxml-coverage';
import { testEvidence } from './openxml-coverage-evidence';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

assign(
	[
		'drawing:complexType:CT_Transform2D',
		'drawing:complexType:CT_GroupTransform2D',
		'drawing:element:off',
		'drawing:element:ext',
		'drawing:element:chOff',
		'drawing:element:chExt',
		'drawing:element:xfrm',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Shape and group offset, extent, rotation, and flip round-trip through the typed transform model, including nested group child-space scaling.',
		evidence: [
			testEvidence(
				'src/core/core/runtime/group-shape-geometry.test.ts',
				[
					'reads the parent offset and extent',
					'computes ext / chExt as the child scale',
					'reads @_rot as 60000ths of a degree and collapses zero to undefined',
					'reads both boolean forms of @_flipH / @_flipV',
				],
				['parse'],
			),
			testEvidence(
				'src/core/builders/factories/connector-xml-factory-spec.test.ts',
				['should set rotation, flipH, flipV on a:xfrm'],
				['edit', 'serialize'],
			),
			testEvidence(
				'src/core/core/builders/PptxElementTransformUpdater.test.ts',
				['sets flipH=1 when flipHorizontal is true', 'sets flipV=1 when flipVertical is true'],
				['edit', 'serialize'],
			),
			testEvidence(
				'src/__tests__/integration/pptx-handler.test.ts',
				['should preserve element positions through load -> save -> load'],
				['preserve', 'serialize'],
			),
			testEvidence(
				'src/__tests__/integration/ppt-import.test.ts',
				['imports shape positions within tolerance of the original'],
				['parse'],
			),
		],
	},
);

assign(
	[
		'drawing:complexType:CT_PresetGeometry2D',
		'drawing:complexType:CT_CustomGeometry2D',
		'drawing:element:custGeom',
		'drawing:element:prstGeom',
		'drawing:simpleType:ST_ShapeType',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'All 187 ST_ShapeType presets carry evaluated geometry (none fall back to a bare rectangle), the alias table normalises spelling/case, and custGeom command sequences round-trip through the typed path model.',
		evidence: [
			testEvidence(
				'src/core/geometry/preset-geometry-names.test.ts',
				['carries an evaluated definition for all 187 ST_ShapeType presets'],
				['parse'],
			),
			testEvidence(
				'src/core/geometry/shape-geometry.test.ts',
				['maps all primary shapes correctly', 'is case-insensitive'],
				['parse'],
			),
			testEvidence(
				'src/core/geometry/custom-geometry-command-order.test.ts',
				['preserves interleaved commands through parse, model, serialize, and reload'],
				['preserve', 'edit', 'serialize'],
			),
		],
	},
);

assign(
	[
		'drawing:complexType:CT_GeomGuideList',
		'drawing:complexType:CT_GeomGuide',
		'drawing:simpleType:ST_AdjCoordinate',
		'drawing:simpleType:ST_AdjAngle',
		'drawing:element:gd',
		'drawing:element:gdLst',
		'drawing:element:avLst',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: "Adjustment guide lists and formulas parse into a typed model, including deferral of geometry-dependent and cross-referencing formulas; all guide-formula operators are evaluated, including the pin clamp and ?: conditional. Since wave 2 (W2-J), a preset shape's shapeAdjustments are also validated against that preset's real ECMA-376 avLst guide names before being serialized into a:avLst/a:gd (geometry/preset-adjustment-validation.ts, filterValidShapeAdjustmentEntries, wired into PptxHandlerRuntimeSaveElementEmbedding.applyGeometryUpdate and TextShapeXmlFactory.ts): an unrecognised guide name used to reach the saved XML unfiltered and produce a file real PowerPoint refuses to open (0x80070570), COM-verified before and after the fix, and now emits an SAVE_SHAPE_ADJUSTMENT_INVALID_GUIDE warning and is dropped instead. That filter is only as correct as this project's own avLst table: the table disagrees with PowerPoint's real guides for the 12 action-button presets (real: 0 guides, table: adj) and gear6/gear9 (real: 2 guides, table: 1), so shapeAdjustments on those specific presets can still corrupt a save until a COM audit of the table itself lands.",
		evidence: [
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeGeometryParsing.test.ts',
				[
					'should parse a single adjustment with @_val',
					'should evaluate a pin (clamp) fmla over literals',
					'should defer a geometry-dependent fmla (needs shape width/height)',
				],
				['parse'],
			),
			testEvidence(
				'src/core/geometry/guide-formula-eval.test.ts',
				['?: returns y when x > 0, else z', 'pin clamps y between x and z'],
				['parse', 'edit'],
			),
			testEvidence(
				'src/core/geometry/custom-geometry-command-order.test.ts',
				['preserves interleaved commands through parse, model, serialize, and reload'],
				['preserve', 'serialize'],
			),
			testEvidence(
				'src/core/geometry/preset-adjustment-validation.test.ts',
				[
					'drops a guide name that is not a real handle for the resolved preset',
					'drops every entry for a preset with zero real adjustment guides (rect)',
					'passes entries through unfiltered for a preset the table does not resolve',
				],
				['edit', 'serialize'],
			),
		],
	},
);

assign(
	[
		'drawing:complexType:CT_GeomRect',
		'drawing:complexType:CT_Path2DList',
		'drawing:complexType:CT_Path2DMoveTo',
		'drawing:complexType:CT_Path2DLineTo',
		'drawing:complexType:CT_Path2DArcTo',
		'drawing:complexType:CT_Path2DQuadBezierTo',
		'drawing:complexType:CT_Path2DCubicBezierTo',
		'drawing:complexType:CT_Path2DClose',
		'drawing:element:rect',
		'drawing:element:pathLst',
		'drawing:element:moveTo',
		'drawing:element:lnTo',
		'drawing:element:arcTo',
		'drawing:element:quadBezTo',
		'drawing:element:cubicBezTo',
		'drawing:element:close',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: "Every CT_Path2D command type (move, line, arc, quadratic and cubic Bezier, close) and the custGeom text rect round-trip through the typed path model with command order preserved. A rendering-only edge case (an arcTo sweep of 360 degrees or more collapsing to its mod-360 remainder in the SVG conversion, no shipped preset triggers it) affects packages/shared rendering, not this round-trip. Since wave 2 (W2-G), a:pathLst's own formula-bearing XML is also preserved verbatim (CustomGeometryRawData.pathLstXml) and re-derived on save from a live re-evaluation against the CURRENT shapeAdjustments/a:gdLst overrides (geometry/custom-geometry-live-eval.ts: evaluateCustomGeometryPaths, resolveSaveTimeCustomGeometryPaths), instead of only ever emitting the numbers frozen at parse time, so a saved custGeom's a:pathLst coordinates stay consistent with the a:avLst it commits in the same save.",
		evidence: [
			testEvidence(
				'src/core/geometry/custom-geometry-command-order.test.ts',
				['preserves interleaved commands through parse, model, serialize, and reload'],
				['parse', 'preserve', 'edit', 'serialize'],
			),
			testEvidence(
				'src/core/geometry/custom-geometry.test.ts',
				[
					'converts a cubic Bezier segment',
					'converts a quadratic Bezier segment',
					'parses C (cubic Bezier) commands',
					'parses Q (quadratic Bezier) commands',
					'serializes cubic Bezier segments',
					'extracts all 3 control points from cubicBezTo',
					'extracts both control points from quadBezTo',
				],
				['parse', 'serialize'],
			),
			testEvidence(
				'src/core/geometry/custom-geometry-live-eval.test.ts',
				[
					're-evaluates the outline live against an in-progress shapeAdjustments override',
					're-evaluates structured per-sub-path segments against an override',
				],
				['edit'],
			),
			testEvidence(
				'src/__tests__/integration/custom-geometry-live-eval-parity.test.ts',
				[
					'preserves a:pathLst raw XML on customGeometryRawData alongside avLst/gdLst',
					're-derives the outline at a live adj1 override the parsed pathData never saw',
					'saves a:pathLst coordinates that match the a:avLst it commits (single source of truth)',
				],
				['parse', 'preserve', 'edit', 'serialize'],
			),
		],
	},
);

assign(
	[
		'drawing:complexType:CT_NonVisualConnectorProperties',
		'drawing:element:stCxn',
		'drawing:element:endCxn',
	],
	{
		parse: 'native',
		preserve: 'unassessed',
		edit: 'native',
		serialize: 'native',
		note: 'Connector start/end connection-site references (shape id + connection index) parse and re-serialize for connector auto-routing. No dedicated round-trip test evidencing preserve was found, so preserve is left unassessed rather than assumed.',
		evidence: [
			testEvidence(
				'src/core/core/builders/connector-parser.test.ts',
				[
					'extracts start connection point with shapeId and idx',
					'extracts end connection point with shapeId and idx',
					'extracts both start and end connection points',
				],
				['parse'],
			),
			testEvidence(
				'src/core/builders/factories/connector-xml-factory-spec.test.ts',
				['should set connection points for stCxn and endCxn'],
				['edit', 'serialize'],
			),
		],
	},
);

assign(
	[
		'drawing:complexType:CT_ShapeLocking',
		'drawing:complexType:CT_GroupLocking',
		'drawing:complexType:CT_PictureLocking',
		'drawing:complexType:CT_ConnectorLocking',
		'drawing:complexType:CT_ContentPartLocking',
		'drawing:complexType:CT_GraphicalObjectFrameLocking',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Each of the five lock complex types is edited through a per-container attribute allow-list (a lock not defined on that container, e.g. noTextEdit on a:picLocks, is never written), verified for shapes, groups, pictures, connectors, and nested groups.',
		evidence: [
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeElementActions.test.ts',
				[
					'writes a:spLocks onto p:cNvSpPr for a shape',
					'keeps a:grpSpLocks/@noUngrp, which CT_GroupLocking has and the model does not',
					'does not write noTextEdit onto a:picLocks (not in CT_PictureLocking)',
					'does not write noTextEdit onto a:cxnSpLocks (not in CT_ConnectorLocking)',
					'does not write noDrilldown onto a:spLocks (CT_GraphicalObjectFrameLocking only)',
				],
				['parse', 'edit', 'serialize'],
			),
			testEvidence(
				'src/__tests__/integration/graphic-frame-locks-roundtrip.test.ts',
				[
					'parses a:graphicFrameLocks on a table and preserves it across a save',
					'persists a lock edited on a group nested inside another group',
				],
				['parse', 'preserve', 'edit', 'serialize'],
			),
		],
	},
);

export const OPENXML_SHAPE_GEOMETRY_CONNECTORS_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
