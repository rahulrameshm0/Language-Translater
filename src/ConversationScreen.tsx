import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  Pressable,
  ScrollView,
  Text,
  View,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
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
  compact = false,
}: {
  compact?: boolean;
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
      if (s !== "active") {
        try {
          player.pause();
        } catch {}
      }
    });
    return () => {
      sub.remove();
      // useAudioPlayer releases the player automatically on unmount.
    };
  }, [player]);
  const toggle = async () => {
    try {
      if (status.playing) player.pause();
      else {
        await stopSpeech();
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });
        if (status.didJustFinish) await player.seekTo(0);
        player.play();
      }
    } catch {
      report("Recording playback is unavailable. Your transcript is kept.");
    }
  };
  if (compact)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          status.playing ? "Pause your recording" : "Replay your recording"
        }
        disabled={disabled && !status.playing}
        onPress={() => void toggle()}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          minHeight: 36,
        }}
      >
        <Ionicons
          name={status.playing ? "pause" : "volume-medium-outline"}
          size={20}
          color="#B8B8C0"
        />
        <Text style={{ color: "#B8B8C0", fontSize: 12 }}>
          {status.duration > 0
            ? `${Math.floor(status.duration / 60)}:${String(Math.floor(status.duration % 60)).padStart(2, "0")}`
            : "Your recording"}
        </Text>
      </Pressable>
    );
  return (
    <StudioButton
      secondary
      title={status.playing ? "Pause your recording" : "Play your recording"}
      disabled={disabled && !status.playing}
      icon={status.playing ? "pause" : "play"}
      onPress={() => {
        if (status.playing) {
          try {
            player.pause();
          } catch {
            report("Playback stopped. Please try again.");
          }
        } else
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
  const conversationScroll = useRef<ScrollView>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [hiddenTips, setHiddenTips] = useState<Record<number, boolean>>({});
  const [notice, setNotice] = useState("");
  const report = (message: string) => {
    if (alive.current) {
      setNotice(message);
      p.report(message);
    }
  };
  const [chatSource, setChatSource] = useState(p.source),
    [chatTarget, setChatTarget] = useState(speaking ? p.source : p.target);
  const media = useMediaInput(report),
    alive = useRef(true),
    pending = useRef(false),
    clips = useRef<string[]>([]);
  useEffect(() => {
    if (media.draft) {
      setDraft(media.draft);
      setReviewOpen(true);
    }
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
      report("Could not load saved conversations. Try again.");
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
      report(
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
        report,
      );
    } catch (e) {
      setPlaying(false);
      report(e instanceof Error ? e.message : "Could not play the reply.");
    }
  }
  async function send(opening = false) {
    if (pending.current || locked || (!opening && !draft.trim())) return;
    pending.current = true;
    setBusy(true);
    report("");
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
      setReviewOpen(false);
      setDraft("");
      media.clear();
      await save(completed);
      if (speaking && alive.current) await speak(output.reply);
    } catch (e) {
      if (alive.current)
        report(
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
        report(e instanceof Error ? e.message : "Could not send. Try again.");
      } finally {
        pending.current = false;
        if (alive.current) setBusy(false);
      }
    } else await send();
  }
  const activeSpeaking = speaking && messages.length > 0 && !showHistory;
  const replies = messages.filter((m) => m.role === "user").length;
  const stopOrListen = (text: string) => {
    if (playing) {
      void stopSpeech();
      setPlaying(false);
    } else void speak(text);
  };
  const recordTurn = () => {
    if (media.recording) {
      void (async () => {
        await media.stop();
        if (alive.current) {
          setReviewOpen(true);
          await media.extract(chatTarget);
        }
      })();
    } else {
      setDraft("");
      setReviewOpen(false);
      void stopSpeech().then(() => media.start());
    }
  };
  const closeConversation = () => {
    if (playing) {
      void stopSpeech();
      setPlaying(false);
      return;
    }
    if (locked) {
      report("Finish or stop the current recording first.");
      return;
    }
    newChat();
  };
  if (activeSpeaking)
    return (
      <Modal visible animationType="slide" onRequestClose={closeConversation}>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  playing ? "Stop AI voice" : "Back to topics"
                }
                onPress={closeConversation}
                style={{ width: 44, height: 44, justifyContent: "center" }}
              >
                <Ionicons name="chevron-back" size={24} color={c.ink} />
              </Pressable>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: 18,
                  fontWeight: "600",
                  color: c.ink,
                }}
              >
                👋 {topic}
              </Text>
              <View style={{ width: 44 }} />
            </View>
            <View style={{ paddingHorizontal: 20, paddingBottom: 18, gap: 10 }}>
              <Text style={{ fontSize: 12, color: c.muted }}>
                {replies} / 15 replies · {languages[chatTarget].name} ·{" "}
                {busy
                  ? "AI is thinking…"
                  : media.recording
                    ? "Listening…"
                    : "Your conversation"}
              </Text>
              <View style={{ flexDirection: "row", gap: 5 }}>
                {Array.from({ length: 15 }, (_, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: i < replies ? c.accent : c.line,
                    }}
                  />
                ))}
              </View>
            </View>
            <ScrollView
              ref={conversationScroll}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: 20,
                paddingTop: 8,
                gap: 16,
                paddingBottom: 24,
              }}
              onContentSizeChange={() =>
                conversationScroll.current?.scrollToEnd({ animated: true })
              }
            >
              {messages.map((m, i) => (
                <View
                  key={i}
                  style={{
                    alignSelf: m.role === "model" ? "flex-start" : "flex-end",
                    width: "84%",
                    backgroundColor: c.surface,
                    padding: 18,
                    borderRadius: 24,
                    borderBottomLeftRadius: m.role === "model" ? 3 : 24,
                    borderBottomRightRadius: m.role === "user" ? 3 : 24,
                    gap: 14,
                  }}
                >
                  {m.role === "model" && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        playing
                          ? "Stop AI voice"
                          : `Play AI message ${Math.floor(i / 2) + 1}`
                      }
                      disabled={
                        busy || media.recording || media.working || clipPlaying
                      }
                      onPress={() => stopOrListen(m.text)}
                      style={{
                        minHeight: 36,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 14,
                        opacity: busy || media.recording ? 0.5 : 1,
                      }}
                    >
                      <View
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 15,
                          backgroundColor: c.tint,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name="person" size={18} color={c.accent} />
                      </View>
                      <Ionicons
                        name={playing ? "stop" : "play"}
                        color={c.ink}
                        size={20}
                      />
                      <View
                        style={{ flex: 1, height: 1, backgroundColor: c.line }}
                      />
                      <Text style={{ color: c.muted, fontSize: 12 }}>
                        AI voice
                      </Text>
                    </Pressable>
                  )}
                  <Text
                    selectable
                    style={{
                      fontSize: 18,
                      lineHeight: 25,
                      fontWeight: "500",
                      color: c.ink,
                      writingDirection: isRtlLanguage(chatTarget)
                        ? "rtl"
                        : "auto",
                    }}
                  >
                    {m.text}
                  </Text>
                  {m.role === "user" && (
                    <>
                      {!!m.feedback && (
                        <>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={
                              hiddenTips[i] ? "Show feedback" : "Hide feedback"
                            }
                            onPress={() =>
                              setHiddenTips({
                                ...hiddenTips,
                                [i]: !hiddenTips[i],
                              })
                            }
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                              minHeight: 32,
                            }}
                          >
                            <Ionicons
                              name="sparkles"
                              size={18}
                              color="#62BAA0"
                            />
                            <Text
                              style={{
                                fontSize: 13,
                                color: "#62BAA0",
                                flex: 1,
                              }}
                            >
                              Feedback
                            </Text>
                            <Ionicons
                              name={
                                hiddenTips[i] ? "chevron-down" : "chevron-up"
                              }
                              size={16}
                              color={c.muted}
                            />
                          </Pressable>
                          {!hiddenTips[i] && (
                            <View
                              style={{
                                backgroundColor:
                                  c.bg === "#1C1C1E" ? "#35342D" : c.secondary,
                                padding: 12,
                                borderRadius: 10,
                                gap: 10,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 13,
                                  lineHeight: 19,
                                  color: c.ink,
                                }}
                              >
                                {m.feedback}
                              </Text>
                              {!!m.correction && (
                                <Text
                                  style={{
                                    fontSize: 13,
                                    lineHeight: 19,
                                    color: c.ink,
                                  }}
                                >
                                  Try: {m.correction}
                                </Text>
                              )}
                            </View>
                          )}
                        </>
                      )}
                      {m.audioUri ? (
                        <RecordedReply
                          compact
                          uri={m.audioUri}
                          disabled={locked}
                          onPlaying={setClipPlaying}
                          report={report}
                        />
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Read your transcript aloud"
                          disabled={
                            busy ||
                            media.recording ||
                            media.working ||
                            clipPlaying
                          }
                          onPress={() => stopOrListen(m.text)}
                          style={{
                            alignSelf: "flex-end",
                            minHeight: 32,
                            minWidth: 36,
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons
                            name={playing ? "stop" : "volume-medium-outline"}
                            size={20}
                            color={c.muted}
                          />
                        </Pressable>
                      )}
                    </>
                  )}
                </View>
              ))}
              {saveFailed && (
                <StudioButton
                  secondary
                  title="Retry save"
                  disabled={locked}
                  onPress={() => {
                    setBusy(true);
                    void save(messages)
                      .catch(() => report("Could not save. Try again."))
                      .finally(() => {
                        if (alive.current) setBusy(false);
                      });
                  }}
                />
              )}
              {replies >= 15 && (
                <StudioButton
                  title="Start a new conversation"
                  disabled={locked}
                  onPress={newChat}
                />
              )}
            </ScrollView>
            {!!notice && (
              <View
                accessibilityRole="alert"
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 8,
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                <Text style={{ color: c.ink, flex: 1, fontSize: 13 }}>
                  {notice}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss speaking message"
                  onPress={() => setNotice("")}
                >
                  <Ionicons name="close" size={20} color={c.muted} />
                </Pressable>
              </View>
            )}
            {replies < 15 && (
              <View
                style={{
                  paddingHorizontal: 20,
                  paddingTop: 10,
                  paddingBottom: 12,
                  gap: 12,
                }}
              >
                {reviewOpen && !media.recording && (
                  <View
                    style={{
                      backgroundColor: c.surface,
                      borderRadius: 18,
                      padding: 14,
                      gap: 8,
                    }}
                  >
                    <Text style={{ color: c.muted, fontSize: 12 }}>
                      Review your reply before sending
                    </Text>
                    <TextInput
                      accessibilityLabel="Review your spoken reply"
                      multiline
                      maxLength={5000}
                      value={draft}
                      onChangeText={setDraft}
                      editable={!locked}
                      style={{
                        color: c.ink,
                        fontSize: 16,
                        lineHeight: 22,
                        minHeight: 55,
                        maxHeight: 120,
                        textAlignVertical: "top",
                      }}
                    />
                    {!!media.file && (
                      <RecordedReply
                        compact
                        uri={media.file.uri}
                        disabled={locked}
                        onPlaying={setClipPlaying}
                        report={report}
                      />
                    )}
                    <StudioButton
                      title={busy ? "AI is thinking…" : "Confirm reply"}
                      disabled={locked || !draft.trim()}
                      onPress={() => {
                        void send();
                      }}
                    />
                    {!!media.file && !draft.trim() && (
                      <StudioButton
                        secondary
                        title="Retry transcription"
                        disabled={locked}
                        onPress={() => void media.extract(chatTarget)}
                      />
                    )}
                  </View>
                )}
                <Text
                  style={{ color: c.muted, fontSize: 11, textAlign: "center" }}
                >
                  {media.recording
                    ? `Recording · ${media.seconds}s / 60s`
                    : media.working
                      ? "Transcribing…"
                      : busy
                        ? "AI is thinking…"
                        : "Stop to transcribe, then review and confirm. Audio goes to AI."}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      reviewOpen
                        ? "Hide reply editor"
                        : "Type or review your reply"
                    }
                    disabled={locked}
                    onPress={() => setReviewOpen(!reviewOpen)}
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 27,
                      backgroundColor: c.surface,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons name="bulb" size={24} color="#F2C446" />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      playing
                        ? "Stop AI voice"
                        : media.recording
                          ? "Stop recording and review"
                          : "Record your reply"
                    }
                    disabled={busy || clipPlaying || media.working}
                    onPress={() => {
                      if (playing) {
                        void stopSpeech();
                        setPlaying(false);
                      } else recordTurn();
                    }}
                    style={{
                      flex: 1,
                      height: 58,
                      borderRadius: 29,
                      backgroundColor: c.accent,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: busy || media.working ? 0.45 : 1,
                    }}
                  >
                    <Ionicons
                      name={playing || media.recording ? "stop" : "mic"}
                      size={28}
                      color="#FFFFFF"
                    />
                  </Pressable>
                </View>
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    );
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
                  report("This conversation could not be opened.");
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
                  report={report}
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
                  .catch(() => report("Could not save. Try again."))
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
                        report={report}
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
