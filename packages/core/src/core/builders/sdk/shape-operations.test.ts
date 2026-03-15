import { describe, it, expect, beforeEach } from "vitest";
import {
	replaceShapeGeometry,
	replaceWithCustomGeometry,
	interpolateShapeGeometry,
	parseSvgPath,
	serializeSvgPath,
} from "./shape-operations";
import { createShapeElement, resetIdCounter } from "./ElementFactory";
import type { ShapePptxElement } from "../../types/elements";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a standard test shape with predictable properties. */
function makeTestShape(
	shapeType = "rect",
	overrides?: Partial<ShapePptxElement>,
): ShapePptxElement {
	const base = createShapeElement(shapeType, {
		x: 100,
		y: 200,
		width: 300,
		height: 150,
		fill: { type: "solid", color: "#FF0000" },
		stroke: { color: "#000000", width: 2 },
		text: "Hello",
		textStyle: { fontSize: 18, bold: true },
	});
	return { ...base, ...overrides };
}

/** Create a shape with custom geometry path data. */
function makeCustomShape(): ShapePptxElement {
	const shape = makeTestShape("rect");
	shape.shapeType = undefined;
	shape.pathData = "M 0 0 L 100 0 L 100 100 Z";
	shape.pathWidth = 100;
	shape.pathHeight = 100;
	return shape;
}

// ---------------------------------------------------------------------------
// replaceShapeGeometry
// ---------------------------------------------------------------------------

describe("replaceShapeGeometry", () => {
	beforeEach(() => {
		resetIdCounter();
	});

	it("should change the shape type", () => {
		const shape = makeTestShape("rect");
		replaceShapeGeometry(shape, "ellipse");
		expect(shape.shapeType).toBe("ellipse");
	});

	it("should preserve the fill styling", () => {
		const shape = makeTestShape("rect");
		const originalFill = shape.shapeStyle?.fillColor;
		replaceShapeGeometry(shape, "roundRect");
		expect(shape.shapeStyle?.fillColor).toBe(originalFill);
	});

	it("should preserve the stroke styling", () => {
		const shape = makeTestShape("rect");
		const originalStroke = shape.shapeStyle?.strokeColor;
		const originalWidth = shape.shapeStyle?.strokeWidth;
		replaceShapeGeometry(shape, "ellipse");
		expect(shape.shapeStyle?.strokeColor).toBe(originalStroke);
		expect(shape.shapeStyle?.strokeWidth).toBe(originalWidth);
	});

	it("should preserve text content", () => {
		const shape = makeTestShape("rect");
		replaceShapeGeometry(shape, "star5");
		expect(shape.text).toBe("Hello");
		expect(shape.textSegments).toBeDefined();
		expect(shape.textSegments!.length).toBeGreaterThan(0);
	});

	it("should preserve text styling", () => {
		const shape = makeTestShape("rect");
		replaceShapeGeometry(shape, "star5");
		expect(shape.textStyle?.fontSize).toBe(18);
		expect(shape.textStyle?.bold).toBe(true);
	});

	it("should preserve position and size", () => {
		const shape = makeTestShape("rect");
		replaceShapeGeometry(shape, "ellipse");
		expect(shape.x).toBe(100);
		expect(shape.y).toBe(200);
		expect(shape.width).toBe(300);
		expect(shape.height).toBe(150);
	});

	it("should set new adjustments when provided", () => {
		const shape = makeTestShape("rect");
		replaceShapeGeometry(shape, "roundRect", { adj: 16667 });
		expect(shape.shapeAdjustments).toEqual({ adj: 16667 });
	});

	it("should clear adjustments when not provided", () => {
		const shape = makeTestShape("rect");
		shape.shapeAdjustments = { adj: 5000 };
		replaceShapeGeometry(shape, "ellipse");
		expect(shape.shapeAdjustments).toBeUndefined();
	});

	it("should clear custom path data when replacing with preset", () => {
		const shape = makeCustomShape();
		expect(shape.pathData).toBeDefined();
		replaceShapeGeometry(shape, "triangle");
		expect(shape.pathData).toBeUndefined();
		expect(shape.pathWidth).toBeUndefined();
		expect(shape.pathHeight).toBeUndefined();
		expect(shape.customGeometryPaths).toBeUndefined();
	});

	it("should clear adjustment handles", () => {
		const shape = makeTestShape("rect");
		shape.adjustmentHandles = [
			{ guideName: "adj", xFraction: 0.5, minValue: 0, maxValue: 50000 },
		];
		replaceShapeGeometry(shape, "ellipse");
		expect(shape.adjustmentHandles).toBeUndefined();
	});

	it("should throw when newShapeType is empty", () => {
		const shape = makeTestShape("rect");
		expect(() => replaceShapeGeometry(shape, "")).toThrow(
			"newShapeType must be a non-empty string",
		);
	});

	it("should throw when newShapeType is whitespace-only", () => {
		const shape = makeTestShape("rect");
		expect(() => replaceShapeGeometry(shape, "   ")).toThrow(
			"newShapeType must be a non-empty string",
		);
	});

	it("should preserve the element id", () => {
		const shape = makeTestShape("rect");
		const originalId = shape.id;
		replaceShapeGeometry(shape, "ellipse");
		expect(shape.id).toBe(originalId);
	});

	it("should preserve the element type discriminant", () => {
		const shape = makeTestShape("rect");
		replaceShapeGeometry(shape, "ellipse");
		expect(shape.type).toBe("shape");
	});

	it("should handle replacing with the same shape type", () => {
		const shape = makeTestShape("rect");
		replaceShapeGeometry(shape, "rect");
		expect(shape.shapeType).toBe("rect");
	});
});

// ---------------------------------------------------------------------------
// replaceWithCustomGeometry
// ---------------------------------------------------------------------------

describe("replaceWithCustomGeometry", () => {
	beforeEach(() => {
		resetIdCounter();
	});

	it("should set the custom path data", () => {
		const shape = makeTestShape("rect");
		replaceWithCustomGeometry(shape, "M 0 0 L 50 100 L 100 0 Z");
		expect(shape.pathData).toBe("M 0 0 L 50 100 L 100 0 Z");
	});

	it("should clear the preset shape type", () => {
		const shape = makeTestShape("roundRect");
		replaceWithCustomGeometry(shape, "M 0 0 L 100 100");
		expect(shape.shapeType).toBeUndefined();
	});

	it("should clear shape adjustments", () => {
		const shape = makeTestShape("roundRect");
		shape.shapeAdjustments = { adj: 16667 };
		replaceWithCustomGeometry(shape, "M 0 0 L 100 100");
		expect(shape.shapeAdjustments).toBeUndefined();
	});

	it("should clear adjustment handles", () => {
		const shape = makeTestShape("roundRect");
		shape.adjustmentHandles = [{ guideName: "adj", xFraction: 0.25 }];
		replaceWithCustomGeometry(shape, "M 0 0 L 100 100");
		expect(shape.adjustmentHandles).toBeUndefined();
	});

	it("should preserve fill styling", () => {
		const shape = makeTestShape("rect");
		const originalFill = shape.shapeStyle?.fillColor;
		replaceWithCustomGeometry(shape, "M 0 0 L 100 0 L 100 100 Z");
		expect(shape.shapeStyle?.fillColor).toBe(originalFill);
	});

	it("should preserve text content", () => {
		const shape = makeTestShape("rect");
		replaceWithCustomGeometry(shape, "M 0 0 L 100 0 L 100 100 Z");
		expect(shape.text).toBe("Hello");
	});

	it("should preserve position and size", () => {
		const shape = makeTestShape("rect");
		replaceWithCustomGeometry(shape, "M 0 0 L 100 0 L 100 100 Z");
		expect(shape.x).toBe(100);
		expect(shape.y).toBe(200);
		expect(shape.width).toBe(300);
		expect(shape.height).toBe(150);
	});

	it("should set pathWidth and pathHeight when provided", () => {
		const shape = makeTestShape("rect");
		replaceWithCustomGeometry(shape, "M 0 0 L 200 200", 200, 200);
		expect(shape.pathWidth).toBe(200);
		expect(shape.pathHeight).toBe(200);
	});

	it("should leave pathWidth/pathHeight undefined when not provided", () => {
		const shape = makeTestShape("rect");
		replaceWithCustomGeometry(shape, "M 0 0 L 100 100");
		expect(shape.pathWidth).toBeUndefined();
		expect(shape.pathHeight).toBeUndefined();
	});

	it("should throw when svgPath is empty", () => {
		const shape = makeTestShape("rect");
		expect(() => replaceWithCustomGeometry(shape, "")).toThrow(
			"svgPath must be a non-empty string",
		);
	});

	it("should throw when svgPath is whitespace-only", () => {
		const shape = makeTestShape("rect");
		expect(() => replaceWithCustomGeometry(shape, "  ")).toThrow(
			"svgPath must be a non-empty string",
		);
	});

	it("should clear structured customGeometryPaths", () => {
		const shape = makeTestShape("rect");
		shape.customGeometryPaths = [
			{
				width: 100,
				height: 100,
				segments: [{ type: "moveTo", pt: { x: 0, y: 0 } }],
			},
		];
		replaceWithCustomGeometry(shape, "M 0 0 L 100 100");
		expect(shape.customGeometryPaths).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// interpolateShapeGeometry
// ---------------------------------------------------------------------------

describe("interpolateShapeGeometry", () => {
	it("should return `from` when t = 0", () => {
		const from = "M 0 0 L 100 0 L 100 100 Z";
		const to = "M 0 0 L 200 0 L 200 200 Z";
		const result = interpolateShapeGeometry(from, to, 0);
		expect(result).toBe(from);
	});

	it("should return `to` when t = 1", () => {
		const from = "M 0 0 L 100 0 L 100 100 Z";
		const to = "M 0 0 L 200 0 L 200 200 Z";
		const result = interpolateShapeGeometry(from, to, 1);
		expect(result).toBe(to);
	});

	it("should interpolate at t = 0.5 (midpoint)", () => {
		const from = "M 0 0 L 100 0 L 100 100 Z";
		const to = "M 0 0 L 200 0 L 200 200 Z";
		const result = interpolateShapeGeometry(from, to, 0.5);
		const commands = parseSvgPath(result);
		// M 0 0 stays the same
		expect(commands[0].type).toBe("M");
		expect(commands[0].args[0]).toBeCloseTo(0);
		expect(commands[0].args[1]).toBeCloseTo(0);
		// L 150 0
		expect(commands[1].type).toBe("L");
		expect(commands[1].args[0]).toBeCloseTo(150);
		expect(commands[1].args[1]).toBeCloseTo(0);
		// L 150 150
		expect(commands[2].type).toBe("L");
		expect(commands[2].args[0]).toBeCloseTo(150);
		expect(commands[2].args[1]).toBeCloseTo(150);
	});

	it("should interpolate at t = 0.25", () => {
		const from = "M 0 0 L 100 100";
		const to = "M 0 0 L 200 200";
		const result = interpolateShapeGeometry(from, to, 0.25);
		const commands = parseSvgPath(result);
		expect(commands[1].args[0]).toBeCloseTo(125);
		expect(commands[1].args[1]).toBeCloseTo(125);
	});

	it("should handle cubic bezier commands", () => {
		const from = "M 0 0 C 10 20 30 40 50 60";
		const to = "M 0 0 C 20 40 60 80 100 120";
		const result = interpolateShapeGeometry(from, to, 0.5);
		const commands = parseSvgPath(result);
		expect(commands[1].type).toBe("C");
		expect(commands[1].args[0]).toBeCloseTo(15);
		expect(commands[1].args[1]).toBeCloseTo(30);
		expect(commands[1].args[2]).toBeCloseTo(45);
		expect(commands[1].args[3]).toBeCloseTo(60);
		expect(commands[1].args[4]).toBeCloseTo(75);
		expect(commands[1].args[5]).toBeCloseTo(90);
	});

	it("should handle empty from path", () => {
		const result = interpolateShapeGeometry("", "M 0 0 L 100 100", 0.5);
		expect(result).toBe("M 0 0 L 100 100");
	});

	it("should handle empty to path", () => {
		const result = interpolateShapeGeometry("M 0 0 L 100 100", "", 0.5);
		expect(result).toBe("M 0 0 L 100 100");
	});

	it("should handle both paths empty", () => {
		const result = interpolateShapeGeometry("", "", 0.5);
		expect(result).toBe("");
	});

	it("should clamp t below 0", () => {
		const from = "M 0 0 L 100 0";
		const to = "M 0 0 L 200 0";
		const result = interpolateShapeGeometry(from, to, -0.5);
		expect(result).toBe(from);
	});

	it("should clamp t above 1", () => {
		const from = "M 0 0 L 100 0";
		const to = "M 0 0 L 200 0";
		const result = interpolateShapeGeometry(from, to, 1.5);
		expect(result).toBe(to);
	});

	it("should handle paths with different numbers of commands", () => {
		const from = "M 0 0 L 100 0";
		const to = "M 0 0 L 200 0 L 200 200 Z";
		const result = interpolateShapeGeometry(from, to, 0.5);
		const commands = parseSvgPath(result);
		// Should have commands for all positions in the longer path
		expect(commands.length).toBeGreaterThanOrEqual(2);
	});

	it("should handle quadratic bezier commands", () => {
		const from = "M 0 0 Q 50 100 100 0";
		const to = "M 0 0 Q 100 200 200 0";
		const result = interpolateShapeGeometry(from, to, 0.5);
		const commands = parseSvgPath(result);
		expect(commands[1].type).toBe("Q");
		expect(commands[1].args[0]).toBeCloseTo(75);
		expect(commands[1].args[1]).toBeCloseTo(150);
		expect(commands[1].args[2]).toBeCloseTo(150);
		expect(commands[1].args[3]).toBeCloseTo(0);
	});

	it("should preserve Z commands when both paths have them", () => {
		const from = "M 0 0 L 100 0 L 100 100 Z";
		const to = "M 0 0 L 200 0 L 200 200 Z";
		const result = interpolateShapeGeometry(from, to, 0.5);
		expect(result).toContain("Z");
	});
});

// ---------------------------------------------------------------------------
// parseSvgPath and serializeSvgPath
// ---------------------------------------------------------------------------

describe("parseSvgPath", () => {
	it("should parse a simple path with M and L commands", () => {
		const commands = parseSvgPath("M 0 0 L 100 0 L 100 100");
		expect(commands).toHaveLength(3);
		expect(commands[0]).toEqual({ type: "M", args: [0, 0] });
		expect(commands[1]).toEqual({ type: "L", args: [100, 0] });
		expect(commands[2]).toEqual({ type: "L", args: [100, 100] });
	});

	it("should parse Z (close) commands", () => {
		const commands = parseSvgPath("M 0 0 L 100 100 Z");
		expect(commands).toHaveLength(3);
		expect(commands[2]).toEqual({ type: "Z", args: [] });
	});

	it("should parse cubic bezier commands", () => {
		const commands = parseSvgPath("M 0 0 C 10 20 30 40 50 60");
		expect(commands).toHaveLength(2);
		expect(commands[1]).toEqual({ type: "C", args: [10, 20, 30, 40, 50, 60] });
	});

	it("should handle empty string", () => {
		expect(parseSvgPath("")).toEqual([]);
	});

	it("should handle whitespace-only string", () => {
		expect(parseSvgPath("   ")).toEqual([]);
	});

	it("should normalise repeated M coordinates into implicit L commands", () => {
		const commands = parseSvgPath("M 0 0 100 100 200 200");
		expect(commands).toHaveLength(3);
		expect(commands[0]).toEqual({ type: "M", args: [0, 0] });
		expect(commands[1]).toEqual({ type: "L", args: [100, 100] });
		expect(commands[2]).toEqual({ type: "L", args: [200, 200] });
	});

	it("should handle negative numbers", () => {
		const commands = parseSvgPath("M -10 -20 L 50 -30");
		expect(commands[0].args).toEqual([-10, -20]);
		expect(commands[1].args).toEqual([50, -30]);
	});
});

describe("serializeSvgPath", () => {
	it("should round-trip a simple path", () => {
		const original = [
			{ type: "M", args: [0, 0] },
			{ type: "L", args: [100, 0] },
			{ type: "Z", args: [] },
		];
		const result = serializeSvgPath(original);
		expect(result).toBe("M 0 0 L 100 0 Z");
	});

	it("should handle decimal values", () => {
		const commands = [{ type: "M", args: [10.5, 20.75] }];
		const result = serializeSvgPath(commands);
		expect(result).toContain("10.5");
		expect(result).toContain("20.75");
	});

	it("should handle empty array", () => {
		expect(serializeSvgPath([])).toBe("");
	});
});

// ---------------------------------------------------------------------------
// Integration / round-trip tests
// ---------------------------------------------------------------------------

describe("shape-operations integration", () => {
	beforeEach(() => {
		resetIdCounter();
	});

	it("should allow preset → custom → preset round-trip", () => {
		const shape = makeTestShape("rect");
		expect(shape.shapeType).toBe("rect");

		// Replace with custom
		replaceWithCustomGeometry(shape, "M 0 0 L 50 100 L 100 0 Z");
		expect(shape.shapeType).toBeUndefined();
		expect(shape.pathData).toBe("M 0 0 L 50 100 L 100 0 Z");

		// Replace back to preset
		replaceShapeGeometry(shape, "star5");
		expect(shape.shapeType).toBe("star5");
		expect(shape.pathData).toBeUndefined();

		// Fill should survive the round-trip
		expect(shape.shapeStyle?.fillColor).toBe("#FF0000");
	});

	it("should support interpolation of the same path (identity)", () => {
		const path = "M 0 0 L 100 0 L 100 100 Z";
		const result = interpolateShapeGeometry(path, path, 0.5);
		const commands = parseSvgPath(result);
		expect(commands[0].args).toEqual([0, 0]);
		expect(commands[1].args[0]).toBeCloseTo(100);
		expect(commands[1].args[1]).toBeCloseTo(0);
		expect(commands[2].args[0]).toBeCloseTo(100);
		expect(commands[2].args[1]).toBeCloseTo(100);
	});

	it("should produce continuous interpolation across multiple t values", () => {
		const from = "M 0 0 L 0 100";
		const to = "M 0 0 L 100 0";
		const steps = [0, 0.25, 0.5, 0.75, 1];
		const results = steps.map((t) => {
			const cmds = parseSvgPath(interpolateShapeGeometry(from, to, t));
			return cmds[1].args;
		});

		// x should monotonically increase from 0 to 100
		for (let i = 1; i < results.length; i++) {
			expect(results[i][0]).toBeGreaterThanOrEqual(results[i - 1][0]);
		}
		// y should monotonically decrease from 100 to 0
		for (let i = 1; i < results.length; i++) {
			expect(results[i][1]).toBeLessThanOrEqual(results[i - 1][1]);
		}
	});
});
