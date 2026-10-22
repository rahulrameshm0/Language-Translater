import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  ScrollView,
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
import {
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from "@expo-google-fonts/outfit";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import * as Speech from "expo-speech";
import Constants from "expo-constants";
import { configured, supabase } from "./src/supabase";
import {
  isLanguage,
  isRtlLanguage,
  filterLanguages,
  languages,
  Language,
  languageName,
  Translation,
} from "./src/languages";
import { Colors, ThemePreference, ThemeProvider, useTheme } from "./src/theme";
import { useTranslator } from "./src/useTranslator";
import { useVoice } from "./src/useVoice";
import { useLearning } from "./src/useLearning";
import {
  LearningScreen,
  SaveWordDialog,
  WordDraft,
} from "./src/LearningScreen";
import { SpeakingScreen } from "./src/SpeakingScreen";
import { EarphoneScreen } from "./src/EarphoneScreen";
import { HomeScreen, ToolsScreen, Destination } from "./src/HomeScreen";
import { useMediaInput } from "./src/useMediaInput";
import { MediaWorkspace } from "./src/MediaWorkspace";
import { InputKind } from "./src/mediaFiles";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
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
        borderRadius: 20,
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
          fontFamily: "Outfit_700Bold",
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
function LanguageCover({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme();
  const s = styles(colors);
  return (
    <View style={[s.cover, compact && { minHeight: 128, paddingVertical: 18 }]}>
      <View style={s.coverCopy}>
        <Text
          style={[s.coverTitle, compact && { fontSize: 29, lineHeight: 33 }]}
        >
          Translation{"\n"}studio.
        </Text>
        <View style={s.coverTag}>
          <Icon name="globe-outline" size={14} color="#FFFFFF" />
          <Text style={s.coverTagText}>
            Text, files & audio in 30 languages
          </Text>
        </View>
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={s.glyphStack}
      >
        <View
          style={[
            s.glyphTile,
            {
              backgroundColor: "#DAD5FF",
              top: 0,
              right: 30,
              transform: [{ rotate: "-13deg" }],
            },
          ]}
        >
          <Text style={[s.glyph, { color: "#4135A5" }]}>あ</Text>
        </View>
        <View
          style={[
            s.glyphTile,
            {
              backgroundColor: "#BCEFD8",
              top: 39,
              right: 0,
              transform: [{ rotate: "12deg" }],
            },
          ]}
        >
          <Text style={[s.glyph, { color: "#135F50" }]}>Ա</Text>
        </View>
        <View
          style={[
            s.glyphTile,
            {
              backgroundColor: "#FFFFFF",
              top: 77,
              right: 43,
              transform: [{ rotate: "-6deg" }],
            },
          ]}
        >
          <Text style={[s.glyph, { color: "#3157FF", fontSize: 29 }]}>Aa</Text>
        </View>
      </View>
    </View>
  );
}
function Application() {
  const a = useTranslator();
  const learning = useLearning(a.session?.user.id, a.setMessage);
  const [wordDraft, setWordDraft] = useState<WordDraft | null>(null);
  const [featureBusy, setFeatureBusy] = useState(false);
  const [toolsOverview, setToolsOverview] = useState(true);
  useEffect(() => {
    setWordDraft(null);
    setFeatureBusy(false);
    if (a.session?.user.id) void a.loadHistory(true);
  }, [a.session?.user.id]);
  const { colors: c, dark, preference, setPreference } = useTheme();
  const s = useMemo(() => styles(c), [c]);
  const voice = useVoice(a.setMessage);
  const media = useMediaInput(a.setMessage);
  const [inputMode, setInputMode] = useState<InputKind>("text");
  const [picker, setPicker] = useState<"source" | "target" | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const [languageQuery, setLanguageQuery] = useState("");
  const visibleLanguages = filterLanguages(languageQuery);
  const [speaking, setSpeaking] = useState(false);
  const locked =
    a.busy ||
    voice.recording ||
    voice.working ||
    media.working ||
    media.recording ||
    featureBusy;
  const mediaMode =
    inputMode === "document" ||
    inputMode === "recording" ||
    inputMode === "call";
  const sourceDraft =
    inputMode === "voice" ? voice.transcript : mediaMode ? media.draft : a.text;
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
  }, [a.result, a.target, a.tab]);
  useEffect(() => {
    voice.discard();
    media.clear();
    void Speech.stop();
    setSpeaking(false);
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
  async function submitTranscript() {
    if (a.busy || voice.recording || voice.working || !voice.transcript.trim())
      return;
    Keyboard.dismiss();
    await a.translate(voice.transcript, { inputKind: "voice" });
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
    voice.discard();
    media.clear();
    a.setSource(item.source_language);
    a.setTarget(item.target_language);
    a.setText(item.original_text);
    a.setResult(item.translated_text);
    a.setTab("Translate");
    setInputMode("text");
    a.setMessage("");
  }
  async function exportTranslation() {
    try {
      if (!(await Sharing.isAvailableAsync()))
        throw new Error("Sharing is unavailable on this device.");
      const output = new File(
        Paths.cache,
        `lingobridge-translation-${Date.now()}.txt`,
      );
      output.write(
        `${languages[a.source].name} → ${languages[a.target].name}\n\n${a.text}\n\nTranslation\n${a.result}`,
      );
      await Sharing.shareAsync(output.uri, {
        mimeType: "text/plain",
        dialogTitle: "Export translation",
        UTI: "public.plain-text",
      });
    } catch (error) {
      a.setMessage(
        error instanceof Error
          ? error.message
          : "Could not export the translation. You can still copy it.",
      );
    }
  }
  function changeTool(next: InputKind) {
    if (next === inputMode) return;
    const change = () => {
      media.clear();
      a.setResult("");
      a.setMessage("");
      setInputMode(next);
      Keyboard.dismiss();
    };
    if (media.file || media.draft)
      Alert.alert(
        "Switch translation tool?",
        "The selected file and its unsubmitted text will be cleared.",
        [
          { text: "Keep working", style: "cancel" },
          { text: "Switch tool", onPress: change },
        ],
      );
    else change();
  }
  function saveWord(item?: Translation) {
    const sourceLanguage = item?.source_language ?? a.source;
    const targetLanguage = item?.target_language ?? a.target;
    if (!isLanguage(sourceLanguage) || !isLanguage(targetLanguage)) {
      a.setMessage("Choose a supported language pair to save a learning word.");
      return;
    }
    setWordDraft({
      source: item?.original_text ?? a.text,
      target: item?.translated_text ?? a.result,
      sourceLanguage,
      targetLanguage,
    });
  }
  function openTool(kind: InputKind) {
    if (locked) return;
    const open = () => {
      media.clear();
      a.setResult("");
      a.setMessage("");
      setInputMode(kind);
      setToolsOverview(false);
      a.setTab("Tools");
      Keyboard.dismiss();
    };
    if (media.file || media.draft)
      Alert.alert(
        "Switch translation tool?",
        "The selected file and unsubmitted text will be cleared.",
        [
          { text: "Keep working", style: "cancel" },
          { text: "Switch tool", onPress: open },
        ],
      );
    else open();
  }
  function openDestination(destination: Destination) {
    if (locked) return;
    Keyboard.dismiss();
    a.setMessage("");
    if (destination === "Tools") setToolsOverview(true);
    a.setTab(destination);
    if (destination === "Learn") void learning.load();
  }
  function pickLanguage(side: "source" | "target") {
    Keyboard.dismiss();
    setLanguageQuery("");
    setPicker(side);
  }
  function swapLanguages() {
    a.setSource(a.target);
    a.setTarget(a.source);
    a.setResult("");
    voice.discard();
    media.clear();
  }
  const version = Constants.expoConfig?.version ?? "1.5.0";
  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right", "bottom"]}>
      <StatusBar style={dark ? "light" : "dark"} />
      <View style={s.header}>
        <View style={s.brandRow}>
          <Image
            source={require("./assets/lingobridge-icon.png")}
            style={s.logo}
          />
          <View>
            <Text style={s.brand}>LingoBridge</Text>
            <Text style={s.brandCaption}>Translate your world.</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <IconButton
            label={dark ? "Switch to light mode" : "Switch to dark mode"}
            icon={dark ? "sunny-outline" : "moon-outline"}
            onPress={() => setPreference(dark ? "light" : "dark")}
          />
          {!a.showAuth && (
            <IconButton
              label={
                a.tab === "Account" ? "Back to translation" : "Your account"
              }
              icon={
                a.tab === "Account"
                  ? "arrow-back-outline"
                  : "person-circle-outline"
              }
              disabled={locked}
              onPress={() =>
                a.setTab(a.tab === "Account" ? "Translate" : "Account")
              }
            />
          )}
        </View>
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
                      style={{
                        color: c.teal,
                        fontSize: 13,
                        fontFamily: "Outfit_600SemiBold",
                      }}
                    >
                      30 languages. Endless conversations.
                    </Text>
                  </View>
                  <Text style={s.hero}>
                    {a.mode === "signup"
                      ? "Make yourself understood."
                      : a.mode === "forgot"
                        ? "Let’s get you back in."
                        : a.mode === "reset"
                          ? "A fresh start."
                          : "Speak freely.\nConnect clearly."}
                  </Text>
                  <Text style={s.body}>
                    {a.mode === "forgot"
                      ? "Enter your email to receive a password reset link."
                      : a.mode === "reset"
                        ? "Choose a new password with at least eight characters."
                        : "Type or speak in 30 languages. Review your words, then translate."}
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
                  Your history stays private to your account. Confirmed text is
                  sent to Google Gemini for translation. Live speech is
                  processed by your phone’s speech service.
                </Text>
              </>
            ) : a.tab === "Translate" ? (
              <HomeScreen
                source={a.source}
                target={a.target}
                text={a.text}
                result={a.result}
                history={a.history}
                busy={locked}
                keyboard={keyboard}
                onText={(value) => {
                  a.setText(value);
                  a.setResult("");
                  a.setMessage("");
                }}
                onPick={pickLanguage}
                onSwap={swapLanguages}
                onTranslate={() => {
                  Keyboard.dismiss();
                  void a.translate();
                }}
                onListen={() => void speak()}
                onCopy={() =>
                  void Clipboard.setStringAsync(a.result).then(
                    () => a.setMessage("Translation copied."),
                    () => a.setMessage("Could not copy the translation."),
                  )
                }
                onSave={saveWord}
                onHistory={() => {
                  a.setTab("History");
                  void a.loadHistory(true);
                }}
                onDestination={openDestination}
                onTool={openTool}
                onOpen={openHistory}
              />
            ) : a.tab === "Learn" ? (
              <LearningScreen
                learning={learning}
                report={a.setMessage}
                onAdd={() =>
                  setWordDraft({
                    source: "",
                    target: "",
                    sourceLanguage: a.source,
                    targetLanguage: a.target,
                  })
                }
              />
            ) : a.tab === "Speak" ? (
              <SpeakingScreen
                key={a.session!.user.id}
                userId={a.session!.user.id}
                source={a.source}
                target={a.target}
                onPick={pickLanguage}
                onBusy={setFeatureBusy}
                report={a.setMessage}
                onSave={(source, target, sourceLanguage) =>
                  setWordDraft({
                    source,
                    target,
                    sourceLanguage,
                    targetLanguage: a.target,
                  })
                }
              />
            ) : a.tab === "Earphones" ? (
              <EarphoneScreen
                key={a.session!.user.id}
                source={a.source}
                target={a.target}
                onPick={pickLanguage}
                onSwap={swapLanguages}
                onBusy={setFeatureBusy}
                report={a.setMessage}
                onSave={(source, target) =>
                  setWordDraft({
                    source,
                    target,
                    sourceLanguage: a.source,
                    targetLanguage: a.target,
                  })
                }
              />
            ) : a.tab === "Tools" ? (
              toolsOverview ? (
                <ToolsScreen
                  onTool={openTool}
                  onDestination={openDestination}
                />
              ) : (
                <>
                  <Action
                    label="All tools"
                    quiet
                    small
                    icon="arrow-back-outline"
                    disabled={locked}
                    onPress={() => setToolsOverview(true)}
                  />
                  <View style={s.segment}>
                    {(
                      [
                        { mode: "text", label: "Text", icon: "text-outline" },
                        { mode: "voice", label: "Live", icon: "mic-outline" },
                        {
                          mode: "document",
                          label: "Docs",
                          icon: "document-text-outline",
                        },
                        {
                          mode: "recording",
                          label: "Audio",
                          icon: "musical-notes-outline",
                        },
                        { mode: "call", label: "Calls", icon: "call-outline" },
                      ] as const
                    ).map((tool) => (
                      <Pressable
                        key={tool.mode}
                        accessibilityRole="tab"
                        accessibilityLabel={`${tool.label} translation`}
                        accessibilityState={{
                          selected: inputMode === tool.mode,
                        }}
                        disabled={locked}
                        onPress={() => changeTool(tool.mode)}
                        style={[
                          s.segmentItem,
                          inputMode === tool.mode && s.segmentSelected,
                        ]}
                      >
                        <Icon
                          name={tool.icon}
                          size={21}
                          color={
                            inputMode === tool.mode ? c.accentText : c.muted
                          }
                        />
                        <Text
                          style={[
                            s.segmentLabel,
                            {
                              color:
                                inputMode === tool.mode
                                  ? c.accentText
                                  : c.muted,
                            },
                          ]}
                        >
                          {tool.label}
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
                        setLanguageQuery("");
                        setPicker("source");
                      }}
                    >
                      <Text style={s.smallLabel}>
                        {inputMode === "voice" ? "I’m speaking" : "From"}
                      </Text>
                      <View style={s.inline}>
                        <Text style={s.languageText}>
                          {languages[a.source].name}
                        </Text>
                        <Icon name="chevron-down" size={16} />
                      </View>
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
                        media.clear();
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
                        setLanguageQuery("");
                        setPicker("target");
                      }}
                    >
                      <Text style={s.smallLabel}>Translate to</Text>
                      <View style={s.inline}>
                        <Text style={s.languageText}>
                          {languages[a.target].name}
                        </Text>
                        <Icon name="chevron-down" size={16} />
                      </View>
                    </Pressable>
                  </View>
                  {mediaMode ? (
                    <MediaWorkspace
                      media={media}
                      kind={inputMode as "document" | "recording" | "call"}
                      source={a.source}
                      locked={locked}
                      onEdit={() => {
                        a.setResult("");
                        a.setMessage("");
                      }}
                    />
                  ) : inputMode === "text" ? (
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
                        style={[
                          s.editor,
                          {
                            textAlign: isRtlLanguage(a.source)
                              ? "right"
                              : "left",
                          },
                        ]}
                        placeholder="What would you like to say?"
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
                      <View style={s.voiceStatus}>
                        <View style={s.inline}>
                          <View
                            style={[
                              s.dot,
                              {
                                backgroundColor: voice.recording
                                  ? c.teal
                                  : c.accent,
                              },
                            ]}
                          />
                          <Text
                            style={[
                              s.label,
                              { color: voice.recording ? c.teal : c.accent },
                            ]}
                          >
                            {voice.working
                              ? "Finishing…"
                              : voice.recording
                                ? "Listening live"
                                : voice.transcript
                                  ? "Ready to review"
                                  : "Speak in " + languages[a.source].name}
                          </Text>
                        </View>
                        <Text style={s.caption}>
                          {voice.recording
                            ? `0:${String(voice.seconds).padStart(2, "0")} / 1:00`
                            : "Live transcript"}
                        </Text>
                      </View>
                      <TextInput
                        accessibilityLabel="Voice transcript. Review and edit before translating"
                        accessibilityHint="Words appear while you speak. Stop listening to edit them."
                        multiline
                        textAlignVertical="top"
                        editable={!locked}
                        placeholder={
                          voice.recording
                            ? "Your words will appear here as you speak…"
                            : "Tap the microphone and start speaking."
                        }
                        placeholderTextColor={c.muted}
                        style={[
                          s.editor,
                          s.liveEditor,
                          {
                            textAlign: isRtlLanguage(a.source)
                              ? "right"
                              : "left",
                          },
                        ]}
                        value={voice.transcript}
                        onChangeText={(value) => {
                          voice.editTranscript(value);
                          a.setResult("");
                          a.setMessage("");
                        }}
                      />
                      <View style={s.voiceFooter}>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={s.panelTitle}>
                            {voice.recording
                              ? "Speak naturally"
                              : voice.transcript
                                ? "Did we get that right?"
                                : "Speak. See. Review."}
                          </Text>
                          <Text style={s.caption}>
                            {voice.recording
                              ? "Tap stop to review your words."
                              : voice.transcript
                                ? "Edit any words above before submitting."
                                : "Up to 60 seconds. You’re in control."}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={
                            voice.recording
                              ? "Stop listening and review transcript"
                              : voice.transcript
                                ? "Record again and replace transcript"
                                : "Start live transcription"
                          }
                          disabled={a.busy || voice.working}
                          onPress={() => {
                            if (voice.recording) voice.stop();
                            else {
                              const begin = () => {
                                a.setResult("");
                                void Speech.stop().then(() => {
                                  setSpeaking(false);
                                  return voice.start(
                                    languages[a.source].locale,
                                  );
                                });
                              };
                              if (voice.transcript.trim())
                                Alert.alert(
                                  "Replace this transcript?",
                                  "Starting again replaces the words above.",
                                  [
                                    { text: "Keep text", style: "cancel" },
                                    { text: "Record again", onPress: begin },
                                  ],
                                );
                              else begin();
                            }
                          }}
                          style={[
                            s.recordButton,
                            voice.recording && { backgroundColor: c.error },
                          ]}
                        >
                          <Icon
                            name={voice.recording ? "stop" : "mic"}
                            size={27}
                            color={voice.recording ? "#FFFFFF" : c.accentText}
                          />
                        </Pressable>
                      </View>
                      {!voice.recording && !!voice.transcript && (
                        <View style={s.spaceBetween}>
                          <Text
                            style={[
                              s.caption,
                              Array.from(voice.transcript).length > 5000 && {
                                color: c.error,
                              },
                            ]}
                          >
                            {Array.from(
                              voice.transcript,
                            ).length.toLocaleString()}{" "}
                            / 5,000
                          </Text>
                          <Action
                            label="Clear transcript"
                            small
                            quiet
                            disabled={locked}
                            onPress={() => {
                              voice.discard();
                              a.setResult("");
                            }}
                          />
                        </View>
                      )}
                    </View>
                  )}
                  <Action
                    label={
                      a.busy
                        ? "Translating…"
                        : inputMode !== "text"
                          ? "Confirm & translate"
                          : "Translate text"
                    }
                    icon={a.busy ? "hourglass-outline" : "arrow-forward"}
                    disabled={
                      locked ||
                      !sourceDraft.trim() ||
                      Array.from(sourceDraft).length > 5000
                    }
                    onPress={() => {
                      Keyboard.dismiss();
                      if (inputMode === "voice") void submitTranscript();
                      else if (mediaMode)
                        void a.translate(media.draft, {
                          inputKind: inputMode,
                          sourceName: media.file?.name,
                        });
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
                      <Text
                        selectable
                        style={[
                          s.translated,
                          {
                            textAlign: isRtlLanguage(a.target)
                              ? "right"
                              : "left",
                          },
                        ]}
                      >
                        {a.result}
                      </Text>
                      <View style={[s.resultActions, { flexWrap: "wrap" }]}>
                        <Action
                          label="Learn phrase"
                          small
                          quiet
                          icon="bookmark-outline"
                          onPress={() => saveWord()}
                        />
                        <Action
                          label="Export TXT"
                          small
                          quiet
                          icon="share-outline"
                          onPress={() => void exportTranslation()}
                        />
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
                  {inputMode !== "text" && (
                    <Text style={s.reviewNote}>
                      {mediaMode
                        ? "Review the extracted text, make any corrections, then tap Confirm & translate."
                        : "Nothing is translated until you confirm. Stop listening, check the words, then tap Confirm & translate."}
                    </Text>
                  )}
                  <Text style={s.footnote}>
                    AI translations can make mistakes. Submitted text is
                    processed by Gemini. Live speech uses your phone’s
                    recognition service.
                  </Text>
                </>
              )
            ) : a.tab === "History" ? (
              <>
                <View style={s.sectionHeading}>
                  <View>
                    <Text style={s.title}>Saved words.</Text>
                    <Text style={s.body}>Your translations, in one place.</Text>
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
                    <Text style={s.panelTitle}>Your history starts here.</Text>
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
                    {item.source_name && (
                      <Text style={s.caption}>
                        {item.input_kind === "call"
                          ? "Call recording"
                          : item.input_kind === "document"
                            ? "Document"
                            : item.input_kind === "recording"
                              ? "Audio"
                              : item.input_kind === "voice"
                                ? "Voice"
                                : "Text"}{" "}
                        · {item.source_name}
                      </Text>
                    )}
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
                              fontFamily: "Outfit_600SemiBold",
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
                      <Text style={s.panelTitle}>LingoBridge {version}</Text>
                    </View>
                    <View style={s.versionTag}>
                      <Text
                        style={{
                          color: c.teal,
                          fontSize: 12,
                          fontFamily: "Outfit_700Bold",
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
                    Your history is private to your account. Confirmed text is
                    processed by Google Gemini. Speech recognition uses your
                    phone’s speech service. Free-tier content may be used to
                    improve its products.
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
                  { name: "Learn", icon: "book-outline" },
                  { name: "Speak", icon: "mic-outline" },
                  { name: "Tools", icon: "grid-outline" },
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
                    if (item.name === "Learn") void learning.load();
                    if (item.name === "Tools") setToolsOverview(true);
                  }}
                  style={s.navItem}
                >
                  <View
                    style={[
                      s.navIcon,
                      a.tab === item.name && { backgroundColor: c.navSelected },
                    ]}
                  >
                    <Icon
                      name={item.icon}
                      size={23}
                      color={a.tab === item.name ? c.navActive : c.navMuted}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily:
                        a.tab === item.name
                          ? "Outfit_600SemiBold"
                          : "Outfit_500Medium",
                      color: a.tab === item.name ? c.navActive : c.navMuted,
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
      <SaveWordDialog
        draft={wordDraft}
        busy={learning.busy}
        onClose={() => setWordDraft(null)}
        onSave={async (draft) => {
          const saved = await learning.save(
            draft.source,
            draft.target,
            draft.sourceLanguage,
            draft.targetLanguage,
          );
          if (saved) void learning.load();
          return saved;
        }}
      />
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
            <View style={s.searchBox}>
              <Icon name="search-outline" color={c.muted} size={20} />
              <TextInput
                accessibilityLabel="Search 30 languages"
                placeholder="Search language or native name"
                placeholderTextColor={c.muted}
                value={languageQuery}
                onChangeText={setLanguageQuery}
                autoCapitalize="none"
                autoCorrect={false}
                style={s.searchInput}
              />
              {!!languageQuery && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear language search"
                  onPress={() => setLanguageQuery("")}
                  style={{ padding: 8 }}
                >
                  <Icon name="close-circle" size={18} color={c.muted} />
                </Pressable>
              )}
            </View>
            <Text style={s.caption}>
              {visibleLanguages.length}{" "}
              {visibleLanguages.length === 1 ? "language" : "languages"}
            </Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {visibleLanguages.length === 0 && (
                <Text style={[s.body, { paddingVertical: 24 }]}>
                  No matching language. Try its English or native name.
                </Text>
              )}
              {visibleLanguages.map((code) => (
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
                      if (picker === "source") media.clear();
                      a.chooseLanguage(code, picker);
                      voice.discard();
                    }
                    setPicker(null);
                  }}
                >
                  <View style={s.languageInitial}>
                    <Text
                      style={{ color: c.accent, fontFamily: "Outfit_700Bold" }}
                    >
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
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
export default function App() {
  const [loaded, error] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });
  if (!loaded && !error)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#EEF2FA",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color="#3157FF" />
      </View>
    );
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
      borderBottomWidth: 0,
      borderColor: c.line,
    },
    brandRow: { flexDirection: "row", gap: 11, alignItems: "center" },
    logo: { width: 41, height: 41, borderRadius: 13 },
    brand: {
      fontSize: 22,
      fontFamily: "Outfit_700Bold",
      letterSpacing: -0.8,
      color: c.ink,
    },
    brandCaption: { fontSize: 10, color: c.muted, marginTop: 2 },
    page: {
      padding: 20,
      paddingBottom: 28,
      gap: 14,
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
      fontSize: 38,
      lineHeight: 44,
      fontFamily: "Outfit_700Bold",
      letterSpacing: -1.5,
      color: c.ink,
      marginBottom: 5,
    },
    hero: {
      fontSize: 40,
      lineHeight: 47,
      fontFamily: "Outfit_700Bold",
      letterSpacing: -1.4,
      color: c.ink,
    },
    body: {
      fontFamily: "Outfit_400Regular",
      fontSize: 15,
      lineHeight: 23,
      color: c.muted,
    },
    caption: {
      fontFamily: "Outfit_400Regular",
      fontSize: 12,
      lineHeight: 18,
      color: c.muted,
    },
    label: { fontSize: 13, fontFamily: "Outfit_600SemiBold", color: c.muted },
    smallLabel: { fontSize: 11, color: c.muted },
    panelTitle: {
      fontSize: 18,
      fontFamily: "Outfit_700Bold",
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
      borderRadius: 22,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.line,
    },
    segmentItem: {
      flex: 1,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
    },
    segmentSelected: { backgroundColor: c.accent },
    segmentLabel: { fontSize: 11, fontFamily: "Outfit_600SemiBold" },
    languageRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: c.surface,
      borderRadius: 24,
      padding: 6,
    },
    languageButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 5,
      backgroundColor: c.surface,
      borderWidth: 0,
      borderColor: c.line,
      borderRadius: 17,
    },
    languageText: {
      fontSize: 15,
      fontFamily: "Outfit_600SemiBold",
      color: c.ink,
    },
    inline: { flexDirection: "row", alignItems: "center", gap: 7 },
    spaceBetween: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    composer: {
      backgroundColor: c.surface,
      borderRadius: 28,
      padding: 22,
      borderWidth: 0,
      borderColor: c.line,
    },
    editor: {
      fontFamily: "Outfit_400Regular",
      fontSize: 24,
      lineHeight: 35,
      color: c.ink,
      minHeight: 110,
      maxHeight: 320,
      paddingTop: 12,
      paddingBottom: 18,
    },
    resultPanel: {
      backgroundColor: c.tint,
      borderRadius: 28,
      padding: 22,
      gap: 20,
    },
    dot: { height: 7, width: 7, borderRadius: 4, backgroundColor: c.teal },
    translated: {
      fontFamily: "Outfit_500Medium",
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
      borderRadius: 28,
      padding: 22,
      gap: 12,
      borderWidth: 1,
      borderColor: c.line,
    },
    voiceStatus: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    liveEditor: { minHeight: 200, maxHeight: 360, paddingTop: 16 },
    voiceFooter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      borderTopWidth: 1,
      borderColor: c.line,
      paddingTop: 16,
    },
    recordButton: {
      height: 60,
      width: 60,
      borderRadius: 22,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    reviewNote: {
      fontSize: 13,
      lineHeight: 21,
      color: c.muted,
      paddingHorizontal: 4,
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
      fontFamily: "Outfit_600SemiBold",
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
    email: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: c.ink },
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
      backgroundColor: c.bg,
      borderTopWidth: 1,
      borderColor: c.line,
      paddingVertical: 5,
      marginHorizontal: 0,
      marginBottom: 0,
      borderRadius: 0,
    },
    navItem: {
      flex: 1,
      alignItems: "center",
      gap: 3,
      minHeight: 62,
      justifyContent: "center",
    },
    navIcon: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 17 },
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
      maxHeight: "86%",
      backgroundColor: c.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 22,
      gap: 14,
    },
    cover: {
      backgroundColor: "#3157FF",
      minHeight: 150,
      borderRadius: 30,
      padding: 22,
      flexDirection: "row",
      alignItems: "center",
      overflow: "hidden",
    },
    coverCopy: { flex: 1, gap: 17, zIndex: 1 },
    coverTitle: {
      fontFamily: "Outfit_700Bold",
      fontSize: 30,
      lineHeight: 35,
      letterSpacing: -1.1,
      color: "#FFFFFF",
      maxWidth: "76%",
    },
    coverTag: {
      maxWidth: "73%",
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 5,
    },
    coverTagText: {
      flexShrink: 1,
      fontFamily: "Outfit_500Medium",
      fontSize: 11,
      color: "#FFFFFF",
    },
    glyphStack: {
      position: "absolute",
      width: 110,
      height: 150,
      right: -6,
      top: 14,
    },
    glyphTile: {
      position: "absolute",
      height: 62,
      width: 62,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    glyph: { fontSize: 35, fontFamily: "Outfit_600SemiBold" },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.secondary,
      paddingHorizontal: 14,
      borderRadius: 18,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      minHeight: 52,
      fontSize: 15,
      fontFamily: "Outfit_400Regular",
      color: c.ink,
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
