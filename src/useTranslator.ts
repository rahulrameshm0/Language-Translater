import { useEffect, useRef, useState } from "react";
import * as Linking from "expo-linking";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Language, Translation } from "./languages";
const callback = "threewords://auth/callback";
const resetCallback = "threewords://auth/reset";
type Mode = "signin" | "signup" | "forgot" | "reset";
export function useTranslator() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<"Translate" | "History" | "Account">(
    "Translate",
  );
  const [source, setSource] = useState<Language>("en");
  const [target, setTarget] = useState<Language>("es");
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
  async function translate(audio?: { audioBase64: string; mimeType: string }) {
    const current = generation.current;
    setBusy(true);
    setMessage("");
    setResult("");
    try {
      const { data, error } = await supabase.functions.invoke("translate", {
        body: {
          ...(audio ?? { text }),
          sourceLanguage: source,
          targetLanguage: target,
        },
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
      if (audio && typeof data.originalText === "string")
        setText(data.originalText);
      if (data.warning) setMessage(data.warning);
      return true;
    } catch (e) {
      if (current === generation.current)
        setMessage(
          e instanceof Error ? e.message : "Translation failed. Try again.",
        );
    } finally {
      setBusy(false);
    }
    return false;
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

  return {
    session,
    ready,
    mode,
    setMode,
    email,
    setEmail,
    password,
    setPassword,
    tab,
    setTab,
    source,
    setSource,
    target,
    setTarget,
    text,
    setText,
    result,
    setResult,
    message,
    setMessage,
    busy,
    history,
    more,
    historyBusy,
    authenticate,
    translate,
    loadHistory,
    deleteRecord,
    chooseLanguage,
    showAuth: !session || mode === "reset" || pendingRecovery.current,
  };
}
