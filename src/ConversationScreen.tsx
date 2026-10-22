import React, { useEffect, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, Text, View } from "react-native";
import { File, Paths } from "expo-file-system";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from "expo-audio";
import { supabase } from "./supabase";
import { Language, languages, isRtlLanguage } from "./languages";
import { useTheme } from "./theme";
import {
  StudioButton,
  StudioCard,
  StudioText,
  StudioInput,
  IconPlate,
} from "./StudioUI";
import { topicGroups, ChatMessage } from "./conversationTopics";
import { askAssistant } from "./assistantService";
import { useMediaInput } from "./useMediaInput";
import { playSpeech, stopSpeech, deviceVoices } from "./deviceSpeech";
type Props = {
  onAdvance: () => void;
  mode: "assistant" | "speaking";
  userId: string;
  source: Language;
  target: Language;
  onPick: (side: "source" | "target") => void;
  onBusy: (busy: boolean) => void;
  report: (message: string) => void;
};
type Saved = {
  id: string;
  title: string;
  source_language: Language;
  target_language: Language;
  messages: ChatMessage[];
};
function RecordedReply({
  uri,
  disabled,
  onPlaying,
  report,
}: {
  uri: string;
  disabled: boolean;
  onPlaying: (playing: boolean) => void;
  report: (message: string) => void;
}) {
  const player = useAudioPlayer(uri),
    status = useAudioPlayerStatus(player);
  useEffect(() => {
    onPlaying(status.playing);
    return () => onPlaying(false);
  }, [status.playing]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") player.pause();
    });
    return () => {
      sub.remove();
      player.pause();
    };
  }, [player]);
  return (
    <StudioButton
      secondary
      title={status.playing ? "Pause your recording" : "Play your recording"}
      disabled={disabled && !status.playing}
      icon={status.playing ? "pause" : "play"}
      onPress={() => {
        if (status.playing) player.pause();
        else
          void (async () => {
            try {
              await stopSpeech();
              await setAudioModeAsync({
                allowsRecording: false,
                playsInSilentMode: true,
              });
              if (status.didJustFinish) await player.seekTo(0);
              player.play();
            } catch {
              report("Could not play this recording. Try the transcript.");
            }
          })();
      }}
    />
  );
}
export function ConversationScreen(p: Props) {
  const { colors: c } = useTheme(),
    speaking = p.mode === "speaking";
  const [group, setGroup] = useState<keyof typeof topicGroups>("Social"),
    [topic, setTopic] = useState("First meeting"),
    [level, setLevel] = useState("beginner");
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [playing, setPlaying] = useState(false),
    [clipPlaying, setClipPlaying] = useState(false),
    [history, setHistory] = useState<Saved[]>([]),
    [showHistory, setShowHistory] = useState(false),
    [sessionId, setSessionId] = useState<string | null>(null),
    [saveFailed, setSaveFailed] = useState(false),
    [voiceId, setVoiceId] = useState<string>(),
    [voices, setVoices] = useState<{ identifier: string; name: string }[]>([]);
  const [chatSource, setChatSource] = useState(p.source),
    [chatTarget, setChatTarget] = useState(speaking ? p.source : p.target);
  const media = useMediaInput(p.report),
    alive = useRef(true),
    pending = useRef(false),
    clips = useRef<string[]>([]);
  useEffect(() => {
    if (media.draft) setDraft(media.draft);
  }, [media.draft]);
  const locked =
    busy || playing || clipPlaying || media.recording || media.working;
  useEffect(() => {
    p.onBusy(locked);
    return () => p.onBusy(false);
  }, [locked]);
  useEffect(() => {
    alive.current = true;
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") {
        void stopSpeech();
        setPlaying(false);
      }
    });
    return () => {
      alive.current = false;
      sub.remove();
      void stopSpeech();
      for (const uri of clips.current) {
        try {
          new File(uri).delete();
        } catch {}
      }
    };
  }, []);
  useEffect(() => {
    if (!messages.length) {
      setChatSource(p.source);
      setChatTarget(speaking ? p.source : p.target);
    }
  }, [p.source, p.target]);
  useEffect(() => {
    let current = true;
    deviceVoices(chatTarget)
      .then((v) => {
        if (current) {
          setVoices(v);
          setVoiceId(v[0]?.identifier);
        }
      })
      .catch(() => {
        if (current) setVoices([]);
      });
    return () => {
      current = false;
    };
  }, [chatTarget]);
  async function loadHistory() {
    try {
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("id,title,source_language,target_language,messages")
        .eq("user_id", p.userId)
        .eq("mode", p.mode)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      if (alive.current) setHistory(data ?? []);
    } catch {
      p.report("Could not load saved conversations. Try again.");
    }
  }
  async function save(next: ChatMessage[], id = sessionId) {
    const payload = {
      user_id: p.userId,
      mode: p.mode,
      title: speaking
        ? topic
        : next.find((m) => m.role === "user")?.text.slice(0, 80) ||
          "Language assistant",
      source_language: chatSource,
      target_language: chatTarget,
      messages: next.map(({ audioUri, ...m }) => m),
      updated_at: new Date().toISOString(),
    };
    const query = id
      ? supabase
          .from("ai_conversations")
          .update(payload)
          .eq("id", id)
          .eq("user_id", p.userId)
      : supabase.from("ai_conversations").insert(payload);
    const { data, error } = await query.select("id").single();
    if (!alive.current) return;
    if (error) {
      setSaveFailed(true);
      p.report(
        "Answer is ready, but the conversation was not saved. Use Retry save.",
      );
      return;
    }
    setSessionId(data.id);
    setSaveFailed(false);
  }
  async function speak(text: string, language = chatTarget) {
    try {
      setPlaying(true);
      await playSpeech(
        text,
        language,
        voiceId,
        () => {
          if (alive.current) setPlaying(false);
        },
        p.report,
      );
    } catch (e) {
      setPlaying(false);
      p.report(e instanceof Error ? e.message : "Could not play the reply.");
    }
  }
  async function send(opening = false) {
    if (pending.current || locked || (!opening && !draft.trim())) return;
    pending.current = true;
    setBusy(true);
    p.report("");
    try {
      let audioBase64: string | undefined, audioUri: string | undefined;
      if (!opening && media.file) {
        const file = new File(media.file.uri);
        if (file.size > 2100000)
          throw new Error(
            "Record a shorter reply (under 2 MB) or discard the audio and send the text.",
          );
        audioBase64 = await file.base64();
        const copy = new File(
          Paths.cache,
          `lingobridge-chat-${Date.now()}.m4a`,
        );
        file.copy(copy);
        audioUri = copy.uri;
        clips.current.push(copy.uri);
      }
      const next: ChatMessage[] = opening
        ? []
        : [
            ...messages,
            {
              role: "user",
              text: draft.trim(),
              ...(audioUri ? { audioUri } : {}),
            },
          ];
      // Assistant conversations begin with a visible greeting so alternating roles remain bounded.
      const output = await askAssistant(
        p.mode,
        chatSource,
        chatTarget,
        topic,
        level,
        next,
        audioBase64,
      );
      if (!alive.current) return;
      if (!opening && next.length) {
        next[next.length - 1] = {
          ...next[next.length - 1],
          feedback: output.feedback,
          correction: output.correction,
        };
      }
      const completed: ChatMessage[] = [
        ...next,
        { role: "model", text: output.reply },
      ];
      setMessages(completed);
      setDraft("");
      media.clear();
      await save(completed);
      if (speaking && alive.current) await speak(output.reply);
    } catch (e) {
      if (alive.current)
        p.report(
          e instanceof Error
            ? e.message
            : "Could not send. Your reply is kept.",
        );
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function newChat() {
    void stopSpeech();
    media.clear();
    setMessages([]);
    setDraft("");
    setSessionId(null);
    setSaveFailed(false);
    setShowHistory(false);
    setChatSource(p.source);
    setChatTarget(speaking ? p.source : p.target);
  }
  const assistantGreeting: ChatMessage = {
    role: "model",
    text: "Hi! I can help you translate, understand words, improve writing and summarize text you share. What would you like to try?",
  };
  const displayed = messages.length
    ? messages
    : !speaking
      ? [assistantGreeting]
      : [];
  async function sendAssistant() {
    if (!messages.length) {
      // The greeting is context, not a fabricated model response to a user request.
      if (pending.current || locked || !draft.trim()) return;
      pending.current = true;
      setBusy(true);
      try {
        const output = await askAssistant(
          "assistant",
          chatSource,
          chatTarget,
          "Language help",
          level,
          [assistantGreeting, { role: "user", text: draft.trim() }],
        );
        if (!alive.current) return;
        const next: ChatMessage[] = [
          assistantGreeting,
          { role: "user", text: draft.trim() },
          { role: "model", text: output.reply },
        ];
        setMessages(next);
        setDraft("");
        await save(next);
      } catch (e) {
        p.report(e instanceof Error ? e.message : "Could not send. Try again.");
      } finally {
        pending.current = false;
        if (alive.current) setBusy(false);
      }
    } else await send();
  }
  return (
    <View style={{ gap: 20 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <StudioText title>
          {speaking ? "Speak with AI" : "Assistant"}
        </StudioText>
        <Pressable
          accessibilityRole="button"
          disabled={locked}
          onPress={() => {
            setShowHistory(!showHistory);
            if (!showHistory) void loadHistory();
          }}
        >
          <Text style={{ color: c.accent, padding: 10 }}>History</Text>
        </Pressable>
      </View>
      {showHistory ? (
        <>
          <StudioText muted>
            Your latest 20 saved conversations. Recordings stay on this device
            during the current session; saved chats contain text and feedback.
          </StudioText>
          {history.length === 0 && (
            <StudioText muted>No saved conversations yet.</StudioText>
          )}
          {history.map((item) => (
            <StudioButton
              key={item.id}
              secondary
              title={item.title}
              disabled={locked}
              onPress={() => {
                if (!Array.isArray(item.messages)) {
                  p.report("This conversation could not be opened.");
                  return;
                }
                media.clear();
                setMessages(item.messages);
                setSessionId(item.id);
                setTopic(item.title);
                setChatSource(item.source_language);
                setChatTarget(item.target_language);
                setDraft("");
                setShowHistory(false);
                setSaveFailed(false);
              }}
            />
          ))}
          <StudioButton title="New conversation" onPress={newChat} />
        </>
      ) : speaking && !messages.length ? (
        <>
          <StudioCard>
            <IconPlate icon="chatbubbles" />
            <StudioText title>Your next conversation starts here</StudioText>
            <StudioText muted>
              Listen, reply in your own words, then get feedback and a follow-up
              question. All topics are available.
            </StudioText>
            <StudioText muted>Conversation language</StudioText>
            <StudioButton
              secondary
              title={languages[p.source].name}
              onPress={() => p.onPick("source")}
              disabled={locked}
            />
            <StudioText muted>
              You and the AI speak this language. Feedback helps you improve it.
            </StudioText>
          </StudioCard>
          <StudioText muted>Your speaking level</StudioText>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {(["beginner", "growing", "confident"] as const).map((v, i) => (
              <StudioButton
                key={v}
                title={["Beginner", "Growing", "Confident"][i]}
                secondary={level !== v}
                disabled={locked}
                onPress={() => setLevel(v)}
              />
            ))}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {Object.keys(topicGroups).map((g) => (
              <StudioButton
                key={g}
                title={g === "Study" ? "Study abroad" : g}
                secondary={group !== g}
                disabled={locked}
                onPress={() => {
                  setGroup(g as keyof typeof topicGroups);
                  setTopic(topicGroups[g as keyof typeof topicGroups][0]);
                }}
              />
            ))}
          </ScrollView>
          <StudioText title>Choose a topic</StudioText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {topicGroups[group].map((t, i) => (
              <Pressable
                key={t}
                accessibilityRole="radio"
                accessibilityState={{ selected: topic === t }}
                disabled={locked}
                onPress={() => setTopic(t)}
                style={{
                  width: "48%",
                  minHeight: 125,
                  padding: 16,
                  borderRadius: 20,
                  backgroundColor: c.surface,
                  borderWidth: 1,
                  borderColor: topic === t ? c.accent : c.surface,
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <Text style={{ fontSize: 25 }}>
                  {["👋", "💬", "✨", "🌍", "☕", "📖", "🤝", "💡"][i]}
                </Text>
                <Text
                  style={{
                    color: c.ink,
                    fontFamily: "Outfit_500Medium",
                    fontSize: 16,
                  }}
                >
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>
          <StudioText muted>
            Speak in {languages[p.source].name}; the AI replies and explains
            feedback in the same language. Voice availability depends on your
            phone.
          </StudioText>
          {!!voices.length && (
            <>
              <StudioText muted>Partner voice</StudioText>
              <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
                {voices.map((v) => (
                  <StudioButton
                    key={v.identifier}
                    secondary={voiceId !== v.identifier}
                    title={v.name}
                    disabled={locked}
                    onPress={() => setVoiceId(v.identifier)}
                  />
                ))}
              </ScrollView>
            </>
          )}
          <StudioButton
            title={busy ? "Preparing your conversation…" : `Start · ${topic}`}
            disabled={locked}
            onPress={() => void send(true)}
          />
        </>
      ) : (
        <>
          {speaking && (
            <StudioText muted>
              {topic} · {languages[chatTarget].name}
            </StudioText>
          )}
          {!speaking && !messages.length && (
            <View style={{ gap: 8 }}>
              {[
                "Translate “hello” into five languages",
                "Explain a word with examples",
                "Help me improve this sentence",
              ].map((s) => (
                <StudioButton
                  key={s}
                  title={s}
                  secondary
                  onPress={() => setDraft(s)}
                />
              ))}
            </View>
          )}
          {displayed.map((m, i) => (
            <View
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                width: "94%",
                padding: 18,
                borderRadius: 22,
                borderBottomRightRadius: m.role === "user" ? 4 : 22,
                borderBottomLeftRadius: m.role === "model" ? 4 : 22,
                backgroundColor: m.role === "user" ? c.tint : c.surface,
                gap: 12,
              }}
            >
              <Text
                style={{
                  color: m.role === "user" ? c.accent : c.muted,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 12,
                }}
              >
                {m.role === "user" ? "You" : "LingoBridge AI"}
              </Text>
              <Text
                selectable
                style={{
                  color: c.ink,
                  fontFamily: "Outfit_400Regular",
                  fontSize: 18,
                  lineHeight: 26,
                  writingDirection: isRtlLanguage(chatTarget) ? "rtl" : "auto",
                }}
              >
                {m.text}
              </Text>
              {m.audioUri ? (
                <RecordedReply
                  uri={m.audioUri}
                  disabled={locked}
                  onPlaying={setClipPlaying}
                  report={p.report}
                />
              ) : (
                <StudioButton
                  title={playing ? "Stop voice" : "Listen"}
                  secondary
                  disabled={
                    busy || media.recording || media.working || clipPlaying
                  }
                  icon={playing ? "stop" : "play"}
                  onPress={() => {
                    if (playing) {
                      void stopSpeech();
                      setPlaying(false);
                    } else
                      void speak(m.text, speaking ? chatTarget : chatSource);
                  }}
                />
              )}
              {m.role === "user" && !!m.feedback && (
                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: c.line,
                    paddingTop: 12,
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      color: c.accent,
                      fontFamily: "Outfit_600SemiBold",
                    }}
                  >
                    Your feedback
                  </Text>
                  <StudioText>{m.feedback}</StudioText>
                  {!!m.correction && (
                    <>
                      <StudioText muted>A natural way to say it</StudioText>
                      <StudioText>{m.correction}</StudioText>
                    </>
                  )}
                </View>
              )}
            </View>
          ))}
          {saveFailed && (
            <StudioButton
              title="Retry save"
              secondary
              disabled={locked}
              onPress={() => {
                setBusy(true);
                void save(messages)
                  .catch(() => p.report("Could not save. Try again."))
                  .finally(() => {
                    if (alive.current) setBusy(false);
                  });
              }}
            />
          )}
          {messages.length >= 31 ? (
            <StudioCard>
              <StudioText>
                This conversation has reached 15 replies. Start a new
                conversation to keep practicing.
              </StudioText>
              <StudioButton
                title="Start a new conversation"
                onPress={newChat}
                disabled={locked}
              />
            </StudioCard>
          ) : (
            <StudioCard>
              <StudioText title>
                {media.recording
                  ? "Recording your reply…"
                  : speaking
                    ? "Your reply"
                    : "Ask anything about language"}
              </StudioText>
              {speaking && (
                <>
                  <StudioButton
                    title={
                      media.recording
                        ? `Stop recording · ${media.seconds}s`
                        : "Record a reply"
                    }
                    icon={media.recording ? "stop" : "mic-outline"}
                    disabled={busy || playing || clipPlaying || media.working}
                    onPress={() => {
                      if (media.recording)
                        void (async () => {
                          await media.stop();
                          await media.extract(chatTarget);
                        })();
                      else {
                        setDraft("");
                        void media.start();
                      }
                    }}
                  />
                  {!!media.file && (
                    <>
                      <RecordedReply
                        uri={media.file.uri}
                        disabled={locked}
                        onPlaying={setClipPlaying}
                        report={p.report}
                      />
                      <StudioButton
                        secondary
                        title="Transcribe recording"
                        disabled={locked}
                        onPress={() => void media.extract(chatTarget)}
                      />
                      <StudioButton
                        secondary
                        title="Discard recording, keep text"
                        disabled={locked}
                        onPress={() => media.clear()}
                      />
                    </>
                  )}
                </>
              )}
              <StudioInput
                label={
                  speaking
                    ? "Review your spoken reply"
                    : "Message to the AI assistant"
                }
                value={draft}
                onChangeText={setDraft}
                editable={!locked}
              />
              <StudioText muted>
                {speaking
                  ? "Review or edit your transcript before sending. Feedback appears beneath your reply. Stopping sends audio for transcription. Confirm sends your transcript and audio for feedback."
                  : "Uses the current chat and text you share. No web search or access to private files."}
              </StudioText>
              <StudioButton
                title={
                  busy
                    ? "AI is thinking…"
                    : speaking
                      ? "Confirm reply & continue"
                      : "Send message"
                }
                disabled={
                  locked || !draft.trim() || Array.from(draft).length > 5000
                }
                onPress={() => void (speaking ? send() : sendAssistant())}
              />
            </StudioCard>
          )}
          <StudioButton
            title="New conversation"
            secondary
            disabled={locked}
            onPress={newChat}
          />
        </>
      )}
    </View>
  );
}
