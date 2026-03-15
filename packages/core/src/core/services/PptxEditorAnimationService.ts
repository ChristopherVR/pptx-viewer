/**
 * Service for parsing and writing editor-level animation metadata stored in
 * custom PPTX extension elements.
 *
 * Editor animations are a simplified animation model stored in a custom XML
 * extension (`p:extLst`) on each slide. They provide a higher-level abstraction
 * over native OOXML timing trees, making it easier to manage animations in
 * the editor UI.
 *
 * @module PptxEditorAnimationService
 */
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

/**
 * Configuration options for creating a {@link PptxEditorAnimationService}.
 */
export interface PptxEditorAnimationServiceOptions {
  /** Service for namespace-aware XML child lookups. */
  xmlLookupService: IPptxXmlLookupService;
  /** URI used in the `@uri` attribute of the extension element. */
  editorMetaExtensionUri: string;
  /** XML namespace URI for the editor metadata elements. */
  editorMetaNamespaceUri: string;
}

/**
 * Interface for parsing and writing editor-level animation definitions.
 */
export interface IPptxEditorAnimationService {
  /**
   * Parse editor animation metadata from a slide's extension list.
   * @param slideXml - The full slide XML object.
   * @returns Array of parsed animations, empty array if extension exists but has
   *          no animations, or `undefined` if the extension is absent.
   */
  parseEditorAnimations(
    slideXml: XmlObject | undefined,
  ): PptxElementAnimation[] | undefined;
  /**
   * Serialize editor animations back into the slide's extension list.
   * @param slideNode - The root slide XML node (e.g., the `p:sld` element).
   * @param animations - The animations to write.
   */
  applyEditorAnimations(
    slideNode: XmlObject,
    animations: PptxElementAnimation[],
  ): void;
}

/**
 * Concrete implementation that reads/writes editor animation metadata
 * from/to the custom `pptx:editorMeta` extension element in slide XML.
 */
export class PptxEditorAnimationService implements IPptxEditorAnimationService {
  private readonly xmlLookupService: IPptxXmlLookupService;

  private readonly editorMetaExtensionUri: string;

  private readonly editorMetaNamespaceUri: string;

  /**
   * @param options - Service configuration with XML lookup and extension URIs.
   */
  public constructor(options: PptxEditorAnimationServiceOptions) {
    this.xmlLookupService = options.xmlLookupService;
    this.editorMetaExtensionUri = options.editorMetaExtensionUri;
    this.editorMetaNamespaceUri = options.editorMetaNamespaceUri;
  }

  /**
   * Parse editor animation metadata from a slide XML object.
   *
   * Traverses the slide's `p:extLst` to find the editor meta extension,
   * then extracts each `pptx:animation` node and normalizes its attributes
   * into typed {@link PptxElementAnimation} objects.
   *
   * @param slideXml - The full slide XML object.
   * @returns Sorted array of animations, empty array if no animations found,
   *          or `undefined` if the editor extension is not present.
   */
  public parseEditorAnimations(
    slideXml: XmlObject | undefined,
  ): PptxElementAnimation[] | undefined {
    // Navigate to the slide root -> extLst -> matching extension
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

    // Parse each animation node into a typed PptxElementAnimation
    const parsedAnimations: PptxElementAnimation[] = [];
    animationNodes.forEach((animationNode) => {
      // Skip nodes without a valid element ID
      const elementId = String(animationNode?.["@_elementId"] || "").trim();
      if (elementId.length === 0) return;

      // Normalize preset names (entrance, exit, emphasis) to canonical form
      const entrance = normalizeAnimationPreset(animationNode?.["@_entrance"]);
      const exit = normalizeAnimationPreset(animationNode?.["@_exit"]);
      const emphasis = normalizeAnimationPreset(animationNode?.["@_emphasis"]);

      // Parse numeric attributes with validation
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

      // Normalize enum-like string attributes to their typed equivalents
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

    // Sort by animation order for consistent playback sequencing
    return parsedAnimations.sort(
      (left, right) => (left.order || 0) - (right.order || 0),
    );
  }

  /**
   * Serialize editor animations into the slide's XML extension list.
   *
   * Sanitizes and validates each animation entry, removes any existing editor
   * meta extension, then writes the new animations into a `pptx:editorMeta`
   * extension element. If no valid animations remain, the extension is removed.
   *
   * @param slideNode - The root slide XML node to modify.
   * @param animations - Editor animations to serialize.
   */
  public applyEditorAnimations(
    slideNode: XmlObject,
    animations: PptxElementAnimation[],
  ): void {
    // Validate, sanitize, and convert each animation to XML attribute format
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

    // Collect existing extensions, excluding the old editor meta extension
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

    // If no animations remain, clean up the extension list
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

    // Declare the custom namespace and append the new editor meta extension
    slideNode["@_xmlns:pptx"] = this.editorMetaNamespaceUri;
    retainedExtensions.push({
      "@_uri": this.editorMetaExtensionUri,
      "pptx:editorMeta": {
        "pptx:animations": {
          "pptx:animation": sanitizedAnimations,
        },
      },
    });

    slideNode["p:extLst"] = {
      "p:ext": retainedExtensions,
    };
  }
}
