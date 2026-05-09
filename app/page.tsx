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

const toolboxSnippets = [
  "make a word called greeting with Hello sunny team!",
  "make a list called nums with 2, 4, 6",
  "make a number called target with 8",
  "set total to sum of nums",
  "show total",
];

export default function Home() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(challenges.map((challenge) => [challenge.id, challenge.starter])),
  );
  const [result, setResult] = useState<StoryResult>(defaultResult);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [celebration, setCelebration] = useState("");
  const [showHint, setShowHint] = useState(false);

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

  const insertSnippet = (snippet: string) => {
    updateProgram(
      program.trim().length === 0 ? snippet : `${program.trimEnd()}\n${snippet}`,
    );
  };

  const runProgram = () => {
    const nextResult = runStoryProgram(program);
    const passed = activeChallenge.check(nextResult);

    setResult(nextResult);

    if (passed) {
      setCompletedIds((current) => {
        if (current.includes(activeChallenge.id)) {
          return current;
        }

        return [...current, activeChallenge.id];
      });

      setCelebration(`Mission complete: ${activeChallenge.title}`);
      return;
    }

    setCelebration("");
  };

  const canOpenChallenge = (index: number) =>
    index === 0 || completedIds.includes(challenges[index - 1].id);

  const lineCount = program.trim().length === 0 ? 0 : program.split(/\r?\n/).length;
  const completedCount = completedIds.length;

  return (
    <main className="app-shell">
      <section className="ide-window">
        <header className="topbar">
          <div className="brand-block">
            <div className="brand-mark">SC</div>
            <div>
              <p className="brand-kicker">Story Code Lab</p>
              <h1>Sentence Coding Studio</h1>
            </div>
          </div>

          <div className="topbar-stats">
            <div className="stat-pill">
              <span>Mission</span>
              <strong>
                {activeIndex + 1}/{challenges.length}
              </strong>
            </div>
            <div className="stat-pill">
              <span>Cleared</span>
              <strong>{completedCount}</strong>
            </div>
            <div className="stat-pill progress-pill">
              <span>Progress</span>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
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
                    <span className="mission-badge">{challenge.badge}</span>
                    <span className="mission-status">
                      {complete ? "Mission cleared" : unlocked ? "Open file" : "Locked"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="toolbox-card">
              <div className="section-label">Toolbox</div>
              <p className="toolbox-copy">
                Tap a phrase pattern to drop it into the editor without giving away the full answer.
              </p>
              <div className="toolbox-list">
                {toolboxSnippets.map((snippet) => (
                  <button
                    key={snippet}
                    className="toolbox-chip"
                    onClick={() => insertSnippet(snippet)}
                    type="button"
                  >
                    {snippet}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="editor-column panel-surface">
            <div className="editor-toolbar">
              <div className="tab-row">
                <span className="file-tab active">{activeChallenge.title}.story</span>
                <span className="file-tab muted">notes.md</span>
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

            <div className="mission-banner">
              <div>
                <span className="story-badge">{activeChallenge.badge}</span>
                <h2>{activeChallenge.title}</h2>
                <p>{activeChallenge.story}</p>
              </div>
              <div className="mission-mini-card">
                <span>Win target</span>
                <strong>{activeChallenge.winText}</strong>
              </div>
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
              <span>{showHint ? activeChallenge.hint : "Hints stay hidden until you ask for one."}</span>
              <span className="footer-status">
                {celebration || (completedIds.includes(activeChallenge.id) ? "Mission cleared." : "Ready to run.")}
              </span>
            </div>
          </section>

          <aside className="inspector-column">
            <div className="panel-surface info-card">
              <div className="section-label">Mission Control</div>
              <h3>{activeChallenge.mission}</h3>
              <div className="goal-box">
                <strong>How to win</strong>
                <p>{activeChallenge.winText}</p>
              </div>
              <div className="coach-box">
                <strong>Coach note</strong>
                <p>
                  Think about the result first, then write the shortest set of sentences that gets your robot there.
                </p>
              </div>
            </div>

            <div className="panel-surface console-card">
              <div className="section-label">Console</div>
              <pre className="console-view">
                {result.output.length > 0
                  ? result.output.join("\n")
                  : "Run your code to wake up the console."}
              </pre>
            </div>

            <div className="panel-surface code-card">
              <div className="section-label">Behind The Scenes</div>
              <pre className="code-view">
                {result.generatedCode.length > 0
                  ? result.generatedCode.join("\n")
                  : "// Your translated JavaScript will appear here."}
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
                  <p>The coach feed will describe what happened after you run the mission.</p>
                )}
              </div>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
