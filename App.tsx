import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  KeyboardAwareScrollView,
  KeyboardProvider,
} from "react-native-keyboard-controller";
import Ionicons from "@expo/vector-icons/Ionicons";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import * as Speech from "expo-speech";
import Constants from "expo-constants";
import { configured, supabase } from "./src/supabase";
import {
  isLanguage,
  languages,
  Language,
  languageName,
  Translation,
} from "./src/languages";
import { Colors, ThemePreference, ThemeProvider, useTheme } from "./src/theme";
import { useTranslator } from "./src/useTranslator";
import { useVoice } from "./src/useVoice";
type IconName = React.ComponentProps<typeof Ionicons>["name"];
function Icon({
  name,
  size = 22,
  color,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? colors.ink} />;
}
function Action({
  label,
  onPress,
  icon,
  disabled = false,
  quiet = false,
  small = false,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  quiet?: boolean;
  small?: boolean;
}) {
  const { colors: c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: small ? 44 : 56,
        flexDirection: "row",
        gap: 9,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: small ? 13 : 20,
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: quiet ? "transparent" : c.accent,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      {icon && (
        <Icon name={icon} size={20} color={quiet ? c.accent : c.accentText} />
      )}
      <Text
        style={{
          color: quiet ? c.accent : c.accentText,
          fontWeight: "700",
          fontSize: small ? 14 : 16,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
function IconButton({
  label,
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors: c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 46,
        height: 46,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.secondary,
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <Icon name={icon} />
    </Pressable>
  );
}
function Application() {
  const a = useTranslator();
  const { colors: c, dark, preference, setPreference } = useTheme();
  const s = useMemo(() => styles(c), [c]);
  const voice = useVoice(a.setMessage);
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [picker, setPicker] = useState<"source" | "target" | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [sendingAudio, setSendingAudio] = useState(false);
  const locked = a.busy || voice.recording || voice.working || sendingAudio;
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboard(true),
    );
    const hidden = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboard(false),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  useEffect(() => {
    void Speech.stop();
    setSpeaking(false);
  }, [a.result, a.target]);
  useEffect(() => {
    if (!a.session) {
      void voice.stop(false);
      voice.discard();
      void Speech.stop();
      setSpeaking(false);
    }
  }, [a.session?.user.id]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") {
        void Speech.stop();
        setSpeaking(false);
      }
    });
    return () => {
      sub.remove();
      void Speech.stop();
    };
  }, []);
  async function speak() {
    if (speaking) {
      await Speech.stop();
      setSpeaking(false);
      return;
    }
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const matching = voices.find((v) =>
        v.language.toLowerCase().startsWith(a.target),
      );
      if (!matching) {
        a.setMessage(
          `No ${languages[a.target].name} voice is installed on this phone. You can still copy or read the translation.`,
        );
        return;
      }
      setSpeaking(true);
      Speech.speak(a.result, {
        language: languages[a.target].locale,
        voice: matching.identifier,
        onDone: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
        onError: () => {
          setSpeaking(false);
          a.setMessage(
            "Could not play this translation. Check your phone’s speech settings.",
          );
        },
      });
    } catch {
      setSpeaking(false);
      a.setMessage("Speech playback is unavailable on this phone.");
    }
  }
  async function sendVoice() {
    if (sendingAudio || a.busy) return;
    setSendingAudio(true);
    a.setMessage("");
    try {
      const payload = await voice.payload();
      const success = await a.translate(payload);
      if (success) voice.discard();
    } catch (error) {
      a.setMessage(
        error instanceof Error
          ? error.message
          : "Could not upload recording. Try again.",
      );
    } finally {
      setSendingAudio(false);
    }
  }
  function openHistory(item: Translation) {
    if (
      !isLanguage(item.source_language) ||
      !isLanguage(item.target_language)
    ) {
      Alert.alert(
        "Previous-language history",
        `${languageName(item.source_language)} → ${languageName(item.target_language)}\n\n${item.original_text}\n\n${item.translated_text}`,
      );
      return;
    }
    a.setSource(item.source_language);
    a.setTarget(item.target_language);
    a.setText(item.original_text);
    a.setResult(item.translated_text);
    a.setTab("Translate");
    setInputMode("text");
    a.setMessage("");
  }
  const version = Constants.expoConfig?.version ?? "1.1.0";
  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right", "bottom"]}>
      <StatusBar style={dark ? "light" : "dark"} />
      <View style={s.header}>
        <View style={s.brandRow}>
          <Image source={require("./assets/icon.png")} style={s.logo} />
          <View>
            <Text style={s.brand}>Vaylo</Text>
            <Text style={s.brandCaption}>
              A little closer, in every language.
            </Text>
          </View>
        </View>
        <IconButton
          label={dark ? "Switch to light mode" : "Switch to dark mode"}
          icon={dark ? "sunny-outline" : "moon-outline"}
          onPress={() => setPreference(dark ? "light" : "dark")}
        />
      </View>
      {!configured ? (
        <View style={s.center}>
          <Icon name="cloud-offline-outline" size={42} />
          <Text style={s.title}>Connect your services</Text>
          <Text style={s.body}>
            Add your Supabase project settings to .env, then restart the app.
          </Text>
        </View>
      ) : !a.ready ? (
        <View style={s.center}>
          <ActivityIndicator color={c.accent} />
          <Text style={s.body}>Getting things ready…</Text>
        </View>
      ) : (
        <>
          <KeyboardAwareScrollView
            bottomOffset={28}
            extraKeyboardSpace={24}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={s.page}
            showsVerticalScrollIndicator={false}
          >
            {a.showAuth ? (
              <>
                <View style={s.authIntro}>
                  <View style={s.badge}>
                    <Icon name="chatbubbles-outline" size={18} color={c.teal} />
                    <Text
                      style={{ color: c.teal, fontSize: 13, fontWeight: "600" }}
                    >
                      English · Spanish · Armenian · German
                    </Text>
                  </View>
                  <Text style={s.hero}>
                    {a.mode === "signup"
                      ? "Your next conversation starts here."
                      : a.mode === "forgot"
                        ? "Let’s get you back in."
                        : a.mode === "reset"
                          ? "A fresh start."
                          : "Different languages.\nSame connection."}
                  </Text>
                  <Text style={s.body}>
                    {a.mode === "forgot"
                      ? "Enter your email to receive a password reset link."
                      : a.mode === "reset"
                        ? "Choose a new password with at least eight characters."
                        : "Translate a thought, speak a sentence, and keep the words that matter."}
                  </Text>
                </View>
                <View style={s.panel}>
                  <Text style={s.panelTitle}>
                    {a.mode === "signup"
                      ? "Create your account"
                      : a.mode === "forgot"
                        ? "Reset password"
                        : a.mode === "reset"
                          ? "New password"
                          : "Welcome back"}
                  </Text>
                  {a.mode !== "reset" && (
                    <>
                      <Text style={s.label}>Email address</Text>
                      <TextInput
                        accessibilityLabel="Email address"
                        placeholder="you@example.com"
                        placeholderTextColor={c.muted}
                        style={s.input}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        textContentType="emailAddress"
                        value={a.email}
                        onChangeText={a.setEmail}
                      />
                    </>
                  )}
                  {a.mode !== "forgot" && (
                    <>
                      <Text style={s.label}>Password</Text>
                      <TextInput
                        accessibilityLabel="Password"
                        style={s.input}
                        placeholder="At least 8 characters"
                        placeholderTextColor={c.muted}
                        secureTextEntry
                        textContentType={
                          a.mode === "signin" ? "password" : "newPassword"
                        }
                        value={a.password}
                        onChangeText={a.setPassword}
                      />
                    </>
                  )}
                  <Action
                    label={
                      a.busy
                        ? "Please wait…"
                        : a.mode === "signup"
                          ? "Create account"
                          : a.mode === "forgot"
                            ? "Send reset link"
                            : a.mode === "reset"
                              ? "Save new password"
                              : "Sign in"
                    }
                    icon="arrow-forward"
                    disabled={a.busy || (a.mode !== "reset" && !a.email.trim())}
                    onPress={() => void a.authenticate()}
                  />
                  {a.mode === "signin" && (
                    <Action
                      label="Forgot password?"
                      quiet
                      small
                      disabled={a.busy}
                      onPress={() => {
                        a.setMode("forgot");
                        a.setMessage("");
                      }}
                    />
                  )}
                </View>
                {a.mode !== "reset" && (
                  <Action
                    quiet
                    label={
                      a.mode === "signin"
                        ? "New here? Create an account"
                        : "Back to sign in"
                    }
                    disabled={a.busy}
                    onPress={() => {
                      a.setMode(a.mode === "signin" ? "signup" : "signin");
                      a.setPassword("");
                      a.setMessage("");
                    }}
                  />
                )}
                <Text style={s.footnote}>
                  Your history stays private to your account. Text and voice
                  clips are sent to Google Gemini for translation. Avoid
                  sensitive information.
                </Text>
              </>
            ) : a.tab === "Translate" ? (
              <>
                <View style={s.sectionHeading}>
                  <View>
                    <Text style={s.title}>Say it your way.</Text>
                    <Text style={s.body}>
                      A new language. A familiar voice.
                    </Text>
                  </View>
                  <View style={s.roundBadge}>
                    <Icon name="language-outline" size={25} color={c.accent} />
                  </View>
                </View>
                <View style={s.segment}>
                  {(["text", "voice"] as const).map((mode) => (
                    <Pressable
                      key={mode}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: inputMode === mode }}
                      disabled={locked}
                      onPress={() => {
                        setInputMode(mode);
                        if (mode === "text") voice.discard();
                        a.setMessage("");
                        Keyboard.dismiss();
                      }}
                      style={[
                        s.segmentItem,
                        inputMode === mode && s.segmentSelected,
                      ]}
                    >
                      <Icon
                        name={
                          mode === "text" ? "create-outline" : "mic-outline"
                        }
                        size={19}
                        color={inputMode === mode ? c.accent : c.muted}
                      />
                      <Text
                        style={[
                          s.segmentLabel,
                          { color: inputMode === mode ? c.accent : c.muted },
                        ]}
                      >
                        {mode === "text" ? "Type text" : "Use your voice"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={s.languageRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Source language: ${languages[a.source].name}`}
                    disabled={locked}
                    style={s.languageButton}
                    onPress={() => {
                      Keyboard.dismiss();
                      setPicker("source");
                    }}
                  >
                    <Text style={s.smallLabel}>From</Text>
                    <View style={s.inline}>
                      <Text style={s.languageText}>
                        {languages[a.source].name}
                      </Text>
                      <Icon name="chevron-down" size={16} />
                    </View>
                    <Text style={s.caption}>{languages[a.source].native}</Text>
                  </Pressable>
                  <IconButton
                    label="Swap languages"
                    icon="swap-horizontal"
                    disabled={locked}
                    onPress={() => {
                      a.setSource(a.target);
                      a.setTarget(a.source);
                      if (a.result) a.setText(a.result);
                      a.setResult("");
                      voice.discard();
                      a.setMessage("");
                    }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Target language: ${languages[a.target].name}`}
                    disabled={locked}
                    style={s.languageButton}
                    onPress={() => {
                      Keyboard.dismiss();
                      setPicker("target");
                    }}
                  >
                    <Text style={s.smallLabel}>To</Text>
                    <View style={s.inline}>
                      <Text style={s.languageText}>
                        {languages[a.target].name}
                      </Text>
                      <Icon name="chevron-down" size={16} />
                    </View>
                    <Text style={s.caption}>{languages[a.target].native}</Text>
                  </Pressable>
                </View>
                {inputMode === "text" ? (
                  <View style={s.composer}>
                    <View style={s.spaceBetween}>
                      <Text style={s.label}>{languages[a.source].name}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Clear source text"
                        disabled={locked || !a.text}
                        onPress={() => {
                          a.setText("");
                          a.setResult("");
                          a.setMessage("");
                        }}
                        style={{ padding: 7 }}
                      >
                        <Icon
                          name="close-circle-outline"
                          color={c.muted}
                          size={21}
                        />
                      </Pressable>
                    </View>
                    <TextInput
                      accessibilityLabel="Text to translate"
                      multiline
                      textAlignVertical="top"
                      editable={!locked}
                      style={s.editor}
                      placeholder="Write something. We’ll find the words."
                      placeholderTextColor={c.muted}
                      value={a.text}
                      onChangeText={(value) => {
                        a.setText(value);
                        a.setResult("");
                        a.setMessage("");
                      }}
                    />
                    <View style={s.spaceBetween}>
                      <Text
                        style={[
                          s.caption,
                          Array.from(a.text).length > 5000 && {
                            color: c.error,
                          },
                        ]}
                      >
                        {Array.from(a.text).length.toLocaleString()} / 5,000
                      </Text>
                      <View style={s.inline}>
                        <Icon
                          name="lock-closed-outline"
                          color={c.muted}
                          size={12}
                        />
                        <Text style={s.caption}>Private history</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={s.voicePanel}>
                    <Text style={s.panelTitle}>
                      {voice.recording
                        ? "Listening to you…"
                        : voice.uri
                          ? "Your recording is ready"
                          : "Every conversation starts with a voice."}
                    </Text>
                    <Text style={[s.body, { textAlign: "center" }]}>
                      {voice.recording
                        ? "Tap stop when you’re done."
                        : voice.uri
                          ? "Translate your recording or record it again."
                          : `Record up to 30 seconds in ${languages[a.source].name}.`}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        voice.recording ? "Stop recording" : "Start recording"
                      }
                      disabled={a.busy || voice.working || sendingAudio}
                      onPress={() => {
                        if (voice.recording) void voice.stop();
                        else
                          void Speech.stop().then(() => {
                            setSpeaking(false);
                            return voice.start();
                          });
                      }}
                      style={[
                        s.recordButton,
                        voice.recording && { backgroundColor: c.error },
                      ]}
                    >
                      <Icon
                        name={voice.recording ? "stop" : "mic"}
                        size={38}
                        color={voice.recording ? "#FFFFFF" : c.accentText}
                      />
                    </Pressable>
                    <Text style={s.recordTime}>
                      {voice.recording
                        ? `0:${String(voice.seconds).padStart(2, "0")}`
                        : voice.uri
                          ? "Ready to translate"
                          : "Tap to record"}
                    </Text>
                    {voice.uri && (
                      <Action
                        label="Discard recording"
                        small
                        quiet
                        disabled={locked}
                        onPress={() => voice.discard()}
                      />
                    )}
                    <Text style={[s.footnote, { textAlign: "center" }]}>
                      Audio is sent only when you tap Translate voice. The
                      recording is deleted from this app after translation.
                    </Text>
                  </View>
                )}
                <Action
                  label={
                    a.busy || sendingAudio
                      ? "Finding the right words…"
                      : inputMode === "voice"
                        ? "Translate voice"
                        : "Translate text"
                  }
                  icon={a.busy ? "hourglass-outline" : "arrow-forward"}
                  disabled={
                    locked ||
                    (inputMode === "text"
                      ? !a.text.trim() || Array.from(a.text).length > 5000
                      : !voice.uri)
                  }
                  onPress={() => {
                    Keyboard.dismiss();
                    if (inputMode === "voice") void sendVoice();
                    else void a.translate();
                  }}
                />
                {a.result !== "" && (
                  <View style={s.resultPanel}>
                    <View style={s.spaceBetween}>
                      <View style={s.inline}>
                        <View style={s.dot} />
                        <Text style={[s.label, { color: c.teal }]}>
                          {languages[a.target].name}
                        </Text>
                      </View>
                      <Text style={s.caption}>Translation</Text>
                    </View>
                    <Text selectable style={s.translated}>
                      {a.result}
                    </Text>
                    <View style={s.resultActions}>
                      <Action
                        label={speaking ? "Stop reading" : "Listen"}
                        small
                        quiet
                        icon={
                          speaking
                            ? "stop-circle-outline"
                            : "volume-high-outline"
                        }
                        onPress={() => void speak()}
                      />
                      <Action
                        label="Copy"
                        small
                        quiet
                        icon="copy-outline"
                        onPress={() => {
                          void Clipboard.setStringAsync(a.result).then(
                            () => a.setMessage("Translation copied."),
                            () =>
                              a.setMessage(
                                "Could not copy. Select the text to copy it.",
                              ),
                          );
                        }}
                      />
                    </View>
                  </View>
                )}
                {inputMode === "voice" && a.result && (
                  <View style={s.transcript}>
                    <Text style={s.label}>What you said</Text>
                    <Text selectable style={s.body}>
                      {a.text}
                    </Text>
                  </View>
                )}
                <Text style={s.footnote}>
                  AI translations can make mistakes. Gemini’s free tier may use
                  text and audio to improve Google’s products.
                </Text>
              </>
            ) : a.tab === "History" ? (
              <>
                <View style={s.sectionHeading}>
                  <View>
                    <Text style={s.title}>Your word collection.</Text>
                    <Text style={s.body}>Ready for the next conversation.</Text>
                  </View>
                  <IconButton
                    label="Refresh history"
                    icon="refresh-outline"
                    disabled={a.historyBusy}
                    onPress={() => void a.loadHistory(true)}
                  />
                </View>
                {!a.history.length && !a.historyBusy && (
                  <View style={s.empty}>
                    <View style={s.emptyIcon}>
                      <Icon name="time-outline" size={38} color={c.accent} />
                    </View>
                    <Text style={s.panelTitle}>
                      Good words are worth keeping.
                    </Text>
                    <Text style={[s.body, { textAlign: "center" }]}>
                      Your text and voice translations will show up here.
                    </Text>
                    <Action
                      label="Start translating"
                      quiet
                      icon="arrow-forward"
                      onPress={() => a.setTab("Translate")}
                    />
                  </View>
                )}
                {a.history.map((item) => (
                  <View key={item.id} style={s.historyCard}>
                    <View style={s.spaceBetween}>
                      <Text style={s.historyPair}>
                        {languageName(item.source_language)}{" "}
                        <Text style={{ color: c.muted }}>→</Text>{" "}
                        {languageName(item.target_language)}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Delete saved translation"
                        disabled={locked}
                        style={{ padding: 9 }}
                        onPress={() =>
                          Alert.alert(
                            "Delete this translation?",
                            "It will be removed from your saved history.",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Delete",
                                style: "destructive",
                                onPress: () => void a.deleteRecord(item.id),
                              },
                            ],
                          )
                        }
                      >
                        <Icon name="trash-outline" size={18} color={c.muted} />
                      </Pressable>
                    </View>
                    <Text numberOfLines={2} style={s.original}>
                      {item.original_text}
                    </Text>
                    <Text numberOfLines={3} style={s.savedTranslation}>
                      {item.translated_text}
                    </Text>
                    <View style={s.spaceBetween}>
                      <Text style={s.caption}>
                        {new Date(item.created_at).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </Text>
                      <Action
                        label="Open"
                        quiet
                        small
                        icon="open-outline"
                        disabled={locked}
                        onPress={() => openHistory(item)}
                      />
                    </View>
                  </View>
                ))}
                {a.historyBusy ? (
                  <ActivityIndicator color={c.accent} />
                ) : (
                  a.more &&
                  a.history.length > 0 && (
                    <Action
                      label="Load more translations"
                      quiet
                      onPress={() => void a.loadHistory()}
                    />
                  )
                )}
              </>
            ) : (
              <>
                <View>
                  <Text style={s.title}>Make yourself at home.</Text>
                  <Text style={s.body}>
                    Your preferences, your conversations.
                  </Text>
                </View>
                <View style={s.accountCard}>
                  <View style={s.avatar}>
                    <Icon name="person-outline" color={c.accent} size={25} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={s.label}>Your account</Text>
                    <Text selectable style={s.email}>
                      {a.session?.user.email}
                    </Text>
                  </View>
                  <View style={s.secureBadge}>
                    <Icon
                      name="shield-checkmark-outline"
                      size={18}
                      color={c.teal}
                    />
                  </View>
                </View>
                <View style={s.panel}>
                  <View style={s.inline}>
                    <Icon name="color-palette-outline" color={c.accent} />
                    <Text style={s.panelTitle}>Appearance</Text>
                  </View>
                  <Text style={s.body}>Choose what feels right.</Text>
                  <View style={s.themeOptions}>
                    {(["system", "light", "dark"] as ThemePreference[]).map(
                      (value) => (
                        <Pressable
                          key={value}
                          accessibilityRole="radio"
                          accessibilityState={{
                            selected: preference === value,
                          }}
                          onPress={() => setPreference(value)}
                          style={[
                            s.themeOption,
                            preference === value && {
                              borderColor: c.accent,
                              backgroundColor: c.tint,
                            },
                          ]}
                        >
                          <Icon
                            name={
                              value === "dark"
                                ? "moon-outline"
                                : value === "light"
                                  ? "sunny-outline"
                                  : "phone-portrait-outline"
                            }
                            color={preference === value ? c.accent : c.muted}
                          />
                          <Text
                            style={{
                              color: preference === value ? c.accent : c.ink,
                              fontWeight: "600",
                              fontSize: 13,
                            }}
                          >
                            {value.charAt(0).toUpperCase() + value.slice(1)}
                          </Text>
                        </Pressable>
                      ),
                    )}
                  </View>
                </View>
                <View style={s.panel}>
                  <View style={s.spaceBetween}>
                    <View style={s.inline}>
                      <Icon name="sparkles-outline" color={c.accent} />
                      <Text style={s.panelTitle}>Vaylo {version}</Text>
                    </View>
                    <View style={s.versionTag}>
                      <Text
                        style={{
                          color: c.teal,
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        {Platform.OS === "ios" ? "iOS" : "Android"}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.body}>
                    Install new versions manually using the Android APK
                    download.
                  </Text>
                </View>
                <View style={s.panel}>
                  <View style={s.inline}>
                    <Icon name="lock-closed-outline" color={c.accent} />
                    <Text style={s.panelTitle}>Account & privacy</Text>
                  </View>
                  <Text style={s.body}>
                    Your history is private to your account. Text and voice
                    clips are processed by Google Gemini. Free-tier content may
                    be used to improve its products.
                  </Text>
                  <Action
                    label="Reset password"
                    quiet
                    small
                    icon="key-outline"
                    disabled={locked}
                    onPress={async () => {
                      try {
                        const { error } =
                          await supabase.auth.resetPasswordForEmail(
                            a.session!.user.email!,
                            { redirectTo: "threewords://auth/reset" },
                          );
                        a.setMessage(
                          error
                            ? error.message
                            : "Check your email. Open the reset link on this device.",
                        );
                      } catch {
                        a.setMessage("Could not send reset email. Try again.");
                      }
                    }}
                  />
                  <Action
                    label="Sign out"
                    quiet
                    small
                    icon="log-out-outline"
                    disabled={locked}
                    onPress={async () => {
                      const { error } = await supabase.auth.signOut();
                      if (error) a.setMessage(error.message);
                    }}
                  />
                </View>
              </>
            )}
            {a.message !== "" && (
              <View
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={s.notice}
              >
                <Icon
                  name="information-circle-outline"
                  color={c.accent}
                  size={21}
                />
                <Text style={s.noticeText}>{a.message}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss message"
                  onPress={() => a.setMessage("")}
                  style={{ padding: 5 }}
                >
                  <Icon name="close" size={18} />
                </Pressable>
              </View>
            )}
          </KeyboardAwareScrollView>
          {!a.showAuth && !keyboard && (
            <View style={s.navigation}>
              {(
                [
                  { name: "Translate", icon: "language-outline" },
                  { name: "History", icon: "time-outline" },
                  { name: "Account", icon: "person-circle-outline" },
                ] as const
              ).map((item) => (
                <Pressable
                  key={item.name}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: a.tab === item.name }}
                  disabled={locked}
                  onPress={() => {
                    a.setTab(item.name);
                    a.setMessage("");
                    if (item.name === "History") void a.loadHistory(true);
                  }}
                  style={s.navItem}
                >
                  <View
                    style={[
                      s.navIcon,
                      a.tab === item.name && { backgroundColor: c.tint },
                    ]}
                  >
                    <Icon
                      name={item.icon}
                      size={23}
                      color={a.tab === item.name ? c.accent : c.muted}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: a.tab === item.name ? "700" : "500",
                      color: a.tab === item.name ? c.accent : c.muted,
                    }}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
      <Modal
        visible={picker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <View style={s.modalBackdrop}>
          <Pressable
            style={{ flex: 1 }}
            accessibilityRole="button"
            accessibilityLabel="Close language picker"
            onPress={() => setPicker(null)}
          />
          <SafeAreaView edges={["bottom"]} style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.spaceBetween}>
              <Text style={s.panelTitle}>
                Choose {picker === "source" ? "source" : "translation"} language
              </Text>
              <IconButton
                label="Close language picker"
                icon="close"
                onPress={() => setPicker(null)}
              />
            </View>
            {(Object.keys(languages) as Language[]).map((code) => (
              <Pressable
                key={code}
                accessibilityRole="radio"
                accessibilityState={{
                  selected:
                    (picker === "source" ? a.source : a.target) === code,
                }}
                style={s.languageOption}
                onPress={() => {
                  if (picker) {
                    a.chooseLanguage(code, picker);
                    voice.discard();
                  }
                  setPicker(null);
                }}
              >
                <View style={s.languageInitial}>
                  <Text style={{ color: c.accent, fontWeight: "700" }}>
                    {languages[code].short}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.languageText}>{languages[code].name}</Text>
                  <Text style={s.caption}>{languages[code].native}</Text>
                </View>
                {(picker === "source" ? a.source : a.target) === code && (
                  <Icon name="checkmark-circle" color={c.accent} />
                )}
              </Pressable>
            ))}
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <ThemeProvider>
          <Application />
        </ThemeProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
const styles = (c: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottomWidth: 1,
      borderColor: c.line,
    },
    brandRow: { flexDirection: "row", gap: 11, alignItems: "center" },
    logo: { width: 41, height: 41, borderRadius: 13 },
    brand: {
      fontSize: 24,
      fontWeight: "800",
      letterSpacing: -0.8,
      color: c.ink,
    },
    brandCaption: { fontSize: 10, color: c.muted, marginTop: 2 },
    page: {
      padding: 20,
      paddingBottom: 32,
      gap: 20,
      flexGrow: 1,
      width: "100%",
      maxWidth: 640,
      alignSelf: "center",
    },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 28,
      gap: 20,
    },
    title: {
      fontSize: 28,
      lineHeight: 36,
      fontWeight: "700",
      letterSpacing: -1,
      color: c.ink,
      marginBottom: 5,
    },
    hero: {
      fontSize: 37,
      lineHeight: 45,
      fontWeight: "700",
      letterSpacing: -1.4,
      color: c.ink,
    },
    body: { fontSize: 15, lineHeight: 23, color: c.muted },
    caption: { fontSize: 12, lineHeight: 18, color: c.muted },
    label: { fontSize: 13, fontWeight: "600", color: c.muted },
    smallLabel: { fontSize: 11, color: c.muted },
    panelTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: c.ink,
      lineHeight: 26,
      letterSpacing: -0.3,
    },
    authIntro: { gap: 16, paddingVertical: 12 },
    badge: { flexDirection: "row", alignItems: "center", gap: 7 },
    panel: {
      backgroundColor: c.surface,
      padding: 21,
      borderRadius: 23,
      gap: 16,
      borderWidth: 1,
      borderColor: c.line,
    },
    input: {
      backgroundColor: c.secondary,
      borderRadius: 14,
      color: c.ink,
      padding: 16,
      minHeight: 55,
      fontSize: 16,
    },
    footnote: { fontSize: 11, lineHeight: 18, color: c.muted },
    sectionHeading: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 14,
    },
    roundBadge: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: c.tint,
      alignItems: "center",
      justifyContent: "center",
    },
    segment: {
      flexDirection: "row",
      padding: 5,
      borderRadius: 17,
      backgroundColor: c.secondary,
    },
    segmentItem: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
    },
    segmentSelected: { backgroundColor: c.surface },
    segmentLabel: { fontSize: 14, fontWeight: "600" },
    languageRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    languageButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 5,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 17,
    },
    languageText: { fontSize: 15, fontWeight: "600", color: c.ink },
    inline: { flexDirection: "row", alignItems: "center", gap: 7 },
    spaceBetween: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    composer: {
      backgroundColor: c.surface,
      borderRadius: 23,
      padding: 20,
      borderWidth: 1,
      borderColor: c.line,
    },
    editor: {
      fontSize: 21,
      lineHeight: 32,
      color: c.ink,
      minHeight: 140,
      maxHeight: 240,
      paddingTop: 12,
      paddingBottom: 18,
    },
    resultPanel: {
      backgroundColor: c.tealTint,
      borderRadius: 23,
      padding: 22,
      gap: 20,
    },
    dot: { height: 7, width: 7, borderRadius: 4, backgroundColor: c.teal },
    translated: {
      fontSize: 25,
      lineHeight: 38,
      color: c.ink,
      letterSpacing: -0.3,
    },
    resultActions: {
      flexDirection: "row",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderColor: c.line,
      paddingTop: 9,
    },
    voicePanel: {
      backgroundColor: c.surface,
      padding: 24,
      borderRadius: 23,
      alignItems: "center",
      gap: 16,
      borderWidth: 1,
      borderColor: c.line,
    },
    recordButton: {
      height: 94,
      width: 94,
      borderRadius: 47,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
      marginVertical: 7,
    },
    recordTime: {
      color: c.ink,
      fontSize: 16,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    transcript: { gap: 8, paddingHorizontal: 4 },
    historyCard: {
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 20,
      gap: 12,
      borderWidth: 1,
      borderColor: c.line,
    },
    historyPair: {
      fontSize: 13,
      fontWeight: "600",
      color: c.accent,
      flexShrink: 1,
    },
    original: { fontSize: 15, lineHeight: 23, color: c.muted },
    savedTranslation: { fontSize: 21, lineHeight: 31, color: c.ink },
    empty: { paddingVertical: 38, alignItems: "center", gap: 16 },
    emptyIcon: {
      backgroundColor: c.tint,
      width: 80,
      height: 80,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    accountCard: {
      backgroundColor: c.surface,
      borderRadius: 22,
      padding: 18,
      flexDirection: "row",
      gap: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.line,
    },
    avatar: {
      backgroundColor: c.tint,
      height: 52,
      width: 52,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    email: { fontSize: 14, fontWeight: "600", color: c.ink },
    secureBadge: { padding: 8, borderRadius: 14, backgroundColor: c.tealTint },
    themeOptions: { flexDirection: "row", gap: 10 },
    themeOption: {
      flex: 1,
      gap: 9,
      alignItems: "center",
      paddingVertical: 17,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.line,
    },
    versionTag: {
      borderRadius: 9,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: c.tealTint,
    },
    navigation: {
      flexDirection: "row",
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderColor: c.line,
      paddingVertical: 7,
    },
    navItem: {
      flex: 1,
      alignItems: "center",
      gap: 3,
      minHeight: 62,
      justifyContent: "center",
    },
    navIcon: { paddingVertical: 6, paddingHorizontal: 23, borderRadius: 17 },
    notice: {
      backgroundColor: c.tint,
      borderRadius: 16,
      padding: 15,
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
    },
    noticeText: { color: c.ink, fontSize: 14, lineHeight: 22, flex: 1 },
    modalBackdrop: { flex: 1, backgroundColor: c.overlay },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 22,
      gap: 14,
    },
    sheetHandle: {
      height: 4,
      width: 40,
      borderRadius: 2,
      backgroundColor: c.line,
      alignSelf: "center",
      marginBottom: 3,
    },
    languageOption: {
      flexDirection: "row",
      gap: 15,
      alignItems: "center",
      paddingVertical: 13,
    },
    languageInitial: {
      height: 45,
      width: 45,
      borderRadius: 14,
      backgroundColor: c.tint,
      alignItems: "center",
      justifyContent: "center",
    },
  });
