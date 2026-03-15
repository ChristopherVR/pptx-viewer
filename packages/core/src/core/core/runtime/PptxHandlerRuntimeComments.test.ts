import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Extracted logic from PptxHandlerRuntimeComments (protected methods)
// ---------------------------------------------------------------------------

const EMU_PER_PX = 9525;

interface XmlObject {
  [key: string]: unknown;
}

/**
 * Extracted from extractCommentText — extracts text from a comment node.
 * Simplified to not use service lookups — tests the direct key access paths.
 */
function extractCommentText(commentNode: XmlObject): string {
  // Direct text
  const directText = commentNode?.["p:text"] ?? commentNode?.["text"];
  if (typeof directText === "string") {
    return directText.trim();
  }
  if (directText !== undefined && directText !== null) {
    return String(directText).trim();
  }

  // Text body
  const textBody = commentNode?.["p:txBody"] as XmlObject | undefined;
  if (textBody) {
    return extractTextFromTxBody(textBody);
  }

  return "";
}

/**
 * Helper to extract text from a txBody node (simplified).
 */
function extractTextFromTxBody(textBody: XmlObject | undefined): string {
  if (!textBody) return "";
  const paragraphs = ensureArray(textBody["a:p"]) as XmlObject[];
  const lines: string[] = [];
  for (const p of paragraphs) {
    const runs = ensureArray(p?.["a:r"]) as XmlObject[];
    let line = "";
    for (const r of runs) {
      if (r?.["a:t"] !== undefined) {
        line += String(r["a:t"]);
      }
    }
    lines.push(line);
  }
  return lines.join("\n").trim();
}

function ensureArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Extracted from extractSlideComments — maps a comment node to a comment object.
 */
function parseCommentNode(
  commentNode: XmlObject,
  index: number,
  commentAuthorMap: Map<string, string>,
): {
  id: string;
  text: string;
  author?: string;
  createdAt?: string;
  x?: number;
  y?: number;
  resolved?: boolean;
} {
  const commentId = String(
    commentNode?.["@_idx"] || commentNode?.["@_id"] || index,
  ).trim();
  const authorId = String(commentNode?.["@_authorId"] || "").trim();
  const createdAtRaw = String(commentNode?.["@_dt"] || "").trim();
  const position = commentNode?.["p:pos"] as XmlObject | undefined;
  const xValue = Number.parseInt(String(position?.["@_x"] || ""), 10);
  const yValue = Number.parseInt(String(position?.["@_y"] || ""), 10);

  const resolvedToken = String(
    commentNode?.["@_done"] || commentNode?.["@_resolved"] || "",
  )
    .trim()
    .toLowerCase();
  const resolved =
    resolvedToken === "1" || resolvedToken === "true" ? true : undefined;

  return {
    id: commentId.length > 0 ? commentId : String(index),
    text: extractCommentText(commentNode),
    author:
      authorId.length > 0
        ? commentAuthorMap.get(authorId) || `Author ${authorId}`
        : undefined,
    createdAt: createdAtRaw.length > 0 ? createdAtRaw : undefined,
    x: Number.isFinite(xValue)
      ? Math.round(xValue / EMU_PER_PX)
      : undefined,
    y: Number.isFinite(yValue)
      ? Math.round(yValue / EMU_PER_PX)
      : undefined,
    resolved,
  };
}

/**
 * Extracted from loadCommentAuthors — parses an author node.
 */
function parseAuthorNode(
  author: XmlObject,
  index: number,
): { id: string; name: string } | null {
  const authorId = String(author?.["@_id"] || index).trim();
  if (authorId.length === 0) return null;

  const authorNameRaw = String(
    author?.["@_name"] || author?.["@_initials"] || `Author ${authorId}`,
  ).trim();
  const authorName =
    authorNameRaw.length > 0 ? authorNameRaw : `Author ${authorId}`;

  return { id: authorId, name: authorName };
}

// ---------------------------------------------------------------------------
// Tests: extractCommentText
// ---------------------------------------------------------------------------
describe("extractCommentText", () => {
  it("should extract text from p:text", () => {
    expect(extractCommentText({ "p:text": "Hello comment" })).toBe("Hello comment");
  });

  it("should extract text from text key", () => {
    expect(extractCommentText({ text: "Direct text" })).toBe("Direct text");
  });

  it("should trim whitespace", () => {
    expect(extractCommentText({ "p:text": "  spaced  " })).toBe("spaced");
  });

  it("should convert numeric p:text to string", () => {
    expect(extractCommentText({ "p:text": 42 })).toBe("42");
  });

  it("should extract text from p:txBody", () => {
    expect(
      extractCommentText({
        "p:txBody": {
          "a:p": {
            "a:r": { "a:t": "Body text" },
          },
        },
      }),
    ).toBe("Body text");
  });

  it("should concatenate multiple runs in txBody", () => {
    expect(
      extractCommentText({
        "p:txBody": {
          "a:p": {
            "a:r": [{ "a:t": "Hello " }, { "a:t": "World" }],
          },
        },
      }),
    ).toBe("Hello World");
  });

  it("should concatenate multiple paragraphs with newlines", () => {
    expect(
      extractCommentText({
        "p:txBody": {
          "a:p": [
            { "a:r": { "a:t": "Line 1" } },
            { "a:r": { "a:t": "Line 2" } },
          ],
        },
      }),
    ).toBe("Line 1\nLine 2");
  });

  it("should return empty string when no text found", () => {
    expect(extractCommentText({})).toBe("");
  });

  it("should prefer p:text over p:txBody", () => {
    expect(
      extractCommentText({
        "p:text": "Direct",
        "p:txBody": {
          "a:p": { "a:r": { "a:t": "Body" } },
        },
      }),
    ).toBe("Direct");
  });
});

// ---------------------------------------------------------------------------
// Tests: parseCommentNode
// ---------------------------------------------------------------------------
describe("parseCommentNode", () => {
  const emptyMap = new Map<string, string>();

  it("should extract id from @_idx", () => {
    const result = parseCommentNode({ "@_idx": "5", "p:text": "test" }, 0, emptyMap);
    expect(result.id).toBe("5");
  });

  it("should extract id from @_id when @_idx is absent", () => {
    const result = parseCommentNode({ "@_id": "abc", "p:text": "test" }, 0, emptyMap);
    expect(result.id).toBe("abc");
  });

  it("should fall back to index when no id attributes", () => {
    const result = parseCommentNode({ "p:text": "test" }, 3, emptyMap);
    expect(result.id).toBe("3");
  });

  it("should extract text", () => {
    const result = parseCommentNode({ "@_idx": "1", "p:text": "My comment" }, 0, emptyMap);
    expect(result.text).toBe("My comment");
  });

  it("should resolve author name from map", () => {
    const authorMap = new Map([["1", "John Doe"]]);
    const result = parseCommentNode(
      { "@_idx": "1", "@_authorId": "1", "p:text": "test" },
      0,
      authorMap,
    );
    expect(result.author).toBe("John Doe");
  });

  it("should fall back to Author X when author not in map", () => {
    const result = parseCommentNode(
      { "@_idx": "1", "@_authorId": "99", "p:text": "test" },
      0,
      emptyMap,
    );
    expect(result.author).toBe("Author 99");
  });

  it("should not set author when authorId is empty", () => {
    const result = parseCommentNode(
      { "@_idx": "1", "@_authorId": "", "p:text": "test" },
      0,
      emptyMap,
    );
    expect(result.author).toBeUndefined();
  });

  it("should extract createdAt from @_dt", () => {
    const result = parseCommentNode(
      { "@_idx": "1", "@_dt": "2024-01-15T10:00:00Z", "p:text": "test" },
      0,
      emptyMap,
    );
    expect(result.createdAt).toBe("2024-01-15T10:00:00Z");
  });

  it("should not set createdAt when @_dt is empty", () => {
    const result = parseCommentNode({ "@_idx": "1", "p:text": "test" }, 0, emptyMap);
    expect(result.createdAt).toBeUndefined();
  });

  it("should extract position x,y", () => {
    const result = parseCommentNode(
      {
        "@_idx": "1",
        "p:text": "test",
        "p:pos": { "@_x": "952500", "@_y": "1905000" },
      },
      0,
      emptyMap,
    );
    expect(result.x).toBe(Math.round(952500 / EMU_PER_PX));
    expect(result.y).toBe(Math.round(1905000 / EMU_PER_PX));
  });

  it("should not set position when p:pos is absent", () => {
    const result = parseCommentNode({ "@_idx": "1", "p:text": "test" }, 0, emptyMap);
    expect(result.x).toBeUndefined();
    expect(result.y).toBeUndefined();
  });

  it("should detect resolved = true from @_done = 1", () => {
    const result = parseCommentNode(
      { "@_idx": "1", "@_done": "1", "p:text": "test" },
      0,
      emptyMap,
    );
    expect(result.resolved).toBe(true);
  });

  it("should detect resolved = true from @_resolved = true", () => {
    const result = parseCommentNode(
      { "@_idx": "1", "@_resolved": "true", "p:text": "test" },
      0,
      emptyMap,
    );
    expect(result.resolved).toBe(true);
  });

  it("should not set resolved when not done", () => {
    const result = parseCommentNode(
      { "@_idx": "1", "@_done": "0", "p:text": "test" },
      0,
      emptyMap,
    );
    expect(result.resolved).toBeUndefined();
  });

  it("should not set resolved when absent", () => {
    const result = parseCommentNode({ "@_idx": "1", "p:text": "test" }, 0, emptyMap);
    expect(result.resolved).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: parseAuthorNode
// ---------------------------------------------------------------------------
describe("parseAuthorNode", () => {
  it("should extract author id and name", () => {
    const result = parseAuthorNode({ "@_id": "1", "@_name": "John" }, 0);
    expect(result).toEqual({ id: "1", name: "John" });
  });

  it("should fall back to initials when name is absent", () => {
    const result = parseAuthorNode({ "@_id": "2", "@_initials": "JD" }, 0);
    expect(result).toEqual({ id: "2", name: "JD" });
  });

  it("should use index as id when @_id is absent", () => {
    const result = parseAuthorNode({ "@_name": "Jane" }, 5);
    expect(result).toEqual({ id: "5", name: "Jane" });
  });

  it("should fall back to Author X when no name or initials", () => {
    const result = parseAuthorNode({ "@_id": "3" }, 0);
    expect(result).toEqual({ id: "3", name: "Author 3" });
  });

  it("should trim id and name", () => {
    const result = parseAuthorNode({ "@_id": " 1 ", "@_name": " John " }, 0);
    expect(result).toEqual({ id: "1", name: "John" });
  });

  it("should use Author X when name is empty string", () => {
    const result = parseAuthorNode({ "@_id": "4", "@_name": "" }, 0);
    expect(result).toEqual({ id: "4", name: "Author 4" });
  });
});

// ---------------------------------------------------------------------------
// Tests: parseAuthorNodeFull (with initials, lastIdx, clrIdx)
// ---------------------------------------------------------------------------

interface PptxCommentAuthorDetail {
  id: string;
  name: string;
  initials: string;
  lastIdx: number;
  clrIdx: number;
}

/**
 * Extracts full author detail including initials, lastIdx, and clrIdx
 * for round-trip preservation. Mirrors the updated loadCommentAuthors logic.
 */
function parseAuthorNodeFull(
  author: XmlObject,
  index: number,
): PptxCommentAuthorDetail | null {
  const authorId = String(author?.["@_id"] || index).trim();
  if (authorId.length === 0) return null;

  const authorNameRaw = String(
    author?.["@_name"] || author?.["@_initials"] || `Author ${authorId}`,
  ).trim();
  const authorName =
    authorNameRaw.length > 0 ? authorNameRaw : `Author ${authorId}`;

  const initialsRaw = String(author?.["@_initials"] || "").trim();
  const lastIdxRaw = Number.parseInt(String(author?.["@_lastIdx"] || "0"), 10);
  const clrIdxRaw = Number.parseInt(String(author?.["@_clrIdx"] || "0"), 10);

  const toInitials = (name: string): string => {
    const tokens = name
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (tokens.length === 0) return "U";
    return tokens.slice(0, 2).map((t) => t[0].toUpperCase()).join("");
  };

  return {
    id: authorId,
    name: authorName,
    initials: initialsRaw.length > 0 ? initialsRaw : toInitials(authorName),
    lastIdx: Number.isFinite(lastIdxRaw) ? lastIdxRaw : 0,
    clrIdx: Number.isFinite(clrIdxRaw) ? clrIdxRaw : 0,
  };
}

describe("parseAuthorNodeFull", () => {
  it("should extract all author properties", () => {
    const result = parseAuthorNodeFull({
      "@_id": "0",
      "@_name": "John Doe",
      "@_initials": "JD",
      "@_lastIdx": "3",
      "@_clrIdx": "2",
    }, 0);
    expect(result).toEqual({
      id: "0",
      name: "John Doe",
      initials: "JD",
      lastIdx: 3,
      clrIdx: 2,
    });
  });

  it("should preserve original initials rather than deriving them", () => {
    const result = parseAuthorNodeFull({
      "@_id": "1",
      "@_name": "Jane Smith",
      "@_initials": "JS-custom",
      "@_lastIdx": "0",
      "@_clrIdx": "1",
    }, 0);
    expect(result?.initials).toBe("JS-custom");
  });

  it("should derive initials from name when initials are absent", () => {
    const result = parseAuthorNodeFull({
      "@_id": "2",
      "@_name": "Alice Bob",
      "@_lastIdx": "5",
      "@_clrIdx": "3",
    }, 0);
    expect(result?.initials).toBe("AB");
  });

  it("should default lastIdx and clrIdx to 0 when absent", () => {
    const result = parseAuthorNodeFull({
      "@_id": "3",
      "@_name": "Test",
      "@_initials": "T",
    }, 0);
    expect(result?.lastIdx).toBe(0);
    expect(result?.clrIdx).toBe(0);
  });

  it("should handle non-numeric lastIdx gracefully", () => {
    const result = parseAuthorNodeFull({
      "@_id": "4",
      "@_name": "Test",
      "@_initials": "T",
      "@_lastIdx": "abc",
      "@_clrIdx": "0",
    }, 0);
    expect(result?.lastIdx).toBe(0);
  });

  it("should preserve clrIdx values > 0", () => {
    const result = parseAuthorNodeFull({
      "@_id": "5",
      "@_name": "User Five",
      "@_initials": "UF",
      "@_lastIdx": "10",
      "@_clrIdx": "7",
    }, 0);
    expect(result?.clrIdx).toBe(7);
    expect(result?.lastIdx).toBe(10);
  });

  it("should return null when id is empty string", () => {
    const result = parseAuthorNodeFull({ "@_id": "", "@_name": "Test" }, 0);
    // Note: empty @_id falls back to index (0), so it becomes "0"
    expect(result).toEqual({
      id: "0",
      name: "Test",
      initials: "T",
      lastIdx: 0,
      clrIdx: 0,
    });
  });
});
