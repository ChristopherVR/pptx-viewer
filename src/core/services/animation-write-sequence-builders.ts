import type { PptxElementAnimation, XmlObject } from "../types";
import {
  buildSingleEffectNode,
  buildMotionPathNode,
} from "./animation-write-node-builders";

/**
 * Build effect nodes for a single animation entry.
 * An animation can have entrance, emphasis, and exit effects,
 * each producing its own p:par node.
 */
export function buildEffectNodesForAnimation(
  anim: PptxElementAnimation,
  allocateId: () => number,
): XmlObject[] {
  const nodes: XmlObject[] = [];

  if (anim.entrance && anim.entrance !== "none") {
    const node = buildSingleEffectNode(anim, anim.entrance, "entr", allocateId);
    if (node) nodes.push(node);
  }

  if (anim.emphasis && anim.emphasis !== "none") {
    const triggerForEmphasis =
      nodes.length > 0 ? "afterPrevious" : (anim.trigger ?? "onClick");
    const node = buildSingleEffectNode(
      { ...anim, trigger: triggerForEmphasis },
      anim.emphasis,
      "emph",
      allocateId,
    );
    if (node) nodes.push(node);
  }

  if (anim.exit && anim.exit !== "none") {
    const triggerForExit =
      nodes.length > 0 ? "afterPrevious" : (anim.trigger ?? "onClick");
    const node = buildSingleEffectNode(
      { ...anim, trigger: triggerForExit },
      anim.exit,
      "exit",
      allocateId,
    );
    if (node) nodes.push(node);
  }

  if (anim.motionPath) {
    const triggerForPath =
      nodes.length > 0 ? "withPrevious" : (anim.trigger ?? "onClick");
    const node = buildMotionPathNode(
      { ...anim, trigger: triggerForPath },
      allocateId,
    );
    if (node) nodes.push(node);
  }

  return nodes;
}

/**
 * Build the p:bldLst node for paragraph-level animation sequencing.
 */
export function buildBuildListXml(
  animations: PptxElementAnimation[],
): XmlObject | undefined {
  const bldPNodes: XmlObject[] = [];

  for (const anim of animations) {
    if (!anim.sequence || anim.sequence === "asOne") continue;

    const bldType =
      anim.sequence === "byParagraph"
        ? "p"
        : anim.sequence === "byWord"
          ? "word"
          : "char";

    bldPNodes.push({
      "@_spid": anim.elementId,
      "@_grpId": "0",
      "@_build": bldType,
    });
  }

  if (bldPNodes.length === 0) return undefined;

  return {
    "p:bldP": bldPNodes.length === 1 ? bldPNodes[0] : bldPNodes,
  };
}

/**
 * Build interactive sequence `p:seq` nodes for animations triggered by
 * clicking a specific shape. Groups animations by their `triggerShapeId`.
 */
export function buildInteractiveSequences(
  animations: PptxElementAnimation[],
  allocateId: () => number,
): XmlObject[] {
  if (animations.length === 0) return [];

  const byTrigger = new Map<string, PptxElementAnimation[]>();
  for (const anim of animations) {
    const key = anim.triggerShapeId ?? "";
    if (!key) continue;
    const existing = byTrigger.get(key) ?? [];
    existing.push(anim);
    byTrigger.set(key, existing);
  }

  const seqNodes: XmlObject[] = [];

  for (const [triggerShapeId, anims] of byTrigger) {
    const effectNodes = anims.flatMap((a) =>
      buildEffectNodesForAnimation(a, allocateId),
    );
    if (effectNodes.length === 0) continue;

    const seqId = allocateId();
    const groupId = allocateId();

    const wrappedPar: XmlObject = {
      "p:cTn": {
        "@_id": String(groupId),
        "@_fill": "hold",
        "p:stCondLst": {
          "p:cond": {
            "@_delay": "0",
          },
        },
        "p:childTnLst": {
          "p:par": effectNodes.length === 1 ? effectNodes[0] : effectNodes,
        },
      },
    };

    const seqNode: XmlObject = {
      "p:cTn": {
        "@_id": String(seqId),
        "@_dur": "indefinite",
        "@_nodeType": "interactiveSeq",
        "p:stCondLst": {
          "p:cond": {
            "@_evt": "onClick",
            "@_delay": "0",
            "p:tgtEl": {
              "p:spTgt": {
                "@_spid": triggerShapeId,
              },
            },
          },
        },
        "p:childTnLst": {
          "p:par": wrappedPar,
        },
      },
      "p:nextCondLst": {
        "p:cond": {
          "@_evt": "onClick",
          "@_delay": "0",
          "p:tgtEl": {
            "p:spTgt": {
              "@_spid": triggerShapeId,
            },
          },
        },
      },
    };

    seqNodes.push(seqNode);
  }

  return seqNodes;
}
