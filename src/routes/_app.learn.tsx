import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Check, Brain, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/learn")({
  head: () => ({ meta: [{ title: "Учёба — FLOW" }] }),
  component: LearnPage,
});

type Quiz = {
  id: string;
  question: string;
  options: string[];
  reward: number;
};

function LearnPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<number | null>(null);

  const { data: quiz } = useQuery({
    queryKey: ["quiz-today"],
    queryFn: async (): Promise<Quiz | null> => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("quizzes")
        .select("id,question,options,reward")
        .eq("active_date", today)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const { data: any2 } = await supabase
          .from("quizzes")
          .select("id,question,options,reward")
          .order("active_date", { ascending: true })
          .limit(1)
          .maybeSingle();
        return any2 as Quiz | null;
      }
      return data as Quiz;
    },
  });


  const { data: attempt } = useQuery({
    queryKey: ["quiz-attempt", quiz?.id, user?.id],
    enabled: !!quiz && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("quiz_attempts")
        .select("chosen_index,correct")
        .eq("quiz_id", quiz!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async (idx: number) => {
      if (!quiz || !user) return null;
      const { data, error } = await supabase.rpc("app_quiz_answer", {
        p_quiz_id: quiz.id, p_chosen_index: idx,
      });
      if (error) {
        const map: Record<string, string> = {
          already_answered: "Вы уже отвечали сегодня",
          quiz_not_found: "Викторина не найдена",
        };
        throw new Error(map[error.message] ?? error.message);
      }
      return data as { correct: boolean; reward: number };
    },
    onSuccess: (res) => {
      if (!res) return;
      if (res.correct) toast.success(`+${res.reward} pending fFLOW`, { description: "Правильно!" });
      else toast.error("Неверно", { description: "Попробуйте завтра." });
      qc.invalidateQueries({ queryKey: ["quiz-attempt"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const done = !!attempt;
  const answered = done ? attempt.chosen_index : picked;

  const courses = [
    { title: "Личный бюджет 101", lessons: 8, price: 120, locked: false },
    { title: "Инвестиции для новичков", lessons: 14, price: 320, locked: true },
    { title: "Налоги ИП", lessons: 6, price: 200, locked: true },
  ];

  return (
    <div className="px-5 pb-6 pt-12">
      <div className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Учёба</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Финансовая грамотность</h1>
      </div>

      {/* Daily quiz — LRF lens */}
      <div className="lrf lrf-thick relative p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-eco/30 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-eco" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-eco">Daily Quiz · +{quiz?.reward ?? 20} pending</p>
          </div>

          {quiz ? (
            <>
              <p className="mt-3 text-base font-semibold leading-snug text-balance">{quiz.question}</p>

              <div className="mt-4 space-y-2">
                {quiz.options.map((opt, i) => {
                  const isPicked = answered === i;
                  const isCorrect = done && attempt?.correct === true && attempt?.chosen_index === i;
                  const isWrong = done && isPicked && !isCorrect;
                  return (
                    <button
                      key={i}
                      disabled={done || submit.isPending}
                      onClick={() => { setPicked(i); submit.mutate(i); }}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-all
                        ${isCorrect ? "border-success/60 bg-success/15 emissive-eco" : ""}
                        ${isWrong ? "border-destructive/60 bg-destructive/15 emissive-rose" : ""}
                        ${!done ? "border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-eco/40" : ""}
                        disabled:cursor-not-allowed`}
                    >
                      <span>{opt}</span>
                      {isCorrect && <Check className="size-4 text-success" />}
                    </button>
                  );
                })}
              </div>

              {done && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Возвращайтесь завтра за новым вопросом.
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Квиз скоро появится.</p>
          )}
        </div>
      </div>

      {/* Courses */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Курсы</h2>
          <span className="font-mono text-[10px] text-muted-foreground">оплата · fFLOW</span>
        </div>
        <ul className="space-y-2">
          {courses.map((c) => (
            <li key={c.title} className="lrf flex items-center justify-between p-4">
              <div className="relative z-10 min-w-0">
                <p className="truncate text-sm font-semibold">{c.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.lessons} уроков · 100% сжигается</p>
              </div>
              <div className="relative z-10 flex items-center gap-2">
                <span className="font-mono text-sm font-semibold tabular text-eco">{c.price} fFLOW</span>
                {c.locked ? <Lock className="size-4 text-muted-foreground" /> : <Sparkles className="size-4 text-eco" />}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
