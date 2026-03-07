import { XMLBuilder, XMLParser } from "fast-xml-parser";
import type JSZip from "jszip";

import {
  PptxCompatibilityService,
  PptxDocumentPropertiesUpdater,
  PptxEditorAnimationService,
  PptxNativeAnimationService,
  PptxAnimationWriteService,
  PptxSlideLoaderService,
  PptxSlideTransitionService,
  PptxTemplateBackgroundService,
  PptxXmlLookupService,
  type IPptxCompatibilityService,
  type IPptxEditorAnimationService,
  type IPptxNativeAnimationService,
  type IPptxAnimationWriteService,
  type IPptxSlideLoaderService,
  type IPptxSlideTransitionService,
  type IPptxTemplateBackgroundService,
  type IPptxXmlLookupService,
} from "../../services";

export interface PptxRuntimeDependencyFactoryInput {
  zip: JSZip;
  parser: XMLParser;
  builder: XMLBuilder;
  editorMetaExtensionUri: string;
  editorMetaNamespaceUri: string;
  getXmlLocalName: (xmlKey: string) => string;
}

export interface PptxRuntimeDependencyBundle {
  compatibilityService: IPptxCompatibilityService;
  slideLoaderService: IPptxSlideLoaderService;
  slideTransitionService: IPptxSlideTransitionService;
  editorAnimationService: IPptxEditorAnimationService;
  nativeAnimationService: IPptxNativeAnimationService;
  animationWriteService: IPptxAnimationWriteService;
  templateBackgroundService: IPptxTemplateBackgroundService;
  xmlLookupService: IPptxXmlLookupService;
  documentPropertiesUpdater: PptxDocumentPropertiesUpdater;
}

export interface IPptxRuntimeDependencyFactory {
  createParser(): XMLParser;
  createBuilder(): XMLBuilder;
  createDocumentPropertiesUpdater(
    zip: JSZip,
    parser: XMLParser,
    builder: XMLBuilder,
  ): PptxDocumentPropertiesUpdater;
  createDependencies(
    input: PptxRuntimeDependencyFactoryInput,
  ): PptxRuntimeDependencyBundle;
}

export class PptxRuntimeDependencyFactory implements IPptxRuntimeDependencyFactory {
  public createParser(): XMLParser {
    return new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: false,
    });
  }

  public createBuilder(): XMLBuilder {
    return new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      format: true,
    });
  }

  public createDocumentPropertiesUpdater(
    zip: JSZip,
    parser: XMLParser,
    builder: XMLBuilder,
  ): PptxDocumentPropertiesUpdater {
    return new PptxDocumentPropertiesUpdater({
      zip,
      parser,
      builder,
    });
  }

  public createDependencies(
    input: PptxRuntimeDependencyFactoryInput,
  ): PptxRuntimeDependencyBundle {
    const xmlLookupService = new PptxXmlLookupService();
    const compatibilityService = new PptxCompatibilityService();

    return {
      xmlLookupService,
      compatibilityService,
      slideLoaderService: new PptxSlideLoaderService(),
      templateBackgroundService: new PptxTemplateBackgroundService(),
      slideTransitionService: new PptxSlideTransitionService({
        xmlLookupService,
        getXmlLocalName: input.getXmlLocalName,
      }),
      editorAnimationService: new PptxEditorAnimationService({
        xmlLookupService,
        editorMetaExtensionUri: input.editorMetaExtensionUri,
        editorMetaNamespaceUri: input.editorMetaNamespaceUri,
      }),
      nativeAnimationService: new PptxNativeAnimationService(),
      animationWriteService: new PptxAnimationWriteService(),
      documentPropertiesUpdater: this.createDocumentPropertiesUpdater(
        input.zip,
        input.parser,
        input.builder,
      ),
    };
  }
}
