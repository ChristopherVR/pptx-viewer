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

export interface PptxElementXmlBuilderOptions {
  emuPerPx: number;
  toDrawingTextVerticalAlign: (
    value: TextStyle["vAlign"] | undefined,
  ) => string | undefined;
  factoryProvider?: IPptxXmlFactoryProvider;
}

export class PptxElementXmlBuilder {
  private readonly emuPerPx: number;

  private readonly toDrawingTextVerticalAlign: (
    value: TextStyle["vAlign"] | undefined,
  ) => string | undefined;

  private nextId: number = 10000;

  private readonly textShapeXmlFactory: ITextShapeXmlFactory;

  private readonly connectorXmlFactory: IConnectorXmlFactory;

  private readonly pictureXmlFactory: IPictureXmlFactory;

  private readonly mediaGraphicFrameXmlFactory: IMediaGraphicFrameXmlFactory;

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

  private getNextId(): number {
    return this.nextId++;
  }

  public normalizePresetGeometry(shapeType: string | undefined): string {
    if (!shapeType) return "rect";
    if (shapeType === "cylinder") return "can";
    if (/^[A-Za-z][A-Za-z0-9_]*$/.test(shapeType)) {
      return shapeType;
    }
    return "rect";
  }

  public createElementXml(element: PptxElementWithText): XmlObject {
    return this.textShapeXmlFactory.createXmlElement({ element });
  }

  public createConnectorXml(element: ConnectorPptxElement): XmlObject {
    return this.connectorXmlFactory.createXmlElement({ element });
  }

  public createPictureXml(
    element: PptxImageLikeElement,
    relationshipId: string,
  ): XmlObject {
    return this.pictureXmlFactory.createXmlElement({
      element,
      relationshipId,
    });
  }

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
