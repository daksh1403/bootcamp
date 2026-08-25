"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Question {
  id: number;
  question: string;
  options: string[];
}

const QUESTION_SECONDS = 20;

export default function QuizPage() {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<{ id: number; choice: number }[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [phase, setPhase] = useState<"loading" | "playing" | "done" | "already">("loading");
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    fetch("/api/quiz/questions")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          setPhase("loading");
          return;
        }
        setQuestions(d.questions);
        setPhase("playing");
        startedAt.current = Date.now();
      })
      .catch(() => setQuestions([]));
  }, []);

  // per-question timer
  useEffect(() => {
    if (phase !== "playing") return;
    setTimeLeft(QUESTION_SECONDS);
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          advance(null);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, phase]);

  function advance(choice: number | null) {
    const q = questions?.[idx];
    if (q && choice !== null) {
      setAnswers((a) => [...a, { id: q.id, choice }]);
      setPicked(choice);
      setTimeout(() => {
        setPicked(null);
        next();
      }, 450);
    } else if (q) {
      next();
    }

    function next() {
      if (!questions) return;
      if (idx + 1 >= questions.length) finish();
      else setIdx(idx + 1);
    }
  }

  async function finish() {
    setPhase("done");
    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          durationS: Math.round((Date.now() - startedAt.current) / 1000),
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setPhase("already");
        return;
      }
      if (data.ok) setResult({ score: data.score, total: data.total });
      else setResult({ score: -1, total: questions?.length ?? 0 });
    } catch {
      setResult({ score: -1, total: questions?.length ?? 0 });
    }
  }

  if (questions !== null && questions.length === 0) {
    return (
      <main className="max-w-xl mx-auto px-4 py-24 text-center font-mono text-sm text-muted">
        QUIZ NOT AVAILABLE — no questions configured.
      </main>
    );
  }

  if (phase === "done" || phase === "already") {
    return (
      <main className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="font-mono text-term-green text-2xl tracking-widest mb-4">
          {phase === "already" ? "ONE ATTEMPT ONLY, OPERATIVE." : `SCORE: ${result?.score}/${result?.total}`}
        </div>
        {phase === "done" && (
          <>
            <pre className="inline-block text-left font-mono text-sm text-muted leading-relaxed">{`$ quiz --grade
  correct: ${result?.score}
  total:   ${result?.total}
  rank:    lunch-table bragging rights`}</pre>
            <p className="mt-4 text-xs text-muted">
              Trivia results stay separate from the official deployment leaderboard.
            </p>
          </>
        )}
        <Link href="/dashboard" className="inline-block mt-8 border border-edge rounded px-5 py-2.5 font-mono text-xs tracking-wider hover:border-term-cyan/50 transition-colors">
          ← MISSION CONTROL
        </Link>
      </main>
    );
  }

  if (!questions || phase !== "playing") return null;

  const q = questions[idx];

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between font-mono text-xs text-muted tracking-widest">
        <span>DEVOPS TRIVIA · LUNCH WINDOW</span>
        <span>{idx + 1}/{questions.length}</span>
      </div>
      <div className="mt-3 h-1.5 bg-white/5 rounded overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${timeLeft > 7 ? "bg-term-cyan" : "bg-term-red"}`}
          style={{ width: `${(timeLeft / QUESTION_SECONDS) * 100}%` }}
        />
      </div>

      <h1 className="mt-10 text-xl md:text-2xl font-bold leading-relaxed">{q.question}</h1>
      <p className="mt-2 font-mono text-[11px] text-term-red tabular-nums">{timeLeft}s</p>

      <div className="mt-8 grid gap-3">
        {q.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => picked === null && advance(i)}
            className={`text-left border rounded-lg px-5 py-4 transition-colors ${
              picked === i ? "border-term-green bg-term-green/10" : "border-edge bg-panel hover:border-term-cyan/50"
            }`}
          >
            <span className="font-mono text-term-cyan mr-3">{String.fromCharCode(65 + i)}</span>
            {opt}
          </button>
        ))}
      </div>

      <p className="mt-8 font-mono text-[11px] text-muted text-center">
        Fun only — this does not affect your official mission ranking.
      </p>
    </main>
  );
}
