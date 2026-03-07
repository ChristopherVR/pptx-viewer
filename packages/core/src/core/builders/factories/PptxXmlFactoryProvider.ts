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

/**
 * Default implementation of {@link IPptxXmlFactoryProvider}.
 *
 * Creates concrete factory instances for each supported PPTX element type
 * (text shape, connector, picture, media graphic frame). Consumers can
 * substitute a custom provider to override XML generation behavior.
 */
export class PptxXmlFactoryProvider implements IPptxXmlFactoryProvider {
  /** @inheritdoc */
  public createTextShapeFactory(
    context: PptxBuilderFactoryContext,
  ): ITextShapeXmlFactory {
    return new TextShapeXmlFactory(context);
  }

  /** @inheritdoc */
  public createConnectorFactory(
    context: PptxBuilderFactoryContext,
  ): IConnectorXmlFactory {
    return new ConnectorXmlFactory(context);
  }

  /** @inheritdoc */
  public createPictureFactory(
    context: PptxBuilderFactoryContext,
  ): IPictureXmlFactory {
    return new PictureXmlFactory(context);
  }

  /** @inheritdoc */
  public createMediaGraphicFrameFactory(
    context: PptxBuilderFactoryContext,
  ): IMediaGraphicFrameXmlFactory {
    return new MediaGraphicFrameXmlFactory(context);
  }
}
