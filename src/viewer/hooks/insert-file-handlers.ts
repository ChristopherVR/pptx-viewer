/**
 * insert-file-handlers — Factory functions for image and media file-picking
 * handlers used by useInsertElements.
 */
import type {
  PptxElement,
  PptxSlide,
  ImagePptxElement,
  MediaPptxElement,
} from "../../core";
import { generateElementId } from "../utils/generate-id";
import type { CanvasSize } from "../types";

export interface FileHandlerDeps {
  activeSlide: PptxSlide | undefined;
  canvasSize: CanvasSize;
  addElement: (element: PptxElement) => void;
}

export interface FileHandlers {
  handleImageFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleMediaFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function createFileHandlers(deps: FileHandlerDeps): FileHandlers {
  const { activeSlide, canvasSize, addElement } = deps;

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSlide) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => {
        const MAX_W = 500,
          MAX_H = 400;
        let w = img.naturalWidth || 400,
          h = img.naturalHeight || 300;
        if (w > MAX_W || h > MAX_H) {
          const scale = Math.min(MAX_W / w, MAX_H / h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        addElement({
          id: generateElementId(),
          type: "image",
          x: Math.round((canvasSize.width - w) / 2),
          y: Math.round((canvasSize.height - h) / 2),
          width: w,
          height: h,
          imageData: dataUrl,
        } as ImagePptxElement);
      };
      img.onerror = () => {
        addElement({
          id: generateElementId(),
          type: "image",
          x: 100,
          y: 100,
          width: 400,
          height: 300,
          imageData: dataUrl,
        } as ImagePptxElement);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSlide) return;
    e.target.value = "";
    const mediaType = file.type.startsWith("audio/")
      ? "audio"
      : file.type.startsWith("video/")
        ? "video"
        : null;
    if (!mediaType) return;
    const elFilePath: string | undefined = (file as File & { path?: string })
      .path;

    const insertMediaElement = (
      mediaSourceUrl: string,
      width: number,
      height: number,
    ) => {
      addElement({
        id: generateElementId(),
        type: "media",
        mediaType,
        mediaMimeType: file.type || undefined,
        mediaData: mediaSourceUrl,
        x: Math.round((canvasSize.width - width) / 2),
        y: Math.round((canvasSize.height - height) / 2),
        width,
        height,
      } as MediaPptxElement);
    };

    if (elFilePath) {
      let normalized = elFilePath.replace(/\\/g, "/");
      if (!normalized.startsWith("/")) normalized = `/${normalized}`;
      const mediaUrl = `fuzor-resource://media${encodeURI(normalized)}`;
      if (mediaType === "audio") {
        insertMediaElement(mediaUrl, 420, 64);
        return;
      }
      const probeUrl = URL.createObjectURL(file);
      const probeVideo = document.createElement("video");
      probeVideo.preload = "metadata";
      probeVideo.onloadedmetadata = () => {
        URL.revokeObjectURL(probeUrl);
        const mW = 640,
          mH = 360;
        let w = probeVideo.videoWidth || mW,
          h = probeVideo.videoHeight || mH;
        if (w > mW || h > mH) {
          const sc = Math.min(mW / w, mH / h);
          w = Math.round(w * sc);
          h = Math.round(h * sc);
        }
        insertMediaElement(mediaUrl, w, h);
      };
      probeVideo.onerror = () => {
        URL.revokeObjectURL(probeUrl);
        insertMediaElement(mediaUrl, 640, 360);
      };
      probeVideo.src = probeUrl;
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (!dataUrl) return;
      if (mediaType === "audio") {
        insertMediaElement(dataUrl, 420, 64);
        return;
      }
      const probeVideo = document.createElement("video");
      probeVideo.preload = "metadata";
      probeVideo.onloadedmetadata = () => {
        const mW = 640,
          mH = 360;
        let w = probeVideo.videoWidth || mW,
          h = probeVideo.videoHeight || mH;
        if (w > mW || h > mH) {
          const sc = Math.min(mW / w, mH / h);
          w = Math.round(w * sc);
          h = Math.round(h * sc);
        }
        insertMediaElement(dataUrl, w, h);
      };
      probeVideo.onerror = () => {
        insertMediaElement(dataUrl, 640, 360);
      };
      probeVideo.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  return { handleImageFileChange, handleMediaFileChange };
}
