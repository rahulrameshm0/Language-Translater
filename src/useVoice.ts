import { useEffect, useRef, useState } from "react";
import { AppState, Keyboard, Platform } from "react-native";
import { ExpoSpeechRecognitionModule as Recognition } from "expo-speech-recognition";
import {
  emptySpeechDraft,
  finishSpeech,
  receiveSpeech,
  speechText,
} from "./speechDraft";

function abortRecognition() {
  try {
    Recognition.abort();
  } catch {}
}

export function useVoice(report: (message: string) => void) {
  const [recording, setRecording] = useState(false);
  const [working, setWorking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [seconds, setSeconds] = useState(0);
  const draft = useRef(emptySpeechDraft());
  const request = useRef(0);
  const active = useRef(false);
  const accepting = useRef(false);
  const busy = useRef(false);
  const stopping = useRef(false);
  const mounted = useRef(true);
  const reportRef = useRef(report);
  reportRef.current = report;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(0);
  function clearTimers() {
    if (timer.current) clearInterval(timer.current);
    if (fallback.current) clearTimeout(fallback.current);
    timer.current = null;
    fallback.current = null;
  }
  function finish() {
    clearTimers();
    accepting.current = false;
    active.current = false;
    busy.current = false;
    stopping.current = false;
    draft.current = finishSpeech(draft.current);
    if (mounted.current) {
      setTranscript(speechText(draft.current));
      setRecording(false);
      setWorking(false);
    }
  }
  function stop(keep = true) {
    if (!keep) {
      request.current++;
      accepting.current = false;
      if (active.current) abortRecognition();
      draft.current = emptySpeechDraft();
      finish();
      return;
    }
    if (!active.current || stopping.current) return;
    stopping.current = true;
    setWorking(true);
    try {
      Recognition.stop();
    } catch {
      finish();
      return;
    }
    // Preserve the latest visible words even if an engine never emits its final event.
    fallback.current = setTimeout(() => {
      accepting.current = false;
      abortRecognition();
      finish();
    }, 2500);
  }
  function discard() {
    stop(false);
    setTranscript("");
    setSeconds(0);
  }
  function editTranscript(value: string) {
    if (active.current || busy.current) return;
    draft.current = { committed: value, partial: "" };
    setTranscript(value);
  }
  async function start(locale: string) {
    if (active.current || busy.current) return;
    const operation = ++request.current;
    busy.current = true;
    setWorking(true);
    Keyboard.dismiss();
    reportRef.current("");
    try {
      if (!Recognition.isRecognitionAvailable())
        throw new Error(
          "Speech recognition is unavailable. Enable your phone’s speech service, or use Type instead.",
        );
      const permission = await Recognition.requestPermissionsAsync();
      if (!mounted.current || request.current !== operation) return;
      if (!permission.granted)
        throw new Error(
          "Allow microphone and speech recognition in your phone’s app settings, or use Type instead.",
        );
      if (AppState.currentState !== "active") return;
      // iOS can report supported locales. Older Android recognizers may not implement this query.
      try {
        const { locales } = await Recognition.getSupportedLocales({});
        if (
          locales.length &&
          !locales.some(
            (value) =>
              value.toLowerCase().replace("_", "-").split("-")[0] ===
              locale.toLowerCase().split("-")[0],
          )
        ) {
          throw new Error("unsupported-locale");
        }
      } catch (error) {
        if (error instanceof Error && error.message === "unsupported-locale")
          throw new Error(
            "Your phone’s speech service does not support this language. You can still type or paste it for translation.",
          );
      }
      if (
        !mounted.current ||
        request.current !== operation ||
        AppState.currentState !== "active"
      )
        return;
      draft.current = emptySpeechDraft();
      setTranscript("");
      setSeconds(0);
      accepting.current = true;
      active.current = true;
      stopping.current = false;
      setRecording(true);
      Recognition.start({
        lang: locale,
        interimResults: true,
        maxAlternatives: 1,
        continuous: Platform.OS === "ios" || Number(Platform.Version) >= 33,
        addsPunctuation: true,
        recordingOptions: { persist: false },
        iosTaskHint: "dictation",
      });
      started.current = Date.now();
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - started.current) / 1000);
        setSeconds(Math.min(60, elapsed));
        if (elapsed >= 60) stop();
      }, 250);
    } catch (error) {
      if (request.current !== operation) return;
      accepting.current = false;
      if (active.current) abortRecognition();
      finish();
      reportRef.current(
        error instanceof Error
          ? error.message
          : "Could not start speech recognition. Try again or type your text.",
      );
    } finally {
      if (request.current === operation) {
        busy.current = false;
        if (mounted.current && !stopping.current) setWorking(false);
      }
    }
  }
  useEffect(() => {
    mounted.current = true;
    const subscriptions = [
      Recognition.addListener("start", () => {
        if (accepting.current) setRecording(true);
      }),
      Recognition.addListener("result", (event) => {
        if (!accepting.current) return;
        const words = event.results[0]?.transcript ?? "";
        draft.current = receiveSpeech(draft.current, words, event.isFinal);
        setTranscript(speechText(draft.current));
      }),
      Recognition.addListener("end", () => {
        if (active.current) finish();
      }),
      Recognition.addListener("error", (event) => {
        if (!accepting.current) return;
        const expectedStop =
          stopping.current &&
          (event.error === "aborted" || event.error === "client");
        finish();
        if (expectedStop || event.error === "aborted") return;
        const message =
          event.error === "language-not-supported"
            ? "This speech language is unavailable on your phone. Try installing its speech model, or type your text."
            : event.error === "not-allowed" ||
                event.error === "service-not-allowed"
              ? "Enable microphone access and your phone’s speech service in Settings, or use Type instead."
              : event.error === "no-speech"
                ? "No clear speech was detected. Try again or edit the text below."
                : event.error === "network"
                  ? "Speech recognition lost its connection. Your words are kept; edit them or try again."
                  : "Speech recognition stopped. Review the words below, or try again.";
        reportRef.current(message);
      }),
    ];
    const appState = AppState.addEventListener("change", (state) => {
      if (state !== "active" && active.current) {
        accepting.current = false;
        abortRecognition();
        finish();
      }
    });
    return () => {
      mounted.current = false;
      accepting.current = false;
      subscriptions.forEach((subscription) => subscription.remove());
      appState.remove();
      clearTimers();
      if (active.current) abortRecognition();
      active.current = false;
    };
  }, []);
  return {
    recording,
    working,
    transcript,
    editTranscript,
    start,
    stop,
    discard,
    seconds,
  };
}
