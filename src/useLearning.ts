import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { isLanguage, Language } from "./languages";
import { localDay, validCardText } from "./practice";
export type LearningCard = {
  id: string;
  source_language: Language;
  target_language: Language;
  source_text: string;
  translation: string;
  due_at: string;
  review_count: number;
};
export function useLearning(
  userId: string | undefined,
  report: (message: string) => void,
) {
  const [cards, setCards] = useState<LearningCard[]>([]),
    [goal, setGoal] = useState(5),
    [completed, setCompleted] = useState(0),
    [busy, setBusy] = useState(false),
    [more, setMore] = useState(false);
  const owner = useRef(userId),
    request = useRef(0),
    lock = useRef(false),
    reportRef = useRef(report);
  reportRef.current = report;
  owner.current = userId;
  const load = useCallback(
    async (append = false) => {
      if (!userId || lock.current) return;
      lock.current = true;
      setBusy(true);
      const token = ++request.current;
      try {
        const start = append ? cards.length : 0;
        const timezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        const settings = await supabase
          .from("study_settings")
          .select("daily_goal,time_zone")
          .eq("user_id", userId)
          .maybeSingle();
        if (settings.error) throw settings.error;
        if (!settings.data) {
          const created = await supabase
            .from("study_settings")
            .insert({ user_id: userId, daily_goal: 5, time_zone: timezone });
          if (created.error && created.error.code !== "23505")
            throw created.error;
        } else if (settings.data.time_zone !== timezone) {
          const saved = await supabase
            .from("study_settings")
            .update({ time_zone: timezone })
            .eq("user_id", userId);
          if (saved.error) throw saved.error;
        }
        const [list, reviews] = await Promise.all([
          supabase
            .from("learning_cards")
            .select(
              "id,source_language,target_language,source_text,translation,due_at,review_count",
            )
            .order("due_at")
            .order("id")
            .range(start, start + 49),
          supabase
            .from("learning_reviews")
            .select("card_id", { count: "exact", head: true })
            .eq("review_date", localDay()),
        ]);
        if (list.error) throw list.error;
        if (reviews.error) throw reviews.error;
        if (owner.current !== userId || request.current !== token) return;
        const next = list.data.filter(
          (row) =>
            isLanguage(row.source_language) && isLanguage(row.target_language),
        ) as LearningCard[];
        setCards((old) => (append ? [...old, ...next] : next));
        setMore(list.data.length === 50);
        setGoal(settings.data?.daily_goal ?? 5);
        setCompleted(reviews.count ?? 0);
      } catch {
        if (owner.current === userId)
          reportRef.current(
            "Could not load your word collection. Check your connection and tap Refresh.",
          );
      } finally {
        if (request.current === token) {
          lock.current = false;
          setBusy(false);
        }
      }
    },
    [userId, cards.length],
  );
  useEffect(() => {
    request.current++;
    lock.current = false;
    setCards([]);
    setCompleted(0);
    setGoal(5);
    setBusy(false);
    if (userId) void load();
  }, [userId]);
  async function save(
    source: string,
    target: string,
    sourceLanguage: Language,
    targetLanguage: Language,
  ) {
    if (!userId || lock.current) return false;
    if (!validCardText(source, target)) {
      reportRef.current(
        "Choose a word or short phrase of up to 300 characters on each side.",
      );
      return false;
    }
    lock.current = true;
    setBusy(true);
    const token = ++request.current;
    try {
      const { error } = await supabase.from("learning_cards").insert({
        user_id: userId,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        source_text: source.trim(),
        translation: target.trim(),
      });
      if (error && error.code !== "23505") throw error;
      if (owner.current !== userId) return false;
      reportRef.current(
        error
          ? "This word is already in your collection."
          : "Saved to your word collection.",
      );
      return true;
    } catch {
      if (owner.current === userId)
        reportRef.current(
          "Could not save this word. Your text is kept; try again.",
        );
      return false;
    } finally {
      if (token === request.current) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  async function review(card: LearningCard, rating: "again" | "good" | "easy") {
    if (!userId || lock.current) return false;
    lock.current = true;
    setBusy(true);
    const token = ++request.current;
    try {
      const { error } = await supabase.rpc("review_learning_card", {
        card: card.id,
        rating,
      });
      if (error) throw error;
      if (owner.current !== userId) return false;
      setCards((old) => old.filter((item) => item.id !== card.id));
      return true;
    } catch {
      if (owner.current === userId)
        reportRef.current(
          "Could not save this review. Check your connection and try again.",
        );
      return false;
    } finally {
      if (token === request.current) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  async function updateGoal(value: number) {
    if (!userId || lock.current || ![5, 10, 20].includes(value)) return;
    lock.current = true;
    setBusy(true);
    const token = ++request.current;
    try {
      const { error } = await supabase.from("study_settings").upsert({
        user_id: userId,
        daily_goal: value,
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      });
      if (error) throw error;
      if (owner.current === userId) setGoal(value);
    } catch {
      if (owner.current === userId)
        reportRef.current("Could not save your daily goal. Try again.");
    } finally {
      if (token === request.current) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  async function remove(id: string) {
    if (!userId || lock.current) return;
    lock.current = true;
    setBusy(true);
    const token = ++request.current;
    try {
      const { error } = await supabase
        .from("learning_cards")
        .delete()
        .eq("id", id);
      if (error) throw error;
      if (owner.current === userId)
        setCards((old) => old.filter((card) => card.id !== id));
    } catch {
      if (owner.current === userId)
        reportRef.current("Could not remove this word. Try again.");
    } finally {
      if (token === request.current) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  return {
    cards,
    goal,
    completed,
    busy,
    more,
    load,
    save,
    review,
    updateGoal,
    remove,
  };
}
