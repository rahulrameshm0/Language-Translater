import React, { useEffect, useRef, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import * as Speech from "expo-speech";
import { Language, languages } from "./languages";
import {
  SpeakingLevel,
  Scenario,
  practicePhrases,
  comparePhrase,
} from "./practice";
import { translatePhrase } from "./translationService";
import { deviceVoices, playSpeech, stopSpeech } from "./deviceSpeech";
import { useVoice } from "./useVoice";
import { supabase } from "./supabase";
import { useTheme } from "./theme";
import {
  StudioButton,
  StudioCard,
  StudioText,
  StudioInput,
  IconPlate,
  StudioIcon,
} from "./StudioUI";
const levels: {
  id: SpeakingLevel;
  title: string;
  detail: string;
  icon: StudioIcon;
}[] = [
  {
    id: "beginner",
    title: "Just getting started",
    detail: "Short, useful sentences",
    icon: "chatbubble-outline",
  },
  {
    id: "growing",
    title: "Building confidence",
    detail: "Everyday questions and answers",
    icon: "chatbubbles-outline",
  },
  {
    id: "confident",
    title: "Ready for more",
    detail: "Longer phrases and conversations",
    icon: "mic-outline",
  },
];
const scenarios: {
  id: Scenario;
  title: string;
  detail: string;
  icon: StudioIcon;
  color: string;
}[] = [
  {
    id: "social",
    title: "Social",
    detail: "Meet people and make friends",
    icon: "people-outline",
    color: "#B297FF",
  },
  {
    id: "work",
    title: "Work",
    detail: "Meetings and everyday work",
    icon: "laptop-outline",
    color: "#67C9F2",
  },
  {
    id: "study",
    title: "Study",
    detail: "Classes and study groups",
    icon: "school-outline",
    color: "#B297FF",
  },
  {
    id: "travel",
    title: "Travel",
    detail: "Transport and reservations",
    icon: "airplane-outline",
    color: "#6BD6B1",
  },
];
export function SpeakingScreen({
  userId,
  source,
  target,
  onPick,
  onBusy,
  report,
  onSave,
}: {
  userId: string;
  source: Language;
  target: Language;
  onPick: (side: "source" | "target") => void;
  onBusy: (busy: boolean) => void;
  report: (message: string) => void;
  onSave: (source: string, target: string, sourceLanguage: Language) => void;
}) {
  const { colors: c } = useTheme();
  const [step, setStep] = useState(0),
    [level, setLevel] = useState<SpeakingLevel>("beginner"),
    [scenario, setScenario] = useState<Scenario>("social"),
    [index, setIndex] = useState(0),
    [voices, setVoices] = useState<Speech.Voice[]>([]),
    [selectedVoice, setSelectedVoice] = useState<string>(),
    [prompt, setPrompt] = useState(""),
    [hint, setHint] = useState(""),
    [hintLanguage, setHintLanguage] = useState<Language>("en"),
    [busy, setBusy] = useState(false),
    [playing, setPlaying] = useState(false),
    [score, setScore] = useState<{ matched: number; total: number } | null>(
      null,
    ),
    [attempts, setAttempts] = useState(0);
  const voice = useVoice(report),
    alive = useRef(true),
    request = useRef(0),
    saving = useRef(false);
  const [attemptSaved, setAttemptSaved] = useState(false);
  const locked = busy || playing || voice.recording || voice.working;
  useEffect(() => {
    onBusy(locked);
    return () => onBusy(false);
  }, [locked]);
  useEffect(() => {
    let active = true;
    void deviceVoices(target)
      .then((items) => {
        if (active) {
          setVoices(items);
          setSelectedVoice(items[0]?.identifier);
        }
      })
      .catch(() => {
        if (active) setVoices([]);
      });
    return () => {
      active = false;
    };
  }, [target]);
  useEffect(() => {
    request.current++;
    voice.discard();
    setPrompt("");
    setHint("");
    setScore(null);
    setAttemptSaved(false);
  }, [source, target, level, scenario]);
  useEffect(() => {
    void stopSpeech();
    setPlaying(false);
  }, [step]);
  useEffect(() => {
    alive.current = true;
    void supabase
      .from("speaking_attempts")
      .select("id", { count: "exact", head: true })
      .then(({ count, error }) => {
        if (alive.current && !error) setAttempts(count ?? 0);
      });
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
  }, [userId]);
  async function play(text: string, voiceId?: string) {
    try {
      setPlaying(true);
      await playSpeech(
        text,
        target,
        voiceId ?? selectedVoice,
        () => {
          if (alive.current) setPlaying(false);
        },
        report,
      );
    } catch (error) {
      setPlaying(false);
      report(
        error instanceof Error ? error.message : "Could not play this voice.",
      );
    }
  }
  async function prepare(next = index) {
    if (busy) return;
    setBusy(true);
    setScore(null);
    setAttemptSaved(false);
    voice.discard();
    setPrompt("");
    const token = ++request.current;
    try {
      const english = practicePhrases[scenario][level][next];
      const translated = await translatePhrase(
        english,
        "en",
        target,
        "Speaking practice",
      );
      if (!alive.current || request.current !== token) return;
      if (Array.from(translated.translatedText).length > 500)
        throw new Error(
          "This practice phrase is too long. Try another scenario.",
        );
      setPrompt(translated.translatedText);
      setHint(english);
      setHintLanguage("en");
      if (translated.warning) report(translated.warning);
      if (source !== "en") {
        try {
          const native = await translatePhrase(
            english,
            "en",
            source,
            "Speaking practice meaning",
          );
          if (alive.current && request.current === token) {
            setHint(native.translatedText);
            setHintLanguage(source);
          }
        } catch {
          if (alive.current)
            report(
              "The practice phrase is ready. Its meaning is shown in English because the translation could not be loaded.",
            );
        }
      }
    } catch (error) {
      if (alive.current)
        report(
          error instanceof Error
            ? error.message
            : "Could not prepare a phrase. Try again.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function check() {
    if (locked || saving.current || !voice.transcript.trim()) return;
    saving.current = true;
    setBusy(true);
    try {
      if (Array.from(voice.transcript).length > 1000)
        throw new Error("Try a shorter response of up to 1,000 characters.");
      const result = comparePhrase(prompt, voice.transcript, target);
      setScore(result);
      const { error } = await supabase.from("speaking_attempts").insert({
        user_id: userId,
        target_language: target,
        prompt_text: prompt,
        heard_text: voice.transcript,
        matched_words: result.matched,
        total_words: result.total,
      });
      if (error)
        throw new Error(
          "Your word feedback is ready, but this attempt could not be saved. Your transcript is kept.",
        );
      if (alive.current) {
        setAttempts((value) => value + 1);
        setAttemptSaved(true);
      }
    } catch (error) {
      if (alive.current)
        report(
          error instanceof Error
            ? error.message
            : "Could not check this attempt.",
        );
    } finally {
      saving.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function choice(
    title: string,
    detail: string,
    selected: boolean,
    onPress: () => void,
    icon: StudioIcon = "person-outline",
    color = "#77AEFF",
  ) {
    return (
      <Pressable
        key={title}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        disabled={locked}
        onPress={onPress}
        style={{
          backgroundColor: c.surface,
          borderRadius: 20,
          padding: 18,
          borderWidth: 1,
          borderColor: selected ? c.ink : "transparent",
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
        }}
      >
        <IconPlate icon={icon} color={color} />
        <View style={{ flex: 1, gap: 4 }}>
          <StudioText title>{title}</StudioText>
          <StudioText muted>{detail}</StudioText>
        </View>
      </Pressable>
    );
  }
  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {step > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous speaking step"
            disabled={locked}
            onPress={() => setStep((value) => value - 1)}
          >
            <Text style={{ fontSize: 28, color: c.ink, paddingRight: 8 }}>
              ‹
            </Text>
          </Pressable>
        )}
        <StudioText title>Speaking practice</StudioText>
      </View>
      <View style={{ flexDirection: "row", gap: 5 }}>
        {[0, 1, 2, 3, 4].map((value) => (
          <View
            key={value}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: value <= step ? c.accent : c.line,
            }}
          />
        ))}
      </View>
      {step === 0 ? (
        <>
          <StudioText title>Choose your languages</StudioText>
          <StudioText muted>
            Practice useful phrases across 30 languages. Speech availability
            depends on your phone’s installed services.
          </StudioText>
          <StudioCard>
            <StudioText muted>My language</StudioText>
            <StudioButton
              title={languages[source].name}
              secondary
              onPress={() => onPick("source")}
            />
            <StudioText muted>Practice language</StudioText>
            <StudioButton
              title={languages[target].name}
              secondary
              onPress={() => onPick("target")}
            />
          </StudioCard>
          <StudioButton title="Continue" onPress={() => setStep(1)} />
        </>
      ) : step === 1 ? (
        <>
          <StudioText title>Your current speaking level</StudioText>
          {levels.map((item) =>
            choice(
              item.title,
              item.detail,
              level === item.id,
              () => {
                setLevel(item.id);
                setIndex(0);
              },
              item.icon,
            ),
          )}
          <StudioButton title="Continue" onPress={() => setStep(2)} />
        </>
      ) : step === 2 ? (
        <>
          <StudioText title>Choose a scenario to practice</StudioText>
          {scenarios.map((item) =>
            choice(
              item.title,
              item.detail,
              scenario === item.id,
              () => {
                setScenario(item.id);
                setIndex(0);
              },
              item.icon,
              item.color,
            ),
          )}
          <StudioButton title="Continue" onPress={() => setStep(3)} />
        </>
      ) : step === 3 ? (
        <>
          <StudioText title>Choose a practice voice</StudioText>
          <StudioText muted>
            These are the {languages[target].name} voices installed on this
            device.
          </StudioText>
          {!voices.length && (
            <StudioCard>
              <StudioText>
                No matching voice is installed. You can continue with text and
                speech recognition, or install a voice in your phone’s speech
                settings.
              </StudioText>
            </StudioCard>
          )}
          {voices.map((item) => (
            <View key={item.identifier} style={{ gap: 8 }}>
              {choice(
                item.name,
                item.language,
                selectedVoice === item.identifier,
                () => {
                  void stopSpeech();
                  setPlaying(false);
                  setSelectedVoice(item.identifier);
                },
                "volume-high-outline",
                "#B297FF",
              )}
              <StudioButton
                title={
                  playing && selectedVoice === item.identifier
                    ? "Stop preview"
                    : `Preview ${item.name}`
                }
                secondary
                onPress={() => {
                  if (playing) {
                    void stopSpeech();
                    setPlaying(false);
                  } else {
                    setSelectedVoice(item.identifier);
                    void play(languages[target].native, item.identifier);
                  }
                }}
              />
            </View>
          ))}
          <StudioButton
            title="Start practice"
            disabled={locked}
            onPress={() => {
              setStep(4);
              void prepare();
            }}
          />
        </>
      ) : (
        <>
          <StudioText muted>
            {scenarios.find((item) => item.id === scenario)?.title} · Phrase{" "}
            {index + 1} of {practicePhrases[scenario][level].length} ·{" "}
            {attempts} saved attempts
          </StudioText>
          <StudioCard>
            <StudioText title>
              {busy && !prompt
                ? "Preparing your phrase…"
                : prompt || "Choose Retry to prepare a practice phrase."}
            </StudioText>
            {!!hint && <StudioText muted>{hint}</StudioText>}
            {prompt ? (
              <StudioButton
                title={playing ? "Stop audio" : "Listen to the phrase"}
                secondary
                disabled={
                  busy || voice.recording || voice.working || !voices.length
                }
                icon="volume-high-outline"
                onPress={() => {
                  if (playing) {
                    void stopSpeech();
                    setPlaying(false);
                  } else void play(prompt);
                }}
              />
            ) : (
              <StudioButton
                title="Retry"
                disabled={busy}
                onPress={() => void prepare()}
              />
            )}
          </StudioCard>
          {!!prompt && (
            <StudioCard>
              <StudioText title>
                {voice.recording ? "Listening…" : "Your turn"}
              </StudioText>
              <StudioInput
                label="Your spoken phrase"
                value={voice.transcript}
                editable={!locked}
                onChangeText={(value) => {
                  voice.editTranscript(value);
                  setScore(null);
                  setAttemptSaved(false);
                }}
              />
              <StudioButton
                title={voice.recording ? "Stop and review" : "Try speaking"}
                disabled={busy || playing || voice.working}
                icon="mic-outline"
                onPress={() => {
                  setScore(null);
                  setAttemptSaved(false);
                  if (voice.recording) voice.stop();
                  else
                    void stopSpeech().then(() =>
                      voice.start(languages[target].locale),
                    );
                }}
              />
              <StudioButton
                title={
                  busy
                    ? "Saving…"
                    : score && !attemptSaved
                      ? "Retry saving attempt"
                      : "Check my words"
                }
                disabled={
                  locked ||
                  !voice.transcript.trim() ||
                  (!!score && attemptSaved)
                }
                onPress={() => void check()}
              />
            </StudioCard>
          )}
          {!!score && (
            <StudioCard>
              <StudioText title>
                {score.matched} of {score.total}{" "}
                {target === "zh" || target === "ja" ? "characters" : "words"}{" "}
                matched
              </StudioText>
              <StudioText muted>
                Feedback uses the words your phone recognized. Compare your
                transcript with the phrase and try again if needed.
              </StudioText>
              <StudioButton
                title="Save phrase to learning"
                disabled={hintLanguage === target}
                secondary
                onPress={() => onSave(hint, prompt, hintLanguage)}
              />
            </StudioCard>
          )}
          <StudioButton
            title={
              index === practicePhrases[scenario][level].length - 1
                ? "Practice these phrases again"
                : "Next phrase"
            }
            disabled={locked}
            onPress={() => {
              const next =
                (index + 1) % practicePhrases[scenario][level].length;
              setIndex(next);
              void prepare(next);
            }}
          />
        </>
      )}
    </View>
  );
}
