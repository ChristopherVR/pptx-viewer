/**
 * Adaptive Huffman coder using a splay-tree that maintains the sibling
 * property (nodes ordered by non-increasing weight).
 *
 * Ported from libeot (MPL 2.0) MTX_AHUFF implementation.
 *
 * Tree layout (1-indexed):
 *   - ROOT          = 1
 *   - Internal nodes = 1 .. range-1
 *   - Leaf nodes     = range .. 2*range-1
 *   - Leaf at index (range + i) encodes symbol i  (0 <= i < range)
 *
 * The tree is initialised as a perfect / near-perfect binary tree and
 * then optionally pre-biased depending on the symbol range.
 */
import { BitIO } from "./bitio";

/** A single node in the adaptive Huffman tree. */
interface AHuffNode {
  /** Parent index (0 for the super-root sentinel). */
  up: number;
  /** Left child index (0 for leaves). */
  left: number;
  /** Right child index (0 for leaves). */
  right: number;
  /**
   * Symbol code for leaves (>= 0), or -1 for internal nodes.
   * A non-negative value signals "this is a leaf".
   */
  code: number;
  /** Cumulative weight used to maintain the sibling property. */
  weight: number;
}

/**
 * Return the number of bits required to represent the positive integer `x`.
 * Equivalent to floor(log2(x)) + 1.
 */
function bitsUsed(x: number): number {
  if (x <= 0) return 0;
  return 32 - Math.clz32(x);
}

export class AHuff {
  private bio: BitIO;
  private range: number;
  private tree: AHuffNode[];
  /** Maps symbol value -> current tree index of its leaf node. */
  private symbolIndex: number[];

  /** Number of bits that encode a "full-size" symbol (ceil(log2(range))). */
  private bitCount: number;
  /**
   * Secondary bit width used for large-range trees.
   * 0 when range <= 256 (small tree path).
   */
  private bitCount2: number;

  private static readonly ROOT = 1;

  constructor(bio: BitIO, range: number) {
    this.bio = bio;
    this.range = range;

    // Derive bit widths --------------------------------------------------
    this.bitCount = bitsUsed(range - 1);
    // bitCount2 is non-zero only when range > 256 (i.e. needs > 8 bits)
    this.bitCount2 = this.bitCount > 8 ? this.bitCount - 8 : 0;

    const treeSize = 2 * range; // indices 0 .. 2*range-1

    // Allocate the tree array (index 0 is unused sentinel) ---------------
    this.tree = new Array<AHuffNode>(treeSize);
    for (let i = 0; i < treeSize; i++) {
      this.tree[i] = { up: 0, left: 0, right: 0, code: -1, weight: 0 };
    }

    // Build parent pointers: every node i (2..2*range-1) has up = floor(i/2)
    for (let i = 2; i < treeSize; i++) {
      this.tree[i].up = i >> 1;
    }

    // Internal nodes (1 .. range-1): set children, code = -1
    for (let i = 1; i < range; i++) {
      this.tree[i].left = 2 * i;
      this.tree[i].right = 2 * i + 1;
      this.tree[i].code = -1;
    }

    // Leaf nodes (range .. 2*range-1): code = symbol index, weight = 1
    for (let i = 0; i < range; i++) {
      const leafIdx = range + i;
      this.tree[leafIdx].code = i;
      this.tree[leafIdx].weight = 1;
      // Leaves have no children (left/right remain 0)
    }

    // Build symbolIndex: symbol i -> leaf index (range + i)
    this.symbolIndex = new Array<number>(range);
    for (let i = 0; i < range; i++) {
      this.symbolIndex[i] = range + i;
    }

    // Compute internal node weights bottom-up ----------------------------
    this.initWeight(AHuff.ROOT);

    // Pre-bias weights depending on tree size ----------------------------
    if (this.bitCount2 !== 0) {
      // Large tree (range > 256): bias specific control symbols
      this.updateWeight(this.symbolIndex[256]);
      this.updateWeight(this.symbolIndex[257]);

      // DUP2 symbol = range - 3: 12 extra weight bumps
      const dup2Sym = range - 3;
      for (let i = 0; i < 12; i++) {
        this.updateWeight(this.symbolIndex[dup2Sym]);
      }

      // DUP4 symbol = range - 2: 6 extra weight bumps
      const dup4Sym = range - 2;
      for (let i = 0; i < 6; i++) {
        this.updateWeight(this.symbolIndex[dup4Sym]);
      }
    } else {
      // Small tree (range <= 256): update every symbol twice
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < range; i++) {
          this.updateWeight(this.symbolIndex[i]);
        }
      }
    }
  }

  // --------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------

  /**
   * Decode one symbol from the bit stream.
   *
   * Starting at ROOT, read one bit at a time:
   *   - 0 → go left
   *   - 1 → go right
   * Continue until a leaf (code >= 0) is reached.  Then update the
   * tree weights and return the symbol code.
   */
  readSymbol(): number {
    let a = AHuff.ROOT;

    // Traverse internal nodes until we hit a leaf
    while (this.tree[a].code < 0) {
      if (this.bio.inputBit()) {
        a = this.tree[a].right;
      } else {
        a = this.tree[a].left;
      }
    }

    // Update adaptive weights for the decoded leaf
    this.updateWeight(a);

    return this.tree[a].code;
  }

  // --------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------

  /**
   * Increment the weight of node `a` and propagate up to ROOT,
   * swapping nodes as necessary to maintain the sibling property
   * (nodes in non-increasing weight order by index).
   *
   * Algorithm:
   *   For each node from `a` up to (but not including) ROOT:
   *     1. Look at the predecessor (a-1).
   *     2. If it has the same weight, scan backwards to find the first
   *        node with that weight.
   *     3. Swap `a` with that first node (unless it is ROOT or `a`'s
   *        own parent) to restore ordering.
   *     4. Increment `a`'s weight.
   *     5. Move to `a`'s parent.
   *   Finally increment ROOT's weight.
   */
  private updateWeight(a: number): void {
    const tree = this.tree;

    for (; a !== AHuff.ROOT; a = tree[a].up) {
      let b = a - 1;
      if (b > 0 && tree[b].weight === tree[a].weight) {
        // Scan back to find the first (lowest-index) node with this weight
        while (b > AHuff.ROOT && tree[b - 1].weight === tree[a].weight) {
          b--;
        }
        // Only swap if b is past ROOT and b isn't the same node
        if (b > AHuff.ROOT && b !== a) {
          this.swapNodes(a, b);
          a = b; // continue from the swapped position
        }
      }
      tree[a].weight++;
    }

    // Increment ROOT weight
    tree[AHuff.ROOT].weight++;
  }

  /**
   * Swap two nodes in the tree while keeping the parent linkage
   * consistent.
   *
   * What gets swapped: left, right, code, weight — everything that
   * defines the *content* of the node.  The `up` pointer stays with
   * the position (the parent still points here).
   *
   * After the content swap we must:
   *   1. Fix children's `up` pointers (they now live under the other
   *      position).
   *   2. Fix `symbolIndex` for leaves so we can still find them by
   *      symbol value.
   */
  private swapNodes(a: number, b: number): void {
    const tree = this.tree;
    const na = tree[a];
    const nb = tree[b];

    // Swap content fields ------------------------------------------------
    let tmp: number;

    tmp = na.left;    na.left = nb.left;       nb.left = tmp;
    tmp = na.right;   na.right = nb.right;     nb.right = tmp;
    tmp = na.code;    na.code = nb.code;       nb.code = tmp;
    tmp = na.weight;  na.weight = nb.weight;   nb.weight = tmp;

    // Fix children's up-pointers -----------------------------------------
    // Node a's new children should point up to a
    if (na.left)  tree[na.left].up = a;
    if (na.right) tree[na.right].up = a;

    // Node b's new children should point up to b
    if (nb.left)  tree[nb.left].up = b;
    if (nb.right) tree[nb.right].up = b;

    // Fix symbolIndex for leaves -----------------------------------------
    if (na.code >= 0) this.symbolIndex[na.code] = a;
    if (nb.code >= 0) this.symbolIndex[nb.code] = b;
  }

  /**
   * Recursively compute weights for internal nodes after the initial
   * tree construction.  Leaf weights are already set to 1.
   *
   * weight(internal) = weight(left) + weight(right)
   */
  private initWeight(a: number): number {
    const node = this.tree[a];
    if (node.code >= 0) {
      // Leaf — weight is already 1
      return node.weight;
    }
    node.weight = this.initWeight(node.left) + this.initWeight(node.right);
    return node.weight;
  }
}
