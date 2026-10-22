import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import { supabase } from "./supabase";
import {
  docxText,
  mediaMime,
  validateDraft,
  MAX_IMPORT_BYTES,
  InputKind,
} from "./mediaFiles";
type SelectedFile = {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  kind: InputKind;
};
export function useMediaInput(report: (message: string) => void) {
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const status = useAudioRecorderState(recorder, 250);
  const current = useRef<SelectedFile | null>(null);
  const generation = useRef(0);
  const busy = useRef(false),
    active = useRef(false),
    mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportRef = useRef(report);
  reportRef.current = report;
  function remove(uri?: string) {
    if (uri?.startsWith(Paths.cache.uri)) {
      try {
        const f = new File(uri);
        if (f.exists) f.delete();
      } catch {}
    }
  }
  function clear() {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    if (active.current) {
      active.current = false;
      void recorder
        .stop()
        .then(() => remove(recorder.uri ?? undefined))
        .catch(() => {});
    }
    remove(current.current?.uri);
    current.current = null;
    if (mounted.current) {
      setFile(null);
      setDraft("");
      setRecording(false);
      setWorking(false);
    }
    busy.current = false;
  }
  async function adopt(next: SelectedFile, operation: number) {
    if (operation !== generation.current || !mounted.current) {
      remove(next.uri);
      return;
    }
    remove(current.current?.uri);
    current.current = next;
    setFile(next);
    setDraft("");
    let text = "";
    if (next.mimeType === "text/plain")
      text = validateDraft(await new File(next.uri).text());
    else if (next.mimeType.includes("wordprocessingml"))
      text = docxText(await new File(next.uri).bytes());
    if (operation === generation.current && mounted.current) setDraft(text);
  }
  async function pick(kind: "document" | "recording" | "call") {
    if (busy.current || active.current) return;
    busy.current = true;
    setWorking(true);
    reportRef.current("");
    const operation = ++generation.current;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type:
          kind === "document"
            ? [
                "application/pdf",
                "text/plain",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              ]
            : ["audio/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const local = new File(asset.uri);
      if (local.size > MAX_IMPORT_BYTES) {
        remove(asset.uri);
        throw new Error("Choose a file smaller than 8 MB.");
      }
      let mimeType: string;
      try {
        mimeType = mediaMime(asset.name, kind);
      } catch (e) {
        remove(asset.uri);
        throw e;
      }
      await adopt(
        {
          uri: asset.uri,
          name: asset.name.replace(/[\x00-\x1f]/g, " ").slice(0, 180),
          size: local.size,
          mimeType,
          kind,
        },
        operation,
      );
    } catch (error) {
      if (operation === generation.current)
        reportRef.current(
          error instanceof Error
            ? error.message
            : "Could not open this file. Try another file.",
        );
    } finally {
      if (operation === generation.current && mounted.current) {
        busy.current = false;
        setWorking(false);
      }
    }
  }
  async function stop() {
    if (!active.current) return;
    active.current = false;
    busy.current = true;
    setWorking(true);
    const operation = generation.current;
    if (timer.current) clearTimeout(timer.current);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        const f = new File(uri);
        await adopt(
          {
            uri,
            name: "Voice recording.m4a",
            size: f.size,
            mimeType: "audio/mp4",
            kind: "recording",
          },
          operation,
        );
      }
    } catch {
      if (operation === generation.current)
        reportRef.current("Could not finish recording. Please try again.");
    } finally {
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (operation === generation.current && mounted.current) {
        setRecording(false);
        setWorking(false);
        busy.current = false;
      }
    }
  }
  async function start() {
    if (busy.current || active.current) return;
    busy.current = true;
    setWorking(true);
    reportRef.current("");
    const operation = ++generation.current;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          "Allow microphone access in Settings to record, or import an audio file.",
        );
      if (
        operation !== generation.current ||
        !mounted.current ||
        AppState.currentState !== "active"
      )
        return;
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      if (
        operation !== generation.current ||
        !mounted.current ||
        AppState.currentState !== "active"
      ) {
        await recorder.stop().catch(() => {});
        remove(recorder.uri ?? undefined);
        return;
      }
      remove(current.current?.uri);
      current.current = null;
      setFile(null);
      setDraft("");
      recorder.record();
      active.current = true;
      setRecording(true);
      timer.current = setTimeout(() => void stop(), 60000);
    } catch (error) {
      if (operation === generation.current)
        reportRef.current(
          error instanceof Error ? error.message : "Could not start recording.",
        );
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    } finally {
      if (operation === generation.current && mounted.current) {
        busy.current = false;
        setWorking(false);
      }
    }
  }
  async function extract(sourceLanguage: string) {
    if (!current.current || busy.current || active.current) return;
    busy.current = true;
    setWorking(true);
    reportRef.current("");
    const operation = generation.current;
    try {
      const next = current.current;
      const local = new File(next.uri);
      if (local.size > MAX_IMPORT_BYTES)
        throw new Error("Choose a file smaller than 8 MB.");
      if (
        next.mimeType === "text/plain" ||
        next.mimeType.includes("wordprocessingml")
      ) {
        const text =
          next.mimeType === "text/plain"
            ? validateDraft(await local.text())
            : docxText(await local.bytes());
        if (operation === generation.current && mounted.current) setDraft(text);
        return;
      }
      const { data, error } = await supabase.functions.invoke("translate", {
        body: {
          action: "extract",
          kind: next.kind,
          sourceLanguage,
          mimeType: next.mimeType,
          fileBase64: await local.base64(),
        },
      });
      if (error) {
        let message =
          "File processing failed. Check your connection and try again.";
        if (error.context instanceof Response) {
          const body = await error.context.json().catch(() => null);
          message = body?.error ?? message;
        }
        throw new Error(message);
      }
      if (typeof data?.originalText !== "string")
        throw new Error("No text received. Try again.");
      if (operation === generation.current && mounted.current)
        setDraft(validateDraft(data.originalText));
    } catch (error) {
      if (operation === generation.current)
        reportRef.current(
          error instanceof Error
            ? error.message
            : "Could not process this file.",
        );
    } finally {
      if (operation === generation.current && mounted.current) {
        busy.current = false;
        setWorking(false);
      }
    }
  }
  useEffect(() => {
    mounted.current = true;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && active.current) void stop();
    });
    return () => {
      mounted.current = false;
      sub.remove();
      clear();
    };
  }, [recorder]);
  return {
    file,
    draft,
    setDraft,
    working,
    recording,
    pick,
    start,
    stop,
    extract,
    clear,
    seconds: Math.min(60, Math.floor(status.durationMillis / 1000)),
  };
}
