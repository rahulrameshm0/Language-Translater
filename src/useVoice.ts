import { useEffect, useRef, useState } from "react";
import { AppState, Keyboard } from "react-native";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import { File } from "expo-file-system";
export function useVoice(report: (message: string) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);
  const [recording, setRecording] = useState(false);
  const [working, setWorking] = useState(false);
  const [uri, setUri] = useState<string | null>(null);
  const active = useRef(false);
  const busy = useRef(false);
  const fileRef = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function discard() {
    if (fileRef.current) {
      try {
        const file = new File(fileRef.current);
        if (file.exists) file.delete();
      } catch {}
      fileRef.current = null;
    }
    setUri(null);
  }
  async function stop(keep = true) {
    if (!active.current || busy.current) return;
    busy.current = true;
    active.current = false;
    setWorking(true);
    if (timer.current) clearTimeout(timer.current);
    try {
      await recorder.stop();
      const next = recorder.uri;
      if (keep && next) {
        fileRef.current = next;
        setUri(next);
      } else if (next) {
        try {
          new File(next).delete();
        } catch {}
      }
    } catch {
      report("Could not finish recording. Try recording again.");
    } finally {
      setRecording(false);
      busy.current = false;
      setWorking(false);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  }
  async function start() {
    if (active.current || busy.current) return;
    busy.current = true;
    setWorking(true);
    Keyboard.dismiss();
    report("");
    discard();
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        report(
          "Microphone permission is needed. Enable it in your phone’s app settings to record.",
        );
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      active.current = true;
      setRecording(true);
      timer.current = setTimeout(() => void stop(), 30000);
    } catch {
      report(
        "Could not start recording. Check microphone access and try again.",
      );
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    } finally {
      busy.current = false;
      setWorking(false);
    }
  }
  async function payload() {
    if (!fileRef.current) throw new Error("Record something first.");
    const file = new File(fileRef.current);
    if (file.size > 2100000)
      throw new Error("This recording is too large. Try a shorter one.");
    return { audioBase64: await file.base64(), mimeType: "audio/mp4" };
  }
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active" && active.current) void stop(false);
    });
    return () => {
      subscription.remove();
      if (timer.current) clearTimeout(timer.current);
      if (active.current) {
        active.current = false;
        void recorder
          .stop()
          .then(() => {
            const path = recorder.uri;
            if (path) {
              try {
                const file = new File(path);
                if (file.exists) file.delete();
              } catch {}
            }
          })
          .catch(() => {});
      }
      if (fileRef.current) {
        try {
          new File(fileRef.current).delete();
        } catch {}
      }
    };
  }, [recorder]);
  return {
    recording,
    working,
    uri,
    start,
    stop,
    discard,
    payload,
    seconds: Math.min(30, Math.floor(state.durationMillis / 1000)),
  };
}
