"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./SecurityPage.module.css";

export function FaqQuestions({ children }: { children: ReactNode }) {
  const questionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const questions = questionsRef.current;
    if (!questions) return;

    let frame = 0;

    function openLinkedAnswer() {
      window.cancelAnimationFrame(frame);
      const fragment = window.location.hash.slice(1);
      const target = document.getElementById(fragment);
      if (!(target instanceof HTMLDetailsElement) || !questions?.contains(target)) return;

      target.open = true;
      frame = window.requestAnimationFrame(() => {
        target.scrollIntoView({ block: "start", behavior: "instant" });
        target.querySelector("summary")?.focus({ preventScroll: true });
      });
    }

    function reopenCurrentAnswer(event: MouseEvent) {
      if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (link?.hash && link.href === window.location.href) openLinkedAnswer();
    }

    openLinkedAnswer();
    window.addEventListener("hashchange", openLinkedAnswer);
    window.addEventListener("pageshow", openLinkedAnswer);
    questions.addEventListener("click", reopenCurrentAnswer);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", openLinkedAnswer);
      window.removeEventListener("pageshow", openLinkedAnswer);
      questions.removeEventListener("click", reopenCurrentAnswer);
    };
  }, []);

  return <div className={styles.questions} ref={questionsRef}>{children}</div>;
}
