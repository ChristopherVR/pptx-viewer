/**
 * Tests for the real-time collaboration infrastructure.
 *
 * These tests verify:
 * 1. Yjs document sync between two Y.Doc instances (in-memory)
 * 2. Presence tracking (broadcast/receive)
 * 3. Conflict resolution (concurrent edits to same element)
 * 4. Slide ordering sync
 * 5. Undo/redo isolation per user
 *
 * All tests use in-memory Yjs documents connected via `applyUpdate`
 * (no WebSocket needed).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// These tests directly use the yjs library to verify CRDT behaviour
// that underpins the collaboration hooks.
import * as Y from "yjs";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Creates two Y.Doc instances wired together so that updates from one
 * are automatically applied to the other (simulating a WebSocket relay).
 */
function createSyncedPair() {
  const doc1 = new Y.Doc();
  const doc2 = new Y.Doc();

  doc1.on("update", (update: Uint8Array) => {
    Y.applyUpdate(doc2, update);
  });
  doc2.on("update", (update: Uint8Array) => {
    Y.applyUpdate(doc1, update);
  });

  return { doc1, doc2 };
}

/**
 * Helper to set up the standard shared types on a Y.Doc matching
 * the structure used by the collaboration provider.
 */
function initDocStructure(doc: Y.Doc) {
  return {
    slidesOrder: doc.getArray<string>("slidesOrder"),
    slides: doc.getMap("slides"),
    elements: doc.getMap("elements"),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Collaboration — Yjs CRDT sync", () => {
  let doc1: Y.Doc;
  let doc2: Y.Doc;

  beforeEach(() => {
    const pair = createSyncedPair();
    doc1 = pair.doc1;
    doc2 = pair.doc2;
  });

  // ---- Basic document sync ------------------------------------------------

  describe("Document synchronisation", () => {
    it("should sync a Y.Map value from doc1 to doc2", () => {
      const map1 = doc1.getMap("slides");
      const map2 = doc2.getMap("slides");

      const slideMap = new Y.Map();
      slideMap.set("id", "slide-1");
      slideMap.set("slideNumber", 1);
      slideMap.set("backgroundColor", "#FFFFFF");
      map1.set("slide-1", slideMap);

      // doc2 should have the slide
      const synced = map2.get("slide-1") as Y.Map<unknown>;
      expect(synced).toBeDefined();
      expect(synced.get("id")).toBe("slide-1");
      expect(synced.get("slideNumber")).toBe(1);
      expect(synced.get("backgroundColor")).toBe("#FFFFFF");
    });

    it("should sync Y.Array order from doc1 to doc2", () => {
      const arr1 = doc1.getArray<string>("slidesOrder");
      const arr2 = doc2.getArray<string>("slidesOrder");

      arr1.push(["slide-1", "slide-2", "slide-3"]);

      expect(arr2.toArray()).toEqual(["slide-1", "slide-2", "slide-3"]);
    });

    it("should sync element data from doc2 to doc1", () => {
      const elements2 = doc2.getMap("elements");
      const elements1 = doc1.getMap("elements");

      const elMap = new Y.Map();
      elMap.set("id", "el-1");
      elMap.set("type", "text");
      elMap.set("x", 100);
      elMap.set("y", 200);
      elMap.set("width", 400);
      elMap.set("height", 50);
      elMap.set("text", "Hello from doc2");
      elements2.set("el-1", elMap);

      const synced = elements1.get("el-1") as Y.Map<unknown>;
      expect(synced).toBeDefined();
      expect(synced.get("text")).toBe("Hello from doc2");
      expect(synced.get("x")).toBe(100);
    });

    it("should sync deletions from one doc to the other", () => {
      const map1 = doc1.getMap("elements");
      const map2 = doc2.getMap("elements");

      const elMap = new Y.Map();
      elMap.set("id", "el-to-delete");
      map1.set("el-to-delete", elMap);

      expect(map2.has("el-to-delete")).toBe(true);

      map1.delete("el-to-delete");

      expect(map2.has("el-to-delete")).toBe(false);
    });
  });

  // ---- Conflict resolution ------------------------------------------------

  describe("Conflict resolution (concurrent edits)", () => {
    it("should converge when both docs edit different fields of the same element", () => {
      // Set up initial element in both docs
      const elements1 = doc1.getMap("elements");
      const elMap = new Y.Map();
      elMap.set("id", "el-conflict");
      elMap.set("x", 0);
      elMap.set("y", 0);
      elMap.set("text", "original");
      elements1.set("el-conflict", elMap);

      // Both docs now have the element
      const elements2 = doc2.getMap("elements");
      const el1 = elements1.get("el-conflict") as Y.Map<unknown>;
      const el2 = elements2.get("el-conflict") as Y.Map<unknown>;

      // Disconnect sync temporarily to simulate concurrent edits
      const tempDoc1 = new Y.Doc();
      const tempDoc2 = new Y.Doc();
      Y.applyUpdate(tempDoc1, Y.encodeStateAsUpdate(doc1));
      Y.applyUpdate(tempDoc2, Y.encodeStateAsUpdate(doc2));

      const tempEl1 = tempDoc1.getMap("elements").get("el-conflict") as Y.Map<unknown>;
      const tempEl2 = tempDoc2.getMap("elements").get("el-conflict") as Y.Map<unknown>;

      // Concurrent edits to DIFFERENT fields
      tempEl1.set("x", 100); // user 1 moves x
      tempEl2.set("y", 200); // user 2 moves y

      // Merge updates
      Y.applyUpdate(tempDoc1, Y.encodeStateAsUpdate(tempDoc2));
      Y.applyUpdate(tempDoc2, Y.encodeStateAsUpdate(tempDoc1));

      // Both should converge
      const final1 = tempDoc1.getMap("elements").get("el-conflict") as Y.Map<unknown>;
      const final2 = tempDoc2.getMap("elements").get("el-conflict") as Y.Map<unknown>;

      expect(final1.get("x")).toBe(100);
      expect(final1.get("y")).toBe(200);
      expect(final2.get("x")).toBe(100);
      expect(final2.get("y")).toBe(200);
    });

    it("should converge when both docs edit the same field (last-writer-wins)", () => {
      const elements1 = doc1.getMap("elements");
      const elMap = new Y.Map();
      elMap.set("id", "el-lww");
      elMap.set("text", "original");
      elements1.set("el-lww", elMap);

      // Create isolated docs
      const tempDoc1 = new Y.Doc();
      const tempDoc2 = new Y.Doc();
      Y.applyUpdate(tempDoc1, Y.encodeStateAsUpdate(doc1));
      Y.applyUpdate(tempDoc2, Y.encodeStateAsUpdate(doc2));

      const tempEl1 = tempDoc1.getMap("elements").get("el-lww") as Y.Map<unknown>;
      const tempEl2 = tempDoc2.getMap("elements").get("el-lww") as Y.Map<unknown>;

      // Both edit the same field
      tempEl1.set("text", "version-A");
      tempEl2.set("text", "version-B");

      // Merge
      Y.applyUpdate(tempDoc1, Y.encodeStateAsUpdate(tempDoc2));
      Y.applyUpdate(tempDoc2, Y.encodeStateAsUpdate(tempDoc1));

      // Both must converge to the same value (CRDT deterministic)
      const val1 = (tempDoc1.getMap("elements").get("el-lww") as Y.Map<unknown>).get("text");
      const val2 = (tempDoc2.getMap("elements").get("el-lww") as Y.Map<unknown>).get("text");

      expect(val1).toBe(val2); // Same value, regardless of which "wins"
    });

    it("should handle concurrent slide insertion", () => {
      const tempDoc1 = new Y.Doc();
      const tempDoc2 = new Y.Doc();

      const arr1 = tempDoc1.getArray<string>("slidesOrder");
      const arr2 = tempDoc2.getArray<string>("slidesOrder");

      // Both start with same slide
      arr1.push(["slide-1"]);
      Y.applyUpdate(tempDoc2, Y.encodeStateAsUpdate(tempDoc1));

      // Concurrent inserts
      arr1.push(["slide-A"]);
      arr2.push(["slide-B"]);

      // Merge
      Y.applyUpdate(tempDoc1, Y.encodeStateAsUpdate(tempDoc2));
      Y.applyUpdate(tempDoc2, Y.encodeStateAsUpdate(tempDoc1));

      // Both docs should have all 3 slides in the same order
      const order1 = arr1.toArray();
      const order2 = arr2.toArray();

      expect(order1).toEqual(order2);
      expect(order1).toContain("slide-1");
      expect(order1).toContain("slide-A");
      expect(order1).toContain("slide-B");
      expect(order1.length).toBe(3);
    });
  });

  // ---- Slide operations ---------------------------------------------------

  describe("Slide operations", () => {
    it("should sync slide reordering", () => {
      const { slidesOrder: arr1 } = initDocStructure(doc1);
      const arr2 = doc2.getArray<string>("slidesOrder");

      arr1.push(["s1", "s2", "s3"]);

      // Reorder: move s3 to position 0
      doc1.transact(() => {
        arr1.delete(2, 1); // remove s3
        arr1.insert(0, ["s3"]); // insert at front
      });

      expect(arr2.toArray()).toEqual(["s3", "s1", "s2"]);
    });

    it("should sync slide deletion", () => {
      const { slidesOrder: arr1, slides: map1 } = initDocStructure(doc1);
      const { slides: map2 } = initDocStructure(doc2);

      // Add slides
      arr1.push(["s1", "s2"]);
      const s1Map = new Y.Map();
      s1Map.set("id", "s1");
      map1.set("s1", s1Map);
      const s2Map = new Y.Map();
      s2Map.set("id", "s2");
      map1.set("s2", s2Map);

      expect(map2.size).toBe(2);

      // Delete s1
      doc1.transact(() => {
        arr1.delete(0, 1);
        map1.delete("s1");
      });

      const arr2 = doc2.getArray<string>("slidesOrder");
      expect(arr2.toArray()).toEqual(["s2"]);
      expect(map2.has("s1")).toBe(false);
      expect(map2.has("s2")).toBe(true);
    });

    it("should sync slide metadata updates", () => {
      const { slides: map1 } = initDocStructure(doc1);
      const { slides: map2 } = initDocStructure(doc2);

      const slideMap = new Y.Map();
      slideMap.set("id", "s1");
      slideMap.set("notes", "Original notes");
      map1.set("s1", slideMap);

      // Update notes
      (map1.get("s1") as Y.Map<unknown>).set("notes", "Updated notes");

      const synced = map2.get("s1") as Y.Map<unknown>;
      expect(synced.get("notes")).toBe("Updated notes");
    });
  });

  // ---- Element operations -------------------------------------------------

  describe("Element operations", () => {
    it("should sync element property updates", () => {
      const { elements: elMap1 } = initDocStructure(doc1);
      const { elements: elMap2 } = initDocStructure(doc2);

      const el = new Y.Map();
      el.set("id", "el-1");
      el.set("type", "shape");
      el.set("x", 50);
      el.set("y", 50);
      el.set("width", 200);
      el.set("height", 100);
      elMap1.set("el-1", el);

      // Update position
      (elMap1.get("el-1") as Y.Map<unknown>).set("x", 300);
      (elMap1.get("el-1") as Y.Map<unknown>).set("y", 400);

      const synced = elMap2.get("el-1") as Y.Map<unknown>;
      expect(synced.get("x")).toBe(300);
      expect(synced.get("y")).toBe(400);
      expect(synced.get("width")).toBe(200); // unchanged
    });

    it("should sync element addition and deletion across docs", () => {
      const { elements: elMap1 } = initDocStructure(doc1);
      const { elements: elMap2 } = initDocStructure(doc2);

      // Add from doc1
      const el1 = new Y.Map();
      el1.set("id", "el-a");
      elMap1.set("el-a", el1);

      // Add from doc2
      const el2 = new Y.Map();
      el2.set("id", "el-b");
      elMap2.set("el-b", el2);

      // Both should see both
      expect(elMap1.has("el-a")).toBe(true);
      expect(elMap1.has("el-b")).toBe(true);
      expect(elMap2.has("el-a")).toBe(true);
      expect(elMap2.has("el-b")).toBe(true);

      // Delete from doc1
      elMap1.delete("el-a");

      expect(elMap2.has("el-a")).toBe(false);
      expect(elMap2.has("el-b")).toBe(true);
    });
  });

  // ---- Undo/redo per user -------------------------------------------------

  describe("Per-user undo/redo", () => {
    it("should only undo local changes, not remote changes", () => {
      const { elements: elMap1 } = initDocStructure(doc1);
      const { elements: elMap2 } = initDocStructure(doc2);

      // Create undo managers scoped to each doc's client ID
      const um1 = new Y.UndoManager([doc1.getMap("elements")], {
        trackedOrigins: new Set([doc1.clientID]),
      });

      // User 1 adds an element
      doc1.transact(() => {
        const el = new Y.Map();
        el.set("id", "user1-el");
        el.set("text", "from user 1");
        elMap1.set("user1-el", el);
      }, doc1.clientID);

      // User 2 adds an element
      doc2.transact(() => {
        const el = new Y.Map();
        el.set("id", "user2-el");
        el.set("text", "from user 2");
        elMap2.set("user2-el", el);
      }, doc2.clientID);

      // Both elements should exist in both docs
      expect(elMap1.has("user1-el")).toBe(true);
      expect(elMap1.has("user2-el")).toBe(true);

      // User 1 undoes — should only remove user1-el
      um1.undo();

      expect(elMap1.has("user1-el")).toBe(false);
      expect(elMap1.has("user2-el")).toBe(true); // user2's element preserved

      // Redo should bring it back
      um1.redo();

      expect(elMap1.has("user1-el")).toBe(true);
      expect(elMap1.has("user2-el")).toBe(true);

      um1.destroy();
    });

    it("should track undo stack depth correctly", () => {
      const { elements: elMap1 } = initDocStructure(doc1);

      // captureTimeout = 0 prevents Yjs from merging rapid consecutive
      // transactions into a single undo stack item.
      const um = new Y.UndoManager([doc1.getMap("elements")], {
        trackedOrigins: new Set([doc1.clientID]),
        captureTimeout: 0,
      });

      expect(um.undoStack.length).toBe(0);
      expect(um.redoStack.length).toBe(0);

      // Make 3 changes
      for (let i = 0; i < 3; i++) {
        doc1.transact(() => {
          const el = new Y.Map();
          el.set("id", `el-${i}`);
          elMap1.set(`el-${i}`, el);
        }, doc1.clientID);
      }

      expect(um.undoStack.length).toBe(3);
      expect(um.redoStack.length).toBe(0);

      um.undo();
      expect(um.undoStack.length).toBe(2);
      expect(um.redoStack.length).toBe(1);

      um.undo();
      expect(um.undoStack.length).toBe(1);
      expect(um.redoStack.length).toBe(2);

      um.redo();
      expect(um.undoStack.length).toBe(2);
      expect(um.redoStack.length).toBe(1);

      um.destroy();
    });
  });

  // ---- Presence / awareness simulation ------------------------------------

  describe("Awareness simulation", () => {
    it("should broadcast and receive user presence via a shared map", () => {
      // Simulate awareness with a shared Y.Map (the real Awareness protocol
      // uses a separate channel, but the CRDT semantics are the same).
      const presenceMap1 = doc1.getMap("presence");
      const presenceMap2 = doc2.getMap("presence");

      // User 1 sets presence
      const user1Presence = new Y.Map();
      user1Presence.set("userId", "user-1");
      user1Presence.set("userName", "Alice");
      user1Presence.set("color", "#e74c3c");
      user1Presence.set("cursorX", 150);
      user1Presence.set("cursorY", 300);
      user1Presence.set("selectedSlideIndex", 0);
      user1Presence.set("isActive", true);
      presenceMap1.set("user-1", user1Presence);

      // User 2 sets presence
      const user2Presence = new Y.Map();
      user2Presence.set("userId", "user-2");
      user2Presence.set("userName", "Bob");
      user2Presence.set("color", "#3498db");
      user2Presence.set("cursorX", 400);
      user2Presence.set("cursorY", 100);
      user2Presence.set("selectedSlideIndex", 2);
      user2Presence.set("isActive", true);
      presenceMap2.set("user-2", user2Presence);

      // Doc1 should see user2's presence
      const u2InDoc1 = presenceMap1.get("user-2") as Y.Map<unknown>;
      expect(u2InDoc1.get("userName")).toBe("Bob");
      expect(u2InDoc1.get("cursorX")).toBe(400);
      expect(u2InDoc1.get("selectedSlideIndex")).toBe(2);

      // Doc2 should see user1's presence
      const u1InDoc2 = presenceMap2.get("user-1") as Y.Map<unknown>;
      expect(u1InDoc2.get("userName")).toBe("Alice");
      expect(u1InDoc2.get("cursorX")).toBe(150);
    });

    it("should update cursor position in real-time", () => {
      const presenceMap1 = doc1.getMap("presence");
      const presenceMap2 = doc2.getMap("presence");

      const user1 = new Y.Map();
      user1.set("userId", "user-1");
      user1.set("cursorX", 0);
      user1.set("cursorY", 0);
      presenceMap1.set("user-1", user1);

      // Simulate cursor movement
      user1.set("cursorX", 100);
      user1.set("cursorY", 200);

      const synced = presenceMap2.get("user-1") as Y.Map<unknown>;
      expect(synced.get("cursorX")).toBe(100);
      expect(synced.get("cursorY")).toBe(200);

      // Move again
      user1.set("cursorX", 500);
      user1.set("cursorY", 350);

      expect(synced.get("cursorX")).toBe(500);
      expect(synced.get("cursorY")).toBe(350);
    });

    it("should handle user disconnect (presence removal)", () => {
      const presenceMap1 = doc1.getMap("presence");
      const presenceMap2 = doc2.getMap("presence");

      const user1 = new Y.Map();
      user1.set("userId", "user-1");
      user1.set("isActive", true);
      presenceMap1.set("user-1", user1);

      expect(presenceMap2.has("user-1")).toBe(true);

      // User disconnects — remove presence
      presenceMap1.delete("user-1");

      expect(presenceMap2.has("user-1")).toBe(false);
    });
  });

  // ---- Transaction batching -----------------------------------------------

  describe("Transaction batching", () => {
    it("should batch multiple changes into a single transaction", () => {
      const { elements: elMap1 } = initDocStructure(doc1);
      const { elements: elMap2 } = initDocStructure(doc2);

      const updateCount = vi.fn();
      doc2.on("update", updateCount);

      doc1.transact(() => {
        for (let i = 0; i < 10; i++) {
          const el = new Y.Map();
          el.set("id", `batch-${i}`);
          el.set("x", i * 100);
          elMap1.set(`batch-${i}`, el);
        }
      });

      // All 10 elements should be in doc2
      expect(elMap2.size).toBe(10);
      for (let i = 0; i < 10; i++) {
        expect(elMap2.has(`batch-${i}`)).toBe(true);
      }

      // Transaction should have fired as a single update
      expect(updateCount).toHaveBeenCalledTimes(1);

      doc2.off("update", updateCount);
    });
  });

  // ---- State encoding/decoding -------------------------------------------

  describe("State encoding and full state sync", () => {
    it("should allow a new client to sync full state from an existing doc", () => {
      const { slidesOrder: arr1, slides: map1, elements: elMap1 } =
        initDocStructure(doc1);

      // Build up state in doc1
      arr1.push(["s1", "s2"]);

      const s1 = new Y.Map();
      s1.set("id", "s1");
      s1.set("slideNumber", 1);
      s1.set("elementIds", ["el-1"]);
      map1.set("s1", s1);

      const s2 = new Y.Map();
      s2.set("id", "s2");
      s2.set("slideNumber", 2);
      s2.set("elementIds", ["el-2"]);
      map1.set("s2", s2);

      const el1 = new Y.Map();
      el1.set("id", "el-1");
      el1.set("type", "text");
      el1.set("text", "Title");
      elMap1.set("el-1", el1);

      const el2 = new Y.Map();
      el2.set("id", "el-2");
      el2.set("type", "shape");
      el2.set("text", "Shape");
      elMap1.set("el-2", el2);

      // Create a brand-new doc and sync full state
      const doc3 = new Y.Doc();
      Y.applyUpdate(doc3, Y.encodeStateAsUpdate(doc1));

      const arr3 = doc3.getArray<string>("slidesOrder");
      const map3 = doc3.getMap("slides");
      const elMap3 = doc3.getMap("elements");

      expect(arr3.toArray()).toEqual(["s1", "s2"]);
      expect(map3.size).toBe(2);
      expect(elMap3.size).toBe(2);

      const syncedEl = elMap3.get("el-1") as Y.Map<unknown>;
      expect(syncedEl.get("text")).toBe("Title");

      doc3.destroy();
    });
  });
});
