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

export default function Home() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [program, setProgram] = useState(challenges[0].starter);
  const [result, setResult] = useState<StoryResult>(defaultResult);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [celebration, setCelebration] = useState("");

  const activeChallenge = challenges[activeIndex];

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
    setProgram(activeChallenge.starter);
    setResult(defaultResult);
    setCelebration("");
  }, [activeChallenge]);

  const progressPercent = Math.round(
    (completedIds.length / challenges.length) * 100,
  );

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

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Story Code Lab</p>
          <h1>Like Scratch, but kids write ideas in sentences.</h1>
          <p className="hero-copy">
            Every mission turns plain-English commands into real JavaScript
            logic. Kids get a playful terminal, instant feedback, and challenge
            goals that unlock one by one.
          </p>
        </div>

        <div className="hero-card">
          <span className="hero-card-label">Progress Map</span>
          <strong>{completedIds.length} missions cleared</strong>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p>{progressPercent}% complete</p>
        </div>
      </section>

      <section className="workspace">
        <aside className="mission-rail">
          <div className="panel-header">
            <span className="dot dot-pink" />
            <span>Missions</span>
          </div>

          <div className="mission-list">
            {challenges.map((challenge, index) => {
              const unlocked = canOpenChallenge(index);
              const complete = completedIds.includes(challenge.id);

              return (
                <button
                  key={challenge.id}
                  className={`mission-card ${
                    index === activeIndex ? "active" : ""
                  } ${complete ? "complete" : ""}`}
                  disabled={!unlocked}
                  onClick={() => {
                    if (unlocked) {
                      setActiveIndex(index);
                    }
                  }}
                  type="button"
                >
                  <span className="mission-badge">{challenge.badge}</span>
                  <strong>{challenge.title}</strong>
                  <span>
                    {complete
                      ? "Cleared"
                      : unlocked
                        ? "Ready"
                        : "Locked until the last mission is done"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="helper-box">
            <p className="helper-title">Sentence ideas</p>
            <ul>
              <li>`make a list called nums with 2, 7, 11, 15`</li>
              <li>`set total to sum of nums`</li>
              <li>`set pair to index pair from nums that adds to target`</li>
              <li>`show pair`</li>
            </ul>
          </div>
        </aside>

        <section className="studio">
          <div className="panel story-panel">
            <div className="panel-header">
              <span className="dot dot-green" />
              <span>Mission Brief</span>
            </div>
            <span className="story-badge">{activeChallenge.badge}</span>
            <h2>{activeChallenge.title}</h2>
            <p>{activeChallenge.story}</p>
            <div className="goal-box">
              <strong>Goal</strong>
              <p>{activeChallenge.goal}</p>
            </div>
            <p className="hint">Hint: {activeChallenge.hint}</p>
          </div>

          <div className="panel editor-panel">
            <div className="panel-header">
              <span className="dot dot-yellow" />
              <span>Prompt Terminal</span>
            </div>

            <textarea
              className="editor"
              spellCheck={false}
              value={program}
              onChange={(event) => setProgram(event.target.value)}
            />

            <div className="button-row">
              <button className="primary-button" onClick={runProgram} type="button">
                Run mission
              </button>
              <button
                className="secondary-button"
                onClick={() => setProgram(activeChallenge.starter)}
                type="button"
              >
                Reload starter
              </button>
              <button
                className="secondary-button"
                onClick={() => setProgram("")}
                type="button"
              >
                Clear page
              </button>
            </div>

            {celebration ? <p className="success-banner">{celebration}</p> : null}
          </div>

          <div className="panel examples-panel">
            <div className="panel-header">
              <span className="dot dot-blue" />
              <span>Example Phrases</span>
            </div>
            <div className="example-list">
              {activeChallenge.examples.map((example) => (
                <button
                  key={example}
                  className="example-chip"
                  onClick={() =>
                    setProgram((current) =>
                      current.trim().length === 0
                        ? example
                        : `${current}\n${example}`,
                    )
                  }
                  type="button"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="results">
          <div className="panel">
            <div className="panel-header">
              <span className="dot dot-blue" />
              <span>Generated JavaScript</span>
            </div>
            <pre className="code-view">
              {result.generatedCode.length > 0
                ? result.generatedCode.join("\n")
                : "// Run a mission to see your sentences become code."}
            </pre>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span className="dot dot-pink" />
              <span>Robot Console</span>
            </div>
            <pre className="console-view">
              {result.output.length > 0
                ? result.output.join("\n")
                : "Nothing printed yet."}
            </pre>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span className="dot dot-green" />
              <span>World State</span>
            </div>
            <pre className="state-view">
              {Object.keys(result.variables).length > 0
                ? JSON.stringify(result.variables, null, 2)
                : "{ }"}
            </pre>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span className="dot dot-yellow" />
              <span>Debugger</span>
            </div>
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
                <p>Friendly feedback appears here after you run the mission.</p>
              )}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
