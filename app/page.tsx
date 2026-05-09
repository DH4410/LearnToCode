"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { challenges } from "@/lib/challenges";
import { runStoryProgram, type StoryResult } from "@/lib/story-runtime";

const completionStorageKey = "story-code-lab-progress";
const layoutStorageKey = "story-code-lab-layout";

const defaultResult: StoryResult = {
  generatedCode: [],
  output: [],
  variables: {},
  steps: [],
  errors: [],
  lineCount: 0,
};

const languageGuide = [
  "make a number called score with 10",
  "variable text = \"hi\"",
  "let nums = [2, 7, 11, 15]",
  "const target = 9",
  "make a list called nums with 2, 7, 11, 15",
  "make a word called greeting with Hello team",
  "set total to sum of nums",
  "set biggest to biggest number in nums",
  "set pair to index pair from nums that adds to target",
  "answer = sum of nums",
  "add 3 to score",
  "push 9 into nums",
  "show total",
  "print text",
];

type RunState = "idle" | "success" | "not-yet" | "error";

type LayoutState = {
  leftWidth: number;
  rightWidth: number;
  missionHeight: number;
};

type DragState =
  | {
      type: "left";
      startX: number;
      startWidth: number;
    }
  | {
      type: "right";
      startX: number;
      startWidth: number;
    }
  | {
      type: "mission";
      startY: number;
      startHeight: number;
    };

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
  const [layout, setLayout] = useState<LayoutState>({
    leftWidth: 220,
    rightWidth: 320,
    missionHeight: 330,
  });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isCompactLayout, setIsCompactLayout] = useState(false);

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
    const savedLayout = window.localStorage.getItem(layoutStorageKey);

    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout) as Partial<LayoutState>;

        setLayout((current) => ({
          leftWidth: parsed.leftWidth ?? current.leftWidth,
          rightWidth: parsed.rightWidth ?? current.rightWidth,
          missionHeight: parsed.missionHeight ?? current.missionHeight,
        }));
      } catch {
        window.localStorage.removeItem(layoutStorageKey);
      }
    }

    const syncLayoutMode = () => {
      setIsCompactLayout(window.innerWidth <= 1180);
    };

    syncLayoutMode();
    window.addEventListener("resize", syncLayoutMode);

    return () => {
      window.removeEventListener("resize", syncLayoutMode);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      completionStorageKey,
      JSON.stringify(completedIds),
    );
  }, [completedIds]);

  useEffect(() => {
    window.localStorage.setItem(layoutStorageKey, JSON.stringify(layout));
  }, [layout]);

  useEffect(() => {
    setResult(defaultResult);
    setCelebration("");
    setShowHint(false);
    setRunState("idle");
  }, [activeChallenge]);

  useEffect(() => {
    if (isCompactLayout) {
      setDragState(null);
    }
  }, [isCompactLayout]);

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

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

  const handleDragMove = useEffectEvent((event: PointerEvent) => {
    if (!dragState || isCompactLayout) {
      return;
    }

    if (dragState.type === "left") {
      const nextWidth = clamp(
        dragState.startWidth + (event.clientX - dragState.startX),
        180,
        420,
      );

      setLayout((current) => ({
        ...current,
        leftWidth: nextWidth,
      }));
      return;
    }

    if (dragState.type === "right") {
      const nextWidth = clamp(
        dragState.startWidth - (event.clientX - dragState.startX),
        260,
        520,
      );

      setLayout((current) => ({
        ...current,
        rightWidth: nextWidth,
      }));
      return;
    }

    const maxMissionHeight = Math.max(220, window.innerHeight - 240);
    const nextHeight = clamp(
      dragState.startHeight + (event.clientY - dragState.startY),
      200,
      maxMissionHeight,
    );

    setLayout((current) => ({
      ...current,
      missionHeight: nextHeight,
    }));
  });

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handlePointerUp = () => {
      setDragState(null);
    };

    window.addEventListener("pointermove", handleDragMove);
    window.addEventListener("pointerup", handlePointerUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor =
      dragState.type === "mission" ? "row-resize" : "col-resize";

    return () => {
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [dragState, handleDragMove]);

  const ideGridStyle = isCompactLayout
    ? undefined
    : {
        gridTemplateColumns: `${layout.leftWidth}px 6px minmax(0, 1fr) 6px ${layout.rightWidth}px`,
      };

  const inspectorStyle = isCompactLayout
    ? undefined
    : {
        gridTemplateRows: `${layout.missionHeight}px 6px minmax(0, 1fr)`,
      };

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

        <section className="ide-grid" style={ideGridStyle}>
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

          <div
            aria-label="Resize explorer"
            className="resize-handle resize-handle-vertical"
            onPointerDown={(event) => {
              if (isCompactLayout) {
                return;
              }

              event.preventDefault();
              setDragState({
                type: "left",
                startX: event.clientX,
                startWidth: layout.leftWidth,
              });
            }}
            role="separator"
          />

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

          <div
            aria-label="Resize side panel"
            className="resize-handle resize-handle-vertical"
            onPointerDown={(event) => {
              if (isCompactLayout) {
                return;
              }

              event.preventDefault();
              setDragState({
                type: "right",
                startX: event.clientX,
                startWidth: layout.rightWidth,
              });
            }}
            role="separator"
          />

          <aside className="inspector-column" style={inspectorStyle}>
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
                <strong>Allowed commands</strong>
                <p className="guide-copy">
                  Use one action per line. You can mix sentence-style commands and simple variable-style lines.
                </p>
                <div className="guide-list">
                  {languageGuide.map((line) => (
                    <code key={line} className="guide-line">
                      {line}
                    </code>
                  ))}
                </div>
              </div>
            </div>

            <div
              aria-label="Resize mission panel"
              className="resize-handle resize-handle-horizontal"
              onPointerDown={(event) => {
                if (isCompactLayout) {
                  return;
                }

                event.preventDefault();
                setDragState({
                  type: "mission",
                  startY: event.clientY,
                  startHeight: layout.missionHeight,
                });
              }}
              role="separator"
            />

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
