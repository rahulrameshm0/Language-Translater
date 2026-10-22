import React, { useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { Language, languages } from "./languages";
import { useVoice } from "./useVoice";
import { translatePhrase } from "./translationService";
import { playSpeech, stopSpeech } from "./deviceSpeech";
import {
  StudioButton,
  StudioCard,
  StudioText,
  StudioInput,
  IconPlate,
} from "./StudioUI";
export function EarphoneScreen({
  source,
  target,
  onPick,
  onSwap,
  onBusy,
  report,
  onSave,
}: {
  source: Language;
  target: Language;
  onPick: (side: "source" | "target") => void;
  onSwap: () => void;
  onBusy: (busy: boolean) => void;
  report: (message: string) => void;
  onSave: (source: string, target: string) => void;
}) {
  const voice = useVoice(report);
  const [result, setResult] = useState(""),
    [busy, setBusy] = useState(false),
    [playing, setPlaying] = useState(false);
  const alive = useRef(true),
    request = useRef(0);
  const locked = voice.recording || voice.working || busy || playing;
  useEffect(() => {
    onBusy(locked);
    return () => onBusy(false);
  }, [locked]);
  useEffect(() => {
    request.current++;
    voice.discard();
    setResult("");
    void stopSpeech();
    setPlaying(false);
  }, [source, target]);
  useEffect(() => {
    alive.current = true;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        void stopSpeech();
        setPlaying(false);
      }
    });
    return () => {
      alive.current = false;
      request.current++;
      sub.remove();
      void stopSpeech();
    };
  }, []);
  async function listen() {
    try {
      setPlaying(true);
      await playSpeech(
        result,
        target,
        undefined,
        () => {
          if (alive.current) setPlaying(false);
        },
        report,
      );
    } catch (error) {
      setPlaying(false);
      report(
        error instanceof Error ? error.message : "Could not play translation.",
      );
    }
  }
  async function translate() {
    if (locked || !voice.transcript.trim()) return;
    setBusy(true);
    const token = ++request.current;
    try {
      const output = await translatePhrase(
        voice.transcript,
        source,
        target,
        "Earphone translation",
      );
      if (!alive.current || token !== request.current) return;
      setResult(output.translatedText);
      if (output.warning) report(output.warning);
      setPlaying(true);
      try {
        await playSpeech(
          output.translatedText,
          target,
          undefined,
          () => {
            if (alive.current) setPlaying(false);
          },
          report,
        );
      } catch (error) {
        setPlaying(false);
        report(
          error instanceof Error
            ? error.message
            : "Translation is ready. Audio playback is unavailable.",
        );
      }
    } catch (error) {
      if (alive.current)
        report(
          error instanceof Error
            ? error.message
            : "Translation failed. Your transcript is kept.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <View style={{ gap: 20 }}>
      <StudioText title>Earphone translation</StudioText>
      <StudioCard>
        <IconPlate icon="headset-outline" />
        <StudioText title>Listen in another language</StudioText>
        <StudioText muted>
          Connect your earphones and select them in your phone’s audio output
          controls. Each confirmed speaking turn is translated and played
          through the selected output.
        </StudioText>
        <StudioText muted>
          Audio output is controlled by your phone. This mode does not listen in
          the background.
        </StudioText>
      </StudioCard>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <StudioButton
            title={languages[source].name}
            secondary
            disabled={locked}
            onPress={() => onPick("source")}
          />
        </View>
        <StudioButton
          title="Swap"
          secondary
          disabled={locked}
          onPress={onSwap}
        />
        <View style={{ flex: 1 }}>
          <StudioButton
            title={languages[target].name}
            secondary
            disabled={locked}
            onPress={() => onPick("target")}
          />
        </View>
      </View>
      <StudioCard>
        <StudioText title>
          {voice.recording ? "Listening…" : "Your speaking turn"}
        </StudioText>
        <StudioInput
          label="Earphone transcript"
          value={voice.transcript}
          editable={!locked}
          onChangeText={(value) => {
            voice.editTranscript(value);
            setResult("");
          }}
        />
        <StudioText muted>
          {voice.recording
            ? `${voice.seconds}s / 60s`
            : "Review or edit the words before translating."}
        </StudioText>
        <StudioButton
          title={
            voice.recording
              ? "Stop and review"
              : voice.transcript
                ? "Record a new turn"
                : "Start listening"
          }
          disabled={busy || voice.working || playing}
          icon={voice.recording ? "stop" : "mic-outline"}
          onPress={() => {
            if (voice.recording) voice.stop();
            else {
              setResult("");
              void stopSpeech().then(() =>
                voice.start(languages[source].locale),
              );
            }
          }}
        />
        <StudioButton
          title={busy ? "Translating…" : "Confirm, translate & play"}
          disabled={
            locked ||
            !voice.transcript.trim() ||
            Array.from(voice.transcript).length > 5000
          }
          onPress={() => void translate()}
        />
      </StudioCard>
      {!!result && (
        <StudioCard>
          <StudioText muted>{languages[target].name}</StudioText>
          <StudioText title>{result}</StudioText>
          <StudioButton
            title={playing ? "Stop playback" : "Play again"}
            secondary
            disabled={busy}
            onPress={() => {
              if (playing) {
                void stopSpeech();
                setPlaying(false);
              } else void listen();
            }}
          />
          <StudioButton
            title="Save phrase to learning"
            secondary
            onPress={() => onSave(voice.transcript, result)}
            disabled={locked}
          />
        </StudioCard>
      )}
    </View>
  );
}
