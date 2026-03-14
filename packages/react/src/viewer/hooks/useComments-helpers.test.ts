import { describe, it, expect } from "vitest";
import {
  generateCommentId,
  addCommentToSlide,
  removeCommentFromSlide,
  editCommentInSlide,
  toggleResolvedInSlide,
  pruneSlideDrafts,
} from "./useComments-helpers";
import type { PptxSlide, PptxComment } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSlide(
  id: string,
  comments: PptxComment[] = [],
): PptxSlide {
  return {
    id,
    rId: `rId-${id}`,
    slideNumber: 1,
    elements: [],
    comments,
  } as PptxSlide;
}

function makeComment(
  id: string,
  text: string,
  resolved = false,
): PptxComment {
  return { id, text, author: "Test User", resolved } as PptxComment;
}

// ---------------------------------------------------------------------------
// generateCommentId
// ---------------------------------------------------------------------------

describe("generateCommentId", () => {
  it("returns a string starting with 'comment-'", () => {
    const id = generateCommentId();
    expect(id).toMatch(/^comment-/);
  });

  it("generates unique ids on successive calls", () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateCommentId()));
    expect(ids.size).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// addCommentToSlide
// ---------------------------------------------------------------------------

describe("addCommentToSlide", () => {
  it("appends a comment to the target slide", () => {
    const slides = [makeSlide("s1"), makeSlide("s2")];
    const comment = makeComment("c1", "hello");
    const result = addCommentToSlide(slides, 0, comment);
    expect(result[0].comments).toHaveLength(1);
    expect(result[0].comments![0].text).toBe("hello");
  });

  it("does not mutate the original slides array", () => {
    const slides = [makeSlide("s1")];
    const comment = makeComment("c1", "hello");
    const result = addCommentToSlide(slides, 0, comment);
    expect(slides[0].comments).toHaveLength(0);
    expect(result).not.toBe(slides);
  });

  it("preserves existing comments on the target slide", () => {
    const existing = makeComment("c0", "existing");
    const slides = [makeSlide("s1", [existing])];
    const comment = makeComment("c1", "new");
    const result = addCommentToSlide(slides, 0, comment);
    expect(result[0].comments).toHaveLength(2);
    expect(result[0].comments![0].text).toBe("existing");
    expect(result[0].comments![1].text).toBe("new");
  });

  it("does not modify other slides", () => {
    const slides = [makeSlide("s1"), makeSlide("s2")];
    const comment = makeComment("c1", "hello");
    const result = addCommentToSlide(slides, 0, comment);
    expect(result[1]).toBe(slides[1]);
  });

  it("handles slides with undefined comments array", () => {
    const slide = { id: "s1", rId: "r1", slideNumber: 1, elements: [] } as PptxSlide;
    const result = addCommentToSlide([slide], 0, makeComment("c1", "text"));
    expect(result[0].comments).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// removeCommentFromSlide
// ---------------------------------------------------------------------------

describe("removeCommentFromSlide", () => {
  it("removes the specified comment and returns didDelete=true", () => {
    const slides = [makeSlide("s1", [makeComment("c1", "text")])];
    const { slides: result, didDelete } = removeCommentFromSlide(slides, 0, "c1");
    expect(didDelete).toBe(true);
    expect(result[0].comments).toHaveLength(0);
  });

  it("returns didDelete=false when the comment does not exist", () => {
    const slides = [makeSlide("s1", [makeComment("c1", "text")])];
    const { slides: result, didDelete } = removeCommentFromSlide(slides, 0, "c-missing");
    expect(didDelete).toBe(false);
    expect(result[0].comments).toHaveLength(1);
  });

  it("does not mutate the original slides array", () => {
    const slides = [makeSlide("s1", [makeComment("c1", "text")])];
    const { slides: result } = removeCommentFromSlide(slides, 0, "c1");
    expect(slides[0].comments).toHaveLength(1);
    expect(result).not.toBe(slides);
  });

  it("preserves other comments on the same slide", () => {
    const slides = [
      makeSlide("s1", [makeComment("c1", "one"), makeComment("c2", "two")]),
    ];
    const { slides: result } = removeCommentFromSlide(slides, 0, "c1");
    expect(result[0].comments).toHaveLength(1);
    expect(result[0].comments![0].id).toBe("c2");
  });

  it("does not modify other slides", () => {
    const slides = [
      makeSlide("s1", [makeComment("c1", "text")]),
      makeSlide("s2", [makeComment("c2", "other")]),
    ];
    const { slides: result } = removeCommentFromSlide(slides, 0, "c1");
    expect(result[1]).toBe(slides[1]);
  });

  it("returns same slide reference when comment not found (no mutation needed)", () => {
    const slides = [makeSlide("s1", [makeComment("c1", "text")])];
    const { slides: result } = removeCommentFromSlide(slides, 0, "nonexistent");
    expect(result[0]).toBe(slides[0]);
  });
});

// ---------------------------------------------------------------------------
// editCommentInSlide
// ---------------------------------------------------------------------------

describe("editCommentInSlide", () => {
  it("updates the comment text and returns didUpdate=true", () => {
    const slides = [makeSlide("s1", [makeComment("c1", "old")])];
    const { slides: result, didUpdate } = editCommentInSlide(slides, 0, "c1", "new");
    expect(didUpdate).toBe(true);
    expect(result[0].comments![0].text).toBe("new");
  });

  it("returns didUpdate=false when comment not found", () => {
    const slides = [makeSlide("s1", [makeComment("c1", "old")])];
    const { didUpdate } = editCommentInSlide(slides, 0, "c-missing", "new");
    expect(didUpdate).toBe(false);
  });

  it("does not mutate the original slides array", () => {
    const slides = [makeSlide("s1", [makeComment("c1", "old")])];
    editCommentInSlide(slides, 0, "c1", "new");
    expect(slides[0].comments![0].text).toBe("old");
  });

  it("preserves other comment properties", () => {
    const comment: PptxComment = {
      id: "c1",
      text: "old",
      author: "Alice",
      resolved: true,
    } as PptxComment;
    const slides = [makeSlide("s1", [comment])];
    const { slides: result } = editCommentInSlide(slides, 0, "c1", "new");
    expect(result[0].comments![0].author).toBe("Alice");
    expect(result[0].comments![0].resolved).toBe(true);
  });

  it("does not modify other slides", () => {
    const slides = [
      makeSlide("s1", [makeComment("c1", "a")]),
      makeSlide("s2", [makeComment("c2", "b")]),
    ];
    const { slides: result } = editCommentInSlide(slides, 0, "c1", "updated");
    expect(result[1]).toBe(slides[1]);
  });

  it("returns same slide when didUpdate is false", () => {
    const slides = [makeSlide("s1", [makeComment("c1", "text")])];
    const { slides: result } = editCommentInSlide(slides, 0, "nonexistent", "new");
    expect(result[0]).toBe(slides[0]);
  });
});

// ---------------------------------------------------------------------------
// toggleResolvedInSlide
// ---------------------------------------------------------------------------

describe("toggleResolvedInSlide", () => {
  it("toggles resolved from false to true", () => {
    const slides = [makeSlide("s1", [makeComment("c1", "text", false)])];
    const { slides: result, didUpdate } = toggleResolvedInSlide(slides, 0, "c1");
    expect(didUpdate).toBe(true);
    expect(result[0].comments![0].resolved).toBe(true);
  });

  it("toggles resolved from true to false", () => {
    const slides = [makeSlide("s1", [makeComment("c1", "text", true)])];
    const { slides: result } = toggleResolvedInSlide(slides, 0, "c1");
    expect(result[0].comments![0].resolved).toBe(false);
  });

  it("returns didUpdate=false when comment not found", () => {
    const slides = [makeSlide("s1", [makeComment("c1", "text")])];
    const { didUpdate } = toggleResolvedInSlide(slides, 0, "c-missing");
    expect(didUpdate).toBe(false);
  });

  it("does not mutate the original slides", () => {
    const slides = [makeSlide("s1", [makeComment("c1", "text", false)])];
    toggleResolvedInSlide(slides, 0, "c1");
    expect(slides[0].comments![0].resolved).toBe(false);
  });

  it("toggles resolved from undefined to true", () => {
    const comment = { id: "c1", text: "text" } as PptxComment;
    const slides = [makeSlide("s1", [comment])];
    const { slides: result } = toggleResolvedInSlide(slides, 0, "c1");
    expect(result[0].comments![0].resolved).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// pruneSlideDrafts
// ---------------------------------------------------------------------------

describe("pruneSlideDrafts", () => {
  it("removes drafts for slide IDs that no longer exist", () => {
    const drafts = { s1: "draft1", s2: "draft2", s3: "draft3" };
    const slideIds = new Set(["s1", "s3"]);
    const result = pruneSlideDrafts(drafts, slideIds);
    expect(result).toEqual({ s1: "draft1", s3: "draft3" });
  });

  it("returns null when no change is needed", () => {
    const drafts = { s1: "draft1", s2: "draft2" };
    const slideIds = new Set(["s1", "s2"]);
    const result = pruneSlideDrafts(drafts, slideIds);
    expect(result).toBeNull();
  });

  it("returns empty object when all drafts are pruned", () => {
    const drafts = { s1: "draft1", s2: "draft2" };
    const slideIds = new Set<string>();
    const result = pruneSlideDrafts(drafts, slideIds);
    expect(result).toEqual({});
  });

  it("handles empty drafts object", () => {
    const drafts: Record<string, string> = {};
    const slideIds = new Set(["s1"]);
    const result = pruneSlideDrafts(drafts, slideIds);
    expect(result).toBeNull();
  });

  it("handles single draft that needs pruning", () => {
    const drafts = { s1: "draft1" };
    const slideIds = new Set(["s2"]);
    const result = pruneSlideDrafts(drafts, slideIds);
    expect(result).toEqual({});
  });
});
