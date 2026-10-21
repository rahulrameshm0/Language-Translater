import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import type { Session } from "@supabase/supabase-js";
import { configured, supabase } from "./src/supabase";
import { languages, Language, Translation } from "./src/languages";
const callback = "threewords://auth/callback";
const resetCallback = "threewords://auth/reset";
type Mode = "signin" | "signup" | "forgot" | "reset";
function Button({
  label,
  onPress,
  disabled = false,
  quiet = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  quiet?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        quiet && s.quiet,
        (disabled || pressed) && { opacity: 0.5 },
      ]}
    >
      <Text style={[s.buttonText, quiet && { color: "#184F9E" }]}>{label}</Text>
    </Pressable>
  );
}
function Application() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<"Translate" | "History" | "Account">(
    "Translate",
  );
  const [source, setSource] = useState<Language>("en");
  const [target, setTarget] = useState<Language>("ml");
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Translation[]>([]);
  const [more, setMore] = useState(true);
  const [historyBusy, setHistoryBusy] = useState(false);
  const generation = useRef(0);
  const historyLock = useRef(false);
  const pendingRecovery = useRef(false);
  const seenLinks = useRef(new Set<string>());
  const activeUser = useRef<string | null>(null);
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (activeUser.current !== (next?.user.id ?? null)) {
        generation.current++;
        setHistory([]);
        setResult("");
        setText("");
        setMessage("");
        setPassword("");
        activeUser.current = next?.user.id ?? null;
      }
      setSession(next);
      setReady(true);
      if (event === "PASSWORD_RECOVERY") {
        pendingRecovery.current = true;
        setMode("reset");
      }
      if (event === "SIGNED_OUT") {
        setMode("signin");
        setTab("Translate");
        pendingRecovery.current = false;
      }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setMessage(error.message);
      activeUser.current = data.session?.user.id ?? null;
      setSession(data.session);
      setReady(true);
    });
    async function handleURL(url: string) {
      if (!url.startsWith(callback) && !url.startsWith(resetCallback)) return;
      if (seenLinks.current.has(url)) return;
      seenLinks.current.add(url);
      const parsed = new URL(url);
      const params = new URLSearchParams(parsed.search || parsed.hash.slice(1));
      if (params.get("error_description")) {
        setMessage(params.get("error_description")!);
        return;
      }
      const code = params.get("code");
      if (!code) {
        setMessage("This link is incomplete. Request a new email link.");
        return;
      }
      const recovery = url.startsWith(resetCallback);
      if (recovery) {
        pendingRecovery.current = true;
        setMode("reset");
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        pendingRecovery.current = false;
        setMode("signin");
        setMessage(
          "This link expired or was opened on a different device. Request a new link on this device.",
        );
      }
    }
    Linking.getInitialURL().then((url) => {
      if (url) void handleURL(url);
    });
    const listener = Linking.addEventListener(
      "url",
      ({ url }) => void handleURL(url),
    );
    return () => {
      subscription.unsubscribe();
      listener.remove();
    };
  }, []);
  async function authenticate() {
    setBusy(true);
    setMessage("");
    try {
      if (mode !== "forgot" && password.length < 8)
        throw new Error("Use a password with at least 8 characters.");
      if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        pendingRecovery.current = false;
        setMode("signin");
        setPassword("");
        setMessage("Password updated.");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: resetCallback },
        );
        if (error) throw error;
        setMessage(
          "If an account exists, a reset link is on its way. Open it on this device.",
        );
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: callback },
        });
        if (error) throw error;
        setMessage(
          "Check your email to confirm your account. Open the link on this device.",
        );
        setPassword("");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Unable to connect. Check your internet connection.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function translate() {
    const current = generation.current;
    setBusy(true);
    setMessage("");
    setResult("");
    try {
      const { data, error } = await supabase.functions.invoke("translate", {
        body: { text, sourceLanguage: source, targetLanguage: target },
      });
      if (error) {
        let detail = "Unable to connect. Check your connection and try again.";
        if (error.context instanceof Response) {
          const body = await error.context.json().catch(() => null);
          detail = body?.error ?? detail;
        }
        throw new Error(detail);
      }
      if (current !== generation.current) return;
      if (typeof data?.translatedText !== "string")
        throw new Error("No translation received. Try again.");
      setResult(data.translatedText);
      if (data.warning) setMessage(data.warning);
    } catch (e) {
      if (current === generation.current)
        setMessage(
          e instanceof Error ? e.message : "Translation failed. Try again.",
        );
    } finally {
      setBusy(false);
    }
  }
  async function loadHistory(refresh = false) {
    if (historyLock.current) return;
    historyLock.current = true;
    setHistoryBusy(true);
    setMessage("");
    const current = generation.current;
    try {
      let query = supabase
        .from("translations")
        .select(
          "id,source_language,target_language,original_text,translated_text,created_at",
        )
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(20);
      const last = refresh ? null : history[history.length - 1];
      if (last)
        query = query.or(
          `created_at.lt.${last.created_at},and(created_at.eq.${last.created_at},id.lt.${last.id})`,
        );
      const { data, error } = await query;
      if (error) throw error;
      if (current !== generation.current) return;
      setHistory((old) =>
        refresh
          ? (data as Translation[])
          : [...old, ...(data as Translation[])],
      );
      setMore(data.length === 20);
    } catch (e) {
      if (current === generation.current)
        setMessage(
          e instanceof Error ? e.message : "Could not load history. Try again.",
        );
    } finally {
      historyLock.current = false;
      setHistoryBusy(false);
    }
  }
  async function deleteRecord(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase
        .from("translations")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setHistory((old) => old.filter((item) => item.id !== id));
    } catch {
      setMessage(
        "Could not delete translation. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function chooseLanguage(value: Language, side: "source" | "target") {
    setResult("");
    setMessage("");
    if (side === "source") {
      if (value === target) setTarget(source);
      setSource(value);
    } else {
      if (value === source) setSource(target);
      setTarget(value);
    }
  }
  if (!configured)
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.page}>
          <Text style={s.brand}>Vaylo</Text>
          <Text style={s.title}>Connect your services</Text>
          <Text style={s.body}>
            Add your Supabase project URL and publishable key to .env, then
            restart Expo. Follow README.md to configure authentication, the
            database, and translation.
          </Text>
        </View>
      </SafeAreaView>
    );
  if (!ready)
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator
          accessibilityLabel="Restoring your session"
          style={{ flex: 1 }}
          color="#184F9E"
        />
      </SafeAreaView>
    );
  const showAuth = !session || mode === "reset" || pendingRecovery.current;
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.page}
        >
          <View style={s.masthead}>
            <Text style={s.brand}>
              Vaylo<Text style={{ color: "#3376C6" }}> /</Text>
            </Text>
            <Text style={s.native}>Hello · Hola · നമസ്കാരം</Text>
          </View>
          {showAuth ? (
            <>
              <Text style={s.title}>
                {mode === "signup"
                  ? "A world of words."
                  : mode === "forgot"
                    ? "Reset your password"
                    : mode === "reset"
                      ? "Choose a new password"
                      : "Make yourself understood."}
              </Text>
              <Text style={s.body}>
                {mode === "signup"
                  ? "Create an account to translate and keep your conversations close."
                  : mode === "forgot"
                    ? "We’ll email you a link to get back in."
                    : mode === "reset"
                      ? "Choose at least eight characters."
                      : "English, Spanish, and Malayalam. Your words, a little further."}
              </Text>
              {mode !== "reset" && (
                <>
                  <Text style={s.label}>Email</Text>
                  <TextInput
                    style={s.input}
                    accessibilityLabel="Email"
                    placeholder="you@example.com"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    value={email}
                    onChangeText={setEmail}
                  />
                </>
              )}
              {mode !== "forgot" && (
                <>
                  <Text style={s.label}>Password</Text>
                  <TextInput
                    style={s.input}
                    accessibilityLabel="Password"
                    secureTextEntry
                    textContentType={
                      mode === "signin" ? "password" : "newPassword"
                    }
                    value={password}
                    onChangeText={setPassword}
                  />
                </>
              )}
              <Button
                label={
                  busy
                    ? "Please wait…"
                    : mode === "signup"
                      ? "Create account"
                      : mode === "forgot"
                        ? "Send reset link"
                        : mode === "reset"
                          ? "Update password"
                          : "Sign in"
                }
                onPress={() => void authenticate()}
                disabled={busy || (mode !== "reset" && !email.trim())}
              />
              {mode !== "reset" && (
                <View style={{ gap: 4 }}>
                  <Button
                    quiet
                    label={
                      mode === "signin"
                        ? "Create an account"
                        : "Back to sign in"
                    }
                    disabled={busy}
                    onPress={() => {
                      setMode(mode === "signin" ? "signup" : "signin");
                      setMessage("");
                      setPassword("");
                    }}
                  />
                  {mode === "signin" && (
                    <Button
                      quiet
                      label="Forgot password?"
                      disabled={busy}
                      onPress={() => {
                        setMode("forgot");
                        setMessage("");
                        setPassword("");
                      }}
                    />
                  )}
                </View>
              )}
            </>
          ) : (
            <>
              <View style={s.tabs}>
                {(["Translate", "History", "Account"] as const).map((name) => (
                  <Pressable
                    key={name}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: tab === name }}
                    style={[s.tab, tab === name && s.selectedTab]}
                    onPress={() => {
                      setTab(name);
                      setMessage("");
                      if (name === "History") void loadHistory(true);
                    }}
                  >
                    <Text
                      style={[s.tabText, tab === name && { color: "#184F9E" }]}
                    >
                      {name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {tab === "Translate" && (
                <>
                  <Text style={s.title}>What would you like to say?</Text>
                  <View style={s.languageGrid}>
                    {(["source", "target"] as const).map((side) => (
                      <View key={side} style={{ flex: 1, gap: 6 }}>
                        <Text style={s.label}>
                          {side === "source" ? "From" : "To"}
                        </Text>
                        {(Object.keys(languages) as Language[]).map((code) => (
                          <Pressable
                            key={code}
                            disabled={busy}
                            accessibilityRole="radio"
                            accessibilityState={{
                              selected:
                                (side === "source" ? source : target) === code,
                            }}
                            onPress={() => chooseLanguage(code, side)}
                            style={[
                              s.language,
                              (side === "source" ? source : target) === code &&
                                s.activeLanguage,
                            ]}
                          >
                            <Text
                              style={{
                                color:
                                  (side === "source" ? source : target) === code
                                    ? "#184F9E"
                                    : "#41526A",
                                fontSize: 16,
                              }}
                            >
                              {languages[code]}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    ))}
                  </View>
                  <Button
                    quiet
                    label="Swap languages ⇄"
                    disabled={busy}
                    onPress={() => {
                      setSource(target);
                      setTarget(source);
                      if (result) setText(result);
                      setResult("");
                      setMessage("");
                    }}
                  />
                  <View style={s.writing}>
                    <Text style={s.label}>{languages[source]}</Text>
                    <TextInput
                      style={s.editor}
                      multiline
                      textAlignVertical="top"
                      editable={!busy}
                      accessibilityLabel="Text to translate"
                      placeholder="Type or paste your text…"
                      value={text}
                      onChangeText={(value) => {
                        setText(value);
                        setResult("");
                        setMessage("");
                      }}
                    />
                    <Text
                      style={[
                        s.counter,
                        Array.from(text).length > 5000 && { color: "#A32632" },
                      ]}
                    >
                      {Array.from(text).length.toLocaleString()} / 5,000
                    </Text>
                  </View>
                  <Button
                    label={busy ? "Translating…" : "Translate"}
                    disabled={
                      busy || !text.trim() || Array.from(text).length > 5000
                    }
                    onPress={() => void translate()}
                  />
                  {result !== "" && (
                    <View style={s.result}>
                      <Text style={s.label}>{languages[target]}</Text>
                      <Text selectable style={s.translation}>
                        {result}
                      </Text>
                      <Button
                        quiet
                        label="Copy translation"
                        onPress={() => {
                          void Clipboard.setStringAsync(result).then(
                            () => setMessage("Translation copied."),
                            () =>
                              setMessage(
                                "Could not copy. Select the translation to copy it.",
                              ),
                          );
                        }}
                      />
                    </View>
                  )}
                </>
              )}
              {tab === "History" && (
                <>
                  <Text style={s.title}>Words you’ve kept.</Text>
                  <Text style={s.body}>
                    Your translations, ready for another conversation.
                  </Text>
                  <Button
                    quiet
                    label="Refresh history"
                    disabled={historyBusy}
                    onPress={() => void loadHistory(true)}
                  />
                  {!history.length && !historyBusy && (
                    <Text style={s.body}>
                      No saved translations yet. Translate something to start
                      your history.
                    </Text>
                  )}
                  {history.map((item) => (
                    <View key={item.id} style={s.history}>
                      <Text style={s.label}>
                        {languages[item.source_language]} →{" "}
                        {languages[item.target_language]}
                      </Text>
                      <Text style={s.body}>
                        {new Date(item.created_at).toLocaleString()}
                      </Text>
                      <Text numberOfLines={3} style={s.original}>
                        {item.original_text}
                      </Text>
                      <Text numberOfLines={4} style={s.translation}>
                        {item.translated_text}
                      </Text>
                      <View style={{ flexDirection: "row" }}>
                        <Button
                          quiet
                          label="Open"
                          disabled={busy}
                          onPress={() => {
                            setSource(item.source_language);
                            setTarget(item.target_language);
                            setText(item.original_text);
                            setResult(item.translated_text);
                            setTab("Translate");
                            setMessage("");
                          }}
                        />
                        <Button
                          quiet
                          label="Delete"
                          disabled={busy}
                          onPress={() =>
                            Alert.alert(
                              "Delete translation?",
                              "This removes it from your history.",
                              [
                                { text: "Cancel", style: "cancel" },
                                {
                                  text: "Delete",
                                  style: "destructive",
                                  onPress: () => void deleteRecord(item.id),
                                },
                              ],
                            )
                          }
                        />
                      </View>
                    </View>
                  ))}
                  {historyBusy ? (
                    <ActivityIndicator color="#184F9E" />
                  ) : (
                    more &&
                    history.length > 0 && (
                      <Button
                        quiet
                        label="Load more"
                        onPress={() => void loadHistory()}
                      />
                    )
                  )}
                </>
              )}
              {tab === "Account" && (
                <>
                  <Text style={s.title}>Your account.</Text>
                  <Text style={s.label}>Signed in as</Text>
                  <Text selectable style={s.body}>
                    {session.user.email}
                  </Text>
                  <Text style={s.body}>
                    Your translation history is private to your account. Text is
                    sent to Google Gemini for translation and stored in your
                    history. Google may use free-tier text to improve its
                    products. Avoid sensitive text.
                  </Text>
                  <Button
                    quiet
                    label="Send password reset email"
                    disabled={busy}
                    onPress={async () => {
                      setBusy(true);
                      const { error } =
                        await supabase.auth.resetPasswordForEmail(
                          session.user.email!,
                          { redirectTo: resetCallback },
                        );
                      setMessage(
                        error
                          ? error.message
                          : "Reset link sent. Open it on this device.",
                      );
                      setBusy(false);
                    }}
                  />
                  <Button
                    label="Sign out"
                    disabled={busy}
                    onPress={async () => {
                      setBusy(true);
                      const { error } = await supabase.auth.signOut();
                      if (error) setMessage(error.message);
                      setBusy(false);
                    }}
                  />
                </>
              )}
            </>
          )}
          {message !== "" && (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={s.notice}
            >
              {message}
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <Application />
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7FAFF" },
  page: {
    padding: 24,
    paddingBottom: 48,
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    gap: 14,
  },
  masthead: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: "#D5E1F2",
    marginBottom: 12,
  },
  brand: {
    fontSize: 25,
    fontWeight: "800",
    color: "#153459",
    letterSpacing: -1,
  },
  native: { fontSize: 14, color: "#586D85", marginTop: 8, lineHeight: 24 },
  title: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1.1,
    color: "#153459",
    lineHeight: 41,
    marginVertical: 10,
  },
  body: { fontSize: 16, lineHeight: 25, color: "#52647A" },
  label: { fontSize: 14, fontWeight: "600", color: "#415873" },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#BBCDE4",
    borderRadius: 12,
    padding: 16,
    fontSize: 17,
    color: "#153459",
    minHeight: 54,
  },
  button: {
    backgroundColor: "#184F9E",
    borderRadius: 12,
    paddingVertical: 17,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  quiet: { backgroundColor: "transparent" },
  buttonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#D5E1F2" },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: 3,
    borderColor: "transparent",
  },
  selectedTab: { borderColor: "#184F9E" },
  tabText: { fontSize: 15, fontWeight: "600", color: "#63748A" },
  languageGrid: { flexDirection: "row", gap: 12 },
  language: {
    padding: 13,
    borderWidth: 1,
    borderColor: "#D5E1F2",
    borderRadius: 10,
    minHeight: 48,
    justifyContent: "center",
  },
  activeLanguage: { backgroundColor: "#E4EEFF", borderColor: "#3376C6" },
  writing: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#BBCDE4",
    borderRadius: 16,
    padding: 18,
  },
  editor: {
    minHeight: 155,
    fontSize: 21,
    lineHeight: 32,
    color: "#153459",
    marginVertical: 12,
  },
  counter: { fontSize: 12, color: "#63748A", textAlign: "right" },
  result: {
    backgroundColor: "#E9F2FF",
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  translation: { fontSize: 22, lineHeight: 34, color: "#153459" },
  notice: {
    backgroundColor: "#E8EEF7",
    padding: 16,
    borderRadius: 10,
    color: "#233F65",
    fontSize: 15,
    lineHeight: 23,
  },
  history: {
    borderBottomWidth: 1,
    borderColor: "#D5E1F2",
    paddingVertical: 18,
    gap: 10,
  },
  original: { fontSize: 16, lineHeight: 25, color: "#52647A" },
});
