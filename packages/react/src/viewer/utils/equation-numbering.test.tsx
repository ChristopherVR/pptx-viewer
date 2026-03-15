import { describe, it, expect } from "vitest";
import { renderEquationSegment } from "./text-segment-helpers";

describe("renderEquationSegment — equation numbering", () => {
  const elementId = "eq-el-1";
  const segmentIndex = 0;

  // A minimal valid OMML node that produces MathML output
  const validOmml: Record<string, unknown> = {
    "m:oMath": {
      "m:r": {
        "m:t": "x",
      },
    },
  };

  // An OMML node that will not produce MathML (empty/invalid)
  const invalidOmml: Record<string, unknown> = {};

  it("should render equation without number when equationNumber is undefined", () => {
    const result = renderEquationSegment(
      elementId,
      segmentIndex,
      validOmml,
    ) as React.ReactElement;

    expect(result).toBeTruthy();
    expect(result.type).toBe("span");
    // Should not have a flex layout
    expect(result.props.style?.display).not.toBe("flex");
  });

  it("should render equation with number in a flex container", () => {
    const result = renderEquationSegment(
      elementId,
      segmentIndex,
      validOmml,
      "1",
    ) as React.ReactElement;

    expect(result).toBeTruthy();
    expect(result.type).toBe("span");
    expect(result.props.style.display).toBe("flex");
    expect(result.props.style.justifyContent).toBe("space-between");
    expect(result.props.style.alignItems).toBe("center");
    expect(result.props.style.width).toBe("100%");
  });

  it("should render the equation number text with parentheses", () => {
    const result = renderEquationSegment(
      elementId,
      segmentIndex,
      validOmml,
      "42",
    ) as React.ReactElement;

    // The flex container should have 3 children: hidden spacer, equation, number
    const children = result.props.children;
    expect(children).toHaveLength(3);

    // The right-aligned number (third child) — React renders JSX
    // `({equationNumber})` as an array: ["(", "42", ")"]
    const numberSpan = children[2] as React.ReactElement;
    const numberChildren = numberSpan.props.children;
    expect(numberChildren).toEqual(["(", "42", ")"]);
    expect(numberSpan.props.style.whiteSpace).toBe("nowrap");
  });

  it("should include a hidden left spacer for centering balance", () => {
    const result = renderEquationSegment(
      elementId,
      segmentIndex,
      validOmml,
      "3",
    ) as React.ReactElement;

    const children = result.props.children;
    // The left spacer (first child) should be visually hidden
    const spacer = children[0] as React.ReactElement;
    expect(spacer.props.style.visibility).toBe("hidden");
    expect(spacer.props.children).toEqual(["(", "3", ")"]);
  });

  it("should center the equation content (second child has flex: 1)", () => {
    const result = renderEquationSegment(
      elementId,
      segmentIndex,
      validOmml,
      "1",
    ) as React.ReactElement;

    const children = result.props.children;
    const equationWrapper = children[1] as React.ReactElement;
    expect(equationWrapper.props.style.textAlign).toBe("center");
    expect(equationWrapper.props.style.flex).toBe(1);
  });

  it("should handle equation number with decimal notation", () => {
    const result = renderEquationSegment(
      elementId,
      segmentIndex,
      validOmml,
      "2.3",
    ) as React.ReactElement;

    const children = result.props.children;
    const numberSpan = children[2] as React.ReactElement;
    expect(numberSpan.props.children).toEqual(["(", "2.3", ")"]);
  });

  it("should render fallback equation placeholder with number", () => {
    const result = renderEquationSegment(
      elementId,
      segmentIndex,
      invalidOmml,
      "5",
    ) as React.ReactElement;

    expect(result.props.style.display).toBe("flex");
    const children = result.props.children;
    const numberSpan = children[2] as React.ReactElement;
    expect(numberSpan.props.children).toEqual(["(", "5", ")"]);
  });

  it("should render fallback placeholder without number when not provided", () => {
    const result = renderEquationSegment(
      elementId,
      segmentIndex,
      invalidOmml,
    ) as React.ReactElement;

    expect(result).toBeTruthy();
    // Should not have flex layout
    expect(result.props.style?.display).not.toBe("flex");
  });

  it("should apply math font to the equation number", () => {
    const result = renderEquationSegment(
      elementId,
      segmentIndex,
      validOmml,
      "1",
    ) as React.ReactElement;

    const children = result.props.children;
    const numberSpan = children[2] as React.ReactElement;
    expect(numberSpan.props.style.fontFamily).toContain("Cambria Math");
  });
});
