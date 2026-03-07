import type {
  ConnectorPptxElement,
  MediaPptxElement,
  PptxElementWithText,
  PptxImageLikeElement,
  TextStyle,
  XmlObject,
} from "../../types";

export interface PptxBuilderFactoryContext {
  emuPerPx: number;
  getNextId: () => number;
  normalizePresetGeometry: (shapeType: string | undefined) => string;
  toDrawingTextVerticalAlign: (
    value: TextStyle["vAlign"] | undefined,
  ) => string | undefined;
}

export interface IXmlElementFactory<
  TInit,
  TResult extends XmlObject = XmlObject,
> {
  createXmlElement(init: TInit): TResult;
}

export interface PictureXmlFactoryInit {
  element: PptxImageLikeElement;
  relationshipId: string;
}

export interface TextShapeXmlFactoryInit {
  element: PptxElementWithText;
}

export interface ConnectorXmlFactoryInit {
  element: ConnectorPptxElement;
}

export interface MediaGraphicFrameXmlFactoryInit {
  element: MediaPptxElement;
  relationshipId: string;
}

export interface ITextShapeXmlFactory extends IXmlElementFactory<TextShapeXmlFactoryInit> {}

export interface IConnectorXmlFactory extends IXmlElementFactory<ConnectorXmlFactoryInit> {}

export interface IPictureXmlFactory extends IXmlElementFactory<PictureXmlFactoryInit> {}

export interface IMediaGraphicFrameXmlFactory extends IXmlElementFactory<MediaGraphicFrameXmlFactoryInit> {}

export interface IPptxXmlFactoryProvider {
  createTextShapeFactory(
    context: PptxBuilderFactoryContext,
  ): ITextShapeXmlFactory;
  createConnectorFactory(
    context: PptxBuilderFactoryContext,
  ): IConnectorXmlFactory;
  createPictureFactory(context: PptxBuilderFactoryContext): IPictureXmlFactory;
  createMediaGraphicFrameFactory(
    context: PptxBuilderFactoryContext,
  ): IMediaGraphicFrameXmlFactory;
}
