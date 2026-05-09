"use client";

import { useEffect, useState } from "react";
import { challenges } from "@/lib/challenges";
import { runStoryProgram, type StoryResult } from "@/lib/story-runtime";

const completionStorageKey = "story-code-lab-progress";

const defaultResult: StoryResult = {
  generatedCode: [],
  output: [],
  variables: {},
  steps: [],
  errors: [],
};

const languageGuide = [
  "make a number called score with 10",
  "make a list called nums with 2, 7, 11, 15",
  "make a word called greeting with Hello team",
  "set total to sum of nums",
  "set biggest to biggest number in nums",
  "set pair to index pair from nums that adds to target",
  "add 3 to score",
  "push 9 into nums",
  "show total",
];

type RunState = "idle" | "success" | "not-yet" | "error";

export default function Home() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(challenges.map((challenge) => [challenge.id, challenge.starter])),
  );
  const [result, setResult] = useState<StoryResult>(defaultResult);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [celebration, setCelebration] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [outputTab, setOutputTab] = useState<"console" | "javascript">("console");
  const [runState, setRunState] = useState<RunState>("idle");

  const activeChallenge = challenges[activeIndex];
  const program = drafts[activeChallenge.id] ?? "";

  useEffect(() => {
    const saved = window.localStorage.getItem(completionStorageKey);

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as string[];
        setCompletedIds(parsed);
      } catch {
        window.localStorage.removeItem(completionStorageKey);
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      completionStorageKey,
      JSON.stringify(completedIds),
    );
  }, [completedIds]);

  useEffect(() => {
    setResult(defaultResult);
    setCelebration("");
    setShowHint(false);
    setRunState("idle");
  }, [activeChallenge]);

  const progressPercent = Math.round(
    (completedIds.length / challenges.length) * 100,
  );

  const updateProgram = (value: string) => {
    setDrafts((current) => ({
      ...current,
      [activeChallenge.id]: value,
    }));
  };

  const runProgram = () => {
    const nextResult = runStoryProgram(program);
    const passed = activeChallenge.check(nextResult);

    setResult(nextResult);
    setOutputTab("console");

    if (passed) {
      setCompletedIds((current) => {
        if (current.includes(activeChallenge.id)) {
          return current;
        }

        return [...current, activeChallenge.id];
      });

      setCelebration(`Mission complete: ${activeChallenge.title}`);
      setRunState("success");
      return;
    }

    setCelebration("");
    setRunState(nextResult.errors.length > 0 ? "error" : "not-yet");
  };

  const canOpenChallenge = (index: number) =>
    index === 0 || completedIds.includes(challenges[index - 1].id);

  const lineCount = program.trim().length === 0 ? 0 : program.split(/\r?\n/).length;
  const completedCount = completedIds.length;
  const activeMissionComplete = completedIds.includes(activeChallenge.id);
  const statusLabel =
    runState === "success"
      ? "Success"
      : runState === "error"
        ? "Fix errors"
        : runState === "not-yet"
          ? "Not solved yet"
          : activeMissionComplete
            ? "Mission cleared"
            : "Ready";
  const statusMessage =
    runState === "success"
      ? "This run solved the mission."
      : runState === "error"
        ? "The program ran into a sentence or type error."
        : runState === "not-yet"
          ? "Your program ran, but it did not meet the pass condition yet."
          : activeMissionComplete
            ? "This mission was already cleared before."
            : "Write your sentences and press Run.";

  return (
    <main className="app-shell">
      <section className="ide-window">
        <header className="topbar">
          <div className="brand-block">
            <div>
              <p className="brand-kicker">Story Code Lab</p>
              <h1>Sentence Coding Studio</h1>
            </div>
          </div>

          <div className="topbar-stats">
            <span>Mission {activeIndex + 1} of {challenges.length}</span>
            <span>{completedCount} cleared</span>
            <span>{progressPercent}% progress</span>
          </div>
        </header>

        <section className="ide-grid">
          <aside className="sidebar panel-surface">
            <div className="section-label">Explorer</div>

            <div className="mission-list">
              {challenges.map((challenge, index) => {
                const unlocked = canOpenChallenge(index);
                const complete = completedIds.includes(challenge.id);

                return (
                  <button
                    key={challenge.id}
                    className={`mission-card ${index === activeIndex ? "active" : ""} ${
                      complete ? "complete" : ""
                    }`}
                    disabled={!unlocked}
                    onClick={() => {
                      if (unlocked) {
                        setActiveIndex(index);
                      }
                    }}
                    type="button"
                  >
                    <div className="file-row">
                      <span className="file-icon" />
                      <strong>{challenge.title}.story</strong>
                    </div>
                    <span className="mission-status">
                      {complete ? "done" : unlocked ? challenge.badge.toLowerCase() : "locked"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="sidebar-footer">
              <div className="section-label">Progress</div>
              <div className="sidebar-progress">
                <div className="progress-bar">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span>{completedCount} / {challenges.length} missions</span>
              </div>
            </div>
          </aside>

          <section className="editor-column panel-surface">
            <div className="editor-toolbar">
              <div className="tab-row">
                <span className="file-tab active">{activeChallenge.title}.story</span>
                <span className="file-tab muted">console.txt</span>
              </div>

              <div className="action-row">
                <button className="primary-button" onClick={runProgram} type="button">
                  Run
                </button>
                <button
                  className="secondary-button"
                  onClick={() => setShowHint((current) => !current)}
                  type="button"
                >
                  {showHint ? "Hide hint" : "Need a hint?"}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => updateProgram("")}
                  type="button"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="editor-info">
              <span>{activeChallenge.badge}</span>
              <span>{lineCount} lines</span>
              <span>{statusLabel}</span>
            </div>

            <textarea
              className="editor"
              placeholder={activeChallenge.placeholder}
              spellCheck={false}
              value={program}
              onChange={(event) => updateProgram(event.target.value)}
            />

            <div className="editor-footer">
              <span>{lineCount} lines</span>
              <span>{showHint ? activeChallenge.hint : "Hint is hidden."}</span>
              <span className={`footer-status footer-status-${runState}`}>
                {celebration || statusLabel}
              </span>
            </div>
          </section>

          <aside className="inspector-column">
            <div className="panel-surface info-card">
              <div className="section-label">Mission</div>
              <div className={`run-status run-status-${runState}`}>
                <strong>{statusLabel}</strong>
                <span>{statusMessage}</span>
              </div>
              <h3>{activeChallenge.title}</h3>
              <p className="mission-copy">{activeChallenge.story}</p>
              <div className="goal-box">
                <strong>Goal</strong>
                <p>{activeChallenge.mission}</p>
              </div>
              <div className="goal-box subtle-box">
                <strong>Pass condition</strong>
                <p>{activeChallenge.winText}</p>
              </div>
              {showHint ? (
                <div className="goal-box hint-box">
                  <strong>Hint</strong>
                  <p>{activeChallenge.hint}</p>
                </div>
              ) : null}
              <div className="goal-box guide-box">
                <strong>Allowed sentence shapes</strong>
                <div className="guide-list">
                  {languageGuide.map((line) => (
                    <code key={line} className="guide-line">
                      {line}
                    </code>
                  ))}
                </div>
              </div>
            </div>

            <div className="panel-surface code-card">
              <div className="output-tabs">
                <button
                  className={`output-tab ${outputTab === "console" ? "active" : ""}`}
                  onClick={() => setOutputTab("console")}
                  type="button"
                >
                  Console
                </button>
                <button
                  className={`output-tab ${outputTab === "javascript" ? "active" : ""}`}
                  onClick={() => setOutputTab("javascript")}
                  type="button"
                >
                  JavaScript
                </button>
              </div>
              <pre className="code-view">
                {outputTab === "console"
                  ? result.output.length > 0
                    ? result.output.join("\n")
                    : "Run your code to see output."
                  : result.generatedCode.length > 0
                    ? result.generatedCode.join("\n")
                    : "// Translated JavaScript will appear here."}
              </pre>
              <div className="debug-list">
                {result.errors.length > 0 ? (
                  result.errors.map((error) => (
                    <p key={error} className="error-line">
                      {error}
                    </p>
                  ))
                ) : result.steps.length > 0 ? (
                  result.steps.map((step) => <p key={step}>{step}</p>)
                ) : (
                  <p>Status messages will appear here after you run the mission.</p>
                )}
              </div>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
