/**
 * PresentationSubtitleBar
 *
 * Shows a live subtitle/caption bar during presentation mode.
 * Uses Web Speech API when available and falls back to a
 * localized "not supported" message otherwise.
 */
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PresentationSubtitleBarProps {
  visible: boolean;
}

interface SpeechRecognitionAlternativeLite {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLite {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternativeLite;
  [index: number]: SpeechRecognitionAlternativeLite;
}

interface SpeechRecognitionResultListLite {
  readonly length: number;
  item(index: number): SpeechRecognitionResultLite;
  [index: number]: SpeechRecognitionResultLite;
}

interface SpeechRecognitionEventLite extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLite;
}

interface SpeechRecognitionLite extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLite) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLite;

interface WindowWithSpeechRecognition {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresentationSubtitleBar({
  visible,
}: PresentationSubtitleBarProps): React.ReactElement | null {
  const { t } = useTranslation();
  const [captionText, setCaptionText] = useState<string>("");
  const [supportState, setSupportState] = useState<
    "unknown" | "supported" | "unsupported"
  >("unknown");
  const recognitionRef = useRef<SpeechRecognitionLite | null>(null);
  const shouldRunRef = useRef<boolean>(false);

  useEffect(() => {
    if (!visible) {
      shouldRunRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setCaptionText("");
      return;
    }

    shouldRunRef.current = true;
    const speechWindow = window as unknown as WindowWithSpeechRecognition;
    const RecognitionCtor =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      setSupportState("unsupported");
      return;
    }
    setSupportState("supported");

    const recognition = new RecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    recognition.onresult = (event: SpeechRecognitionEventLite) => {
      let finalText = "";
      let interimText = "";
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        const fragment = result?.[0]?.transcript ?? "";
        if (result?.isFinal) finalText += fragment;
        else interimText += fragment;
      }
      const merged = `${finalText} ${interimText}`.trim();
      if (merged.length > 0) setCaptionText(merged);
    };

    recognition.onerror = () => {
      // Keep the bar active and let `onend` attempt restart while visible.
    };
    recognition.onend = () => {
      if (!shouldRunRef.current) return;
      try {
        recognition.start();
      } catch {
        // Browser may throttle rapid restarts; next visibility toggle retries.
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setSupportState("unsupported");
    }

    return () => {
      shouldRunRef.current = false;
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [visible]);

  if (!visible) return null;

  const renderedText =
    supportState === "unsupported"
      ? t("pptx.subtitles.notSupported")
      : captionText.length > 0
        ? captionText
        : t("pptx.subtitles.listening");

  return (
    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-[70] max-w-[80%] min-w-[300px]">
      <div className="px-6 py-3 rounded-lg bg-black/75 backdrop-blur-sm border border-white/10">
        <p className="text-center text-[15px] text-white/70 italic">
          {renderedText}
        </p>
      </div>
    </div>
  );
}
