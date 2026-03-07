import type {
  ConnectorPptxElement,
  MediaPptxElement,
  PptxElementWithText,
  PptxImageLikeElement,
  TextStyle,
  XmlObject,
} from "../types";
import type {
  IConnectorXmlFactory,
  IMediaGraphicFrameXmlFactory,
  IPictureXmlFactory,
  IPptxXmlFactoryProvider,
  ITextShapeXmlFactory,
  PptxBuilderFactoryContext,
} from "./factories/types";
import { PptxXmlFactoryProvider } from "./factories/PptxXmlFactoryProvider";

/**
 * Configuration options for {@link PptxElementXmlBuilder}.
 */
export interface PptxElementXmlBuilderOptions {
  /** EMU-to-pixel conversion factor (typically 9525). */
  emuPerPx: number;
  /** Maps a vertical alignment enum value to its DrawingML string (e.g. "t", "ctr", "b"). */
  toDrawingTextVerticalAlign: (
    value: TextStyle["vAlign"] | undefined,
  ) => string | undefined;
  /** Optional custom factory provider for XML element construction. */
  factoryProvider?: IPptxXmlFactoryProvider;
}

/**
 * High-level builder that creates OpenXML (`p:sp`, `p:cxnSp`, `p:pic`, `p:graphicFrame`)
 * XML objects for newly inserted PPTX elements.
 *
 * Delegates element-specific XML construction to pluggable factories (text shape,
 * connector, picture, media graphic frame) obtained via an {@link IPptxXmlFactoryProvider}.
 */
export class PptxElementXmlBuilder {
  /** EMU-to-pixel ratio used for coordinate conversion. */
  private readonly emuPerPx: number;

  /** Callback to convert vertical alignment enums to DrawingML attribute values. */
  private readonly toDrawingTextVerticalAlign: (
    value: TextStyle["vAlign"] | undefined,
  ) => string | undefined;

  /** Auto-incrementing counter for generating unique element IDs within a slide. */
  private nextId: number = 10000;

  /** Factory for building text shape (`p:sp`) XML. */
  private readonly textShapeXmlFactory: ITextShapeXmlFactory;

  /** Factory for building connector shape (`p:cxnSp`) XML. */
  private readonly connectorXmlFactory: IConnectorXmlFactory;

  /** Factory for building picture (`p:pic`) XML. */
  private readonly pictureXmlFactory: IPictureXmlFactory;

  /** Factory for building media graphic frame (`p:graphicFrame`) XML. */
  private readonly mediaGraphicFrameXmlFactory: IMediaGraphicFrameXmlFactory;

  /**
   * @param options - Builder configuration including unit conversion and factory provider.
   */
  public constructor(options: PptxElementXmlBuilderOptions) {
    this.emuPerPx = options.emuPerPx;
    this.toDrawingTextVerticalAlign = options.toDrawingTextVerticalAlign;
    const factoryProvider =
      options.factoryProvider || new PptxXmlFactoryProvider();

    const factoryContext: PptxBuilderFactoryContext = {
      emuPerPx: this.emuPerPx,
      getNextId: () => this.getNextId(),
      normalizePresetGeometry: (shapeType) =>
        this.normalizePresetGeometry(shapeType),
      toDrawingTextVerticalAlign: (value) =>
        this.toDrawingTextVerticalAlign(value),
    };
    this.textShapeXmlFactory =
      factoryProvider.createTextShapeFactory(factoryContext);
    this.connectorXmlFactory =
      factoryProvider.createConnectorFactory(factoryContext);
    this.pictureXmlFactory =
      factoryProvider.createPictureFactory(factoryContext);
    this.mediaGraphicFrameXmlFactory =
      factoryProvider.createMediaGraphicFrameFactory(factoryContext);
  }

  /**
   * Reset the auto-increment ID counter.
   * Call after loading a file, passing `max(allExistingElementIds) + 1`
   * so that newly created elements never collide with existing ones.
   */
  public resetIdCounter(startFrom: number): void {
    this.nextId = startFrom;
  }

  /** Returns the next unique element ID and increments the counter. */
  private getNextId(): number {
    return this.nextId++;
  }

  /**
   * Normalize a shape type string to a valid DrawingML preset geometry name.
   * Falls back to "rect" for missing or invalid values; maps "cylinder" to "can".
   * @param shapeType - Raw shape type identifier.
   * @returns A valid `a:prstGeom/@prst` value.
   */
  public normalizePresetGeometry(shapeType: string | undefined): string {
    if (!shapeType) return "rect";
    if (shapeType === "cylinder") return "can";
    if (/^[A-Za-z][A-Za-z0-9_]*$/.test(shapeType)) {
      return shapeType;
    }
    return "rect";
  }

  /**
   * Build a `p:sp` (shape) XML object for a text or rectangle element.
   * @param element - The text/shape element model.
   * @returns An XML object ready for insertion into a slide's `p:spTree`.
   */
  public createElementXml(element: PptxElementWithText): XmlObject {
    return this.textShapeXmlFactory.createXmlElement({ element });
  }

  /**
   * Build a `p:cxnSp` (connector shape) XML object.
   * @param element - The connector element model.
   * @returns An XML object representing an OpenXML connection shape.
   */
  public createConnectorXml(element: ConnectorPptxElement): XmlObject {
    return this.connectorXmlFactory.createXmlElement({ element });
  }

  /**
   * Build a `p:pic` (picture) XML object.
   * @param element - The image element model.
   * @param relationshipId - The relationship ID (`r:embed`) pointing to the image part.
   * @returns An XML object representing an OpenXML picture element.
   */
  public createPictureXml(
    element: PptxImageLikeElement,
    relationshipId: string,
  ): XmlObject {
    return this.pictureXmlFactory.createXmlElement({
      element,
      relationshipId,
    });
  }

  /**
   * Build a `p:graphicFrame` XML object for an audio or video element.
   * @param element - The media element model.
   * @param relationshipId - The relationship ID (`r:link`) pointing to the media part.
   * @returns An XML object representing an OpenXML graphic frame for media.
   */
  public createMediaGraphicFrameXml(
    element: MediaPptxElement,
    relationshipId: string,
  ): XmlObject {
    return this.mediaGraphicFrameXmlFactory.createXmlElement({
      element,
      relationshipId,
    });
  }
}
