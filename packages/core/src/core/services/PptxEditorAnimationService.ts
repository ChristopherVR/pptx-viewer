import type { PptxElementAnimation, XmlObject } from "../types";
import type { IPptxXmlLookupService } from "./PptxXmlLookupService";
import {
  normalizeAnimationPreset,
  normalizeTrigger,
  normalizeTimingCurve,
  normalizeRepeatMode,
  normalizeDirection,
  normalizeSequence,
  normalizeAfterAnimation,
} from "./editor-animation-normalizers";

export interface PptxEditorAnimationServiceOptions {
  xmlLookupService: IPptxXmlLookupService;
  editorMetaExtensionUri: string;
  editorMetaNamespaceUri: string;
}

export interface IPptxEditorAnimationService {
  parseEditorAnimations(
    slideXml: XmlObject | undefined,
  ): PptxElementAnimation[] | undefined;
  applyEditorAnimations(
    slideNode: XmlObject,
    animations: PptxElementAnimation[],
  ): void;
}

export class PptxEditorAnimationService implements IPptxEditorAnimationService {
  private readonly xmlLookupService: IPptxXmlLookupService;

  private readonly editorMetaExtensionUri: string;

  private readonly editorMetaNamespaceUri: string;

  public constructor(options: PptxEditorAnimationServiceOptions) {
    this.xmlLookupService = options.xmlLookupService;
    this.editorMetaExtensionUri = options.editorMetaExtensionUri;
    this.editorMetaNamespaceUri = options.editorMetaNamespaceUri;
  }

  public parseEditorAnimations(
    slideXml: XmlObject | undefined,
  ): PptxElementAnimation[] | undefined {
    const slideRoot = this.xmlLookupService.getChildByLocalName(
      slideXml,
      "sld",
    );
    const extensionList = this.xmlLookupService.getChildByLocalName(
      slideRoot,
      "extLst",
    );
    const extensions = this.xmlLookupService.getChildrenArrayByLocalName(
      extensionList,
      "ext",
    );
    const editorExtension = extensions.find(
      (extension) =>
        String(extension?.["@_uri"] || "").trim() ===
        this.editorMetaExtensionUri,
    );
    if (!editorExtension) return undefined;

    const editorMeta = this.xmlLookupService.getChildByLocalName(
      editorExtension,
      "editorMeta",
    );
    const animationsNode = this.xmlLookupService.getChildByLocalName(
      editorMeta,
      "animations",
    );
    const animationNodes = this.xmlLookupService.getChildrenArrayByLocalName(
      animationsNode,
      "animation",
    );
    if (animationNodes.length === 0) {
      return [];
    }

    const parsedAnimations: PptxElementAnimation[] = [];
    animationNodes.forEach((animationNode) => {
      const elementId = String(animationNode?.["@_elementId"] || "").trim();
      if (elementId.length === 0) return;

      const entrance = normalizeAnimationPreset(animationNode?.["@_entrance"]);
      const exit = normalizeAnimationPreset(animationNode?.["@_exit"]);
      const emphasis = normalizeAnimationPreset(animationNode?.["@_emphasis"]);

      const durationRaw = Number.parseInt(
        String(animationNode?.["@_durationMs"] || ""),
        10,
      );
      const delayRaw = Number.parseInt(
        String(animationNode?.["@_delayMs"] || ""),
        10,
      );
      const orderRaw = Number.parseInt(
        String(animationNode?.["@_order"] || ""),
        10,
      );
      const repeatCountRaw = Number.parseInt(
        String(animationNode?.["@_repeatCount"] || ""),
        10,
      );

      const trigger = normalizeTrigger(animationNode?.["@_trigger"]);
      const timingCurve = normalizeTimingCurve(
        animationNode?.["@_timingCurve"],
      );
      const repeatMode = normalizeRepeatMode(animationNode?.["@_repeatMode"]);
      const direction = normalizeDirection(animationNode?.["@_direction"]);
      const sequence = normalizeSequence(animationNode?.["@_sequence"]);
      const afterAnimation = normalizeAfterAnimation(
        animationNode?.["@_afterAnimation"],
      );
      const afterAnimationColor = animationNode?.["@_afterAnimationColor"]
        ? String(animationNode["@_afterAnimationColor"]).trim()
        : undefined;
      const motionPath = animationNode?.["@_motionPath"]
        ? String(animationNode["@_motionPath"]).trim()
        : undefined;

      parsedAnimations.push({
        elementId,
        entrance: entrance === "none" ? undefined : entrance,
        exit: exit === "none" ? undefined : exit,
        emphasis: emphasis === "none" ? undefined : emphasis,
        durationMs:
          Number.isFinite(durationRaw) && durationRaw > 0
            ? durationRaw
            : undefined,
        delayMs:
          Number.isFinite(delayRaw) && delayRaw >= 0 ? delayRaw : undefined,
        order: Number.isFinite(orderRaw) ? orderRaw : undefined,
        trigger,
        timingCurve,
        repeatCount:
          Number.isFinite(repeatCountRaw) && repeatCountRaw > 0
            ? repeatCountRaw
            : undefined,
        repeatMode,
        direction,
        sequence,
        afterAnimation,
        afterAnimationColor: afterAnimationColor || undefined,
        motionPath: motionPath || undefined,
      });
    });

    return parsedAnimations.sort(
      (left, right) => (left.order || 0) - (right.order || 0),
    );
  }

  public applyEditorAnimations(
    slideNode: XmlObject,
    animations: PptxElementAnimation[],
  ): void {
    const sanitizedAnimations = animations
      .map((animation) => {
        const elementId = String(animation.elementId || "").trim();
        if (elementId.length === 0) return null;

        const entrance = normalizeAnimationPreset(animation.entrance);
        const exit = normalizeAnimationPreset(animation.exit);
        const emphasis = normalizeAnimationPreset(animation.emphasis);
        const durationMs =
          typeof animation.durationMs === "number" &&
          Number.isFinite(animation.durationMs) &&
          animation.durationMs > 0
            ? Math.round(animation.durationMs)
            : undefined;
        const delayMs =
          typeof animation.delayMs === "number" &&
          Number.isFinite(animation.delayMs) &&
          animation.delayMs >= 0
            ? Math.round(animation.delayMs)
            : undefined;
        const order =
          typeof animation.order === "number" &&
          Number.isFinite(animation.order)
            ? Math.round(animation.order)
            : undefined;
        const repeatCount =
          typeof animation.repeatCount === "number" &&
          Number.isFinite(animation.repeatCount) &&
          animation.repeatCount > 0
            ? animation.repeatCount
            : undefined;

        if (!entrance && !exit && !emphasis && !animation.motionPath)
          return null;

        return {
          "@_elementId": elementId,
          "@_entrance": entrance && entrance !== "none" ? entrance : undefined,
          "@_exit": exit && exit !== "none" ? exit : undefined,
          "@_emphasis": emphasis && emphasis !== "none" ? emphasis : undefined,
          "@_durationMs": durationMs ? String(durationMs) : undefined,
          "@_delayMs":
            delayMs !== undefined ? String(Math.max(0, delayMs)) : undefined,
          "@_order": order !== undefined ? String(order) : undefined,
          "@_trigger": animation.trigger ?? undefined,
          "@_timingCurve": animation.timingCurve ?? undefined,
          "@_repeatCount":
            repeatCount !== undefined ? String(repeatCount) : undefined,
          "@_repeatMode": animation.repeatMode ?? undefined,
          "@_direction": animation.direction ?? undefined,
          "@_sequence": animation.sequence ?? undefined,
          "@_afterAnimation": animation.afterAnimation ?? undefined,
          "@_afterAnimationColor": animation.afterAnimationColor ?? undefined,
          "@_motionPath": animation.motionPath ?? undefined,
        } as XmlObject;
      })
      .filter((entry): entry is XmlObject => Boolean(entry))
      .sort((left, right) => {
        const leftOrder = Number.parseInt(String(left["@_order"] || "0"), 10);
        const rightOrder = Number.parseInt(String(right["@_order"] || "0"), 10);
        return leftOrder - rightOrder;
      });

    const existingExtensionList =
      this.xmlLookupService.getChildByLocalName(slideNode, "extLst") || {};
    const extensionEntries = this.xmlLookupService.getChildrenArrayByLocalName(
      existingExtensionList,
      "ext",
    );
    const retainedExtensions = extensionEntries.filter(
      (entry) =>
        String(entry?.["@_uri"] || "").trim() !== this.editorMetaExtensionUri,
    );

    if (sanitizedAnimations.length === 0) {
      if (retainedExtensions.length > 0) {
        slideNode["p:extLst"] = {
          "p:ext": retainedExtensions,
        };
      } else {
        delete slideNode["p:extLst"];
      }
      return;
    }

    slideNode["@_xmlns:fuzor"] = this.editorMetaNamespaceUri;
    retainedExtensions.push({
      "@_uri": this.editorMetaExtensionUri,
      "fuzor:editorMeta": {
        "fuzor:animations": {
          "fuzor:animation": sanitizedAnimations,
        },
      },
    });

    slideNode["p:extLst"] = {
      "p:ext": retainedExtensions,
    };
  }
}
