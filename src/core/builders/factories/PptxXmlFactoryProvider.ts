import { ConnectorXmlFactory } from "./ConnectorXmlFactory";
import { MediaGraphicFrameXmlFactory } from "./MediaGraphicFrameXmlFactory";
import { PictureXmlFactory } from "./PictureXmlFactory";
import { TextShapeXmlFactory } from "./TextShapeXmlFactory";
import type {
  IPptxXmlFactoryProvider,
  PptxBuilderFactoryContext,
  ITextShapeXmlFactory,
  IConnectorXmlFactory,
  IPictureXmlFactory,
  IMediaGraphicFrameXmlFactory,
} from "./types";

export class PptxXmlFactoryProvider implements IPptxXmlFactoryProvider {
  public createTextShapeFactory(
    context: PptxBuilderFactoryContext,
  ): ITextShapeXmlFactory {
    return new TextShapeXmlFactory(context);
  }

  public createConnectorFactory(
    context: PptxBuilderFactoryContext,
  ): IConnectorXmlFactory {
    return new ConnectorXmlFactory(context);
  }

  public createPictureFactory(
    context: PptxBuilderFactoryContext,
  ): IPictureXmlFactory {
    return new PictureXmlFactory(context);
  }

  public createMediaGraphicFrameFactory(
    context: PptxBuilderFactoryContext,
  ): IMediaGraphicFrameXmlFactory {
    return new MediaGraphicFrameXmlFactory(context);
  }
}
