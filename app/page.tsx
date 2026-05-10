"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
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
  "variable text: \"hi\"",
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
  "show score + 2",
  "show number + number1 + number2 + number3",
  "set lowest to smallest number in nums",
  "set firstItem to first item in nums",
  "set lastItem to last item in nums",
  "set count to size of nums",
  "set pair to index pair from nums that adds to target",
  "show \"mission complete\"",
];

type EditorIssue = {
  line: number;
  token: string;
  message: string;
};

const commandKeywords = new Set([
  "make",
  "variable",
  "let",
  "const",
  "set",
  "answer",
  "add",
  "push",
  "show",
  "print",
]);

const typeKeywords = new Set(["list", "number", "word", "text", "boolean", "flag"]);

const expressionKeywords = new Set([
  "called",
  "with",
  "sum",
  "of",
  "biggest",
  "smallest",
  "size",
  "first",
  "last",
  "item",
  "in",
  "index",
  "pair",
  "from",
  "that",
  "adds",
  "to",
  "plus",
  "minus",
  "times",
  "divided",
  "by",
  "true",
  "false",
  "and",
]);

const arithmeticTokenPattern = /"[^"]*"|'[^']*'|\b-?\d+(?:\.\d+)?\b|[a-zA-Z_][\w]*|[+\-*/]/g;

const isArithmeticOperator = (token: string) =>
  token === "+" || token === "-" || token === "*" || token === "/";

const isKnownValueToken = (token: string, knownNames: Set<string>) =>
  /^-?\d+(?:\.\d+)?$/.test(token) ||
  /^"[^"]*"$|^'[^']*'$/.test(token) ||
  knownNames.has(token.toLowerCase());

const normalizeEditorName = (value: string) => value.trim().replace(/\s+/g, "_");

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const editDistance = (a: string, b: string) => {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) {
    table[i][0] = i;
  }

  for (let j = 0; j < cols; j += 1) {
    table[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;

      table[i][j] = Math.min(
        table[i - 1][j] + 1,
        table[i][j - 1] + 1,
        table[i - 1][j - 1] + substitutionCost,
      );
    }
  }

  return table[a.length][b.length];
};

const suggestCommand = (token: string) => {
  const normalized = token.toLowerCase();
  let best: { command: string; distance: number } | null = null;

  for (const command of commandKeywords) {
    const distance = editDistance(normalized, command);

    if (!best || distance < best.distance) {
      best = { command, distance };
    }
  }

  if (!best) {
    return null;
  }

  return best.distance <= 2 ? best.command : null;
};

const lintProgram = (program: string): EditorIssue[] => {
  const issues: EditorIssue[] = [];
  const knownNames = new Set<string>();
  const lines = program.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return;
    }

    const firstToken = (trimmed.match(/^([a-zA-Z_][\w-]*)/) ?? [""])[1];

    if (!firstToken) {
      return;
    }

    const isAssignmentLike = /^([a-zA-Z_][\w]*)\s*[:=]/.test(trimmed);
    const lowerFirst = firstToken.toLowerCase();

    if (!commandKeywords.has(lowerFirst) && !isAssignmentLike) {
      const suggestion = suggestCommand(firstToken);

      issues.push({
        line: index + 1,
        token: firstToken,
        message: suggestion
          ? `Unknown command "${firstToken}". Did you mean "${suggestion}"?`
          : `Unknown command "${firstToken}".`,
      });
      return;
    }

    if (lowerFirst === "make") {
      const makePattern =
        /^make a (list|number|word|text|boolean|flag) called ([a-zA-Z][\w\s]*) with (.+)$/i;

      if (!makePattern.test(trimmed)) {
        issues.push({
          line: index + 1,
          token: "make",
          message: "Expected: make a <type> called <name> with <value>",
        });
      } else {
        const createdName = trimmed.match(
          /^make a (list|number|word|text|boolean|flag) called ([a-zA-Z][\w\s]*) with (.+)$/i,
        );

        if (createdName) {
          knownNames.add(normalizeEditorName(createdName[2]));
        }
      }
    }

    if ((lowerFirst === "show" || lowerFirst === "print") && !/^(show|print)\s+.+$/i.test(trimmed)) {
      issues.push({
        line: index + 1,
        token: firstToken,
        message: "Expected a value after show/print.",
      });
    }

    const declarationMatch = trimmed.match(
      /^(variable|let|const)\s+([a-zA-Z][\w]*)\s*[:=]\s*(.+)$/i,
    );

    if (declarationMatch) {
      knownNames.add(normalizeEditorName(declarationMatch[2]));
    }

    const assignMatch = trimmed.match(/^([a-zA-Z][\w]*)\s*[:=]\s*(.+)$/);
    if (assignMatch) {
      knownNames.add(normalizeEditorName(assignMatch[1]));
    }

    if (lowerFirst === "show" || lowerFirst === "print") {
      const expression = trimmed.replace(/^(show|print)\s+/i, "").trim();
      const expressionTokens = expression.match(arithmeticTokenPattern) ?? [];

      if (expressionTokens.some(isArithmeticOperator)) {
        let expectValue = true;
        let previousToken = "";
        let addedIssue = false;

        for (const token of expressionTokens) {
          if (expectValue) {
            if (isArithmeticOperator(token)) {
              issues.push({
                line: index + 1,
                token,
                message: `Expected a value before "${token}".`,
              });
              addedIssue = true;
              break;
            }

            if (!isKnownValueToken(token, knownNames)) {
              issues.push({
                line: index + 1,
                token,
                message: `Unknown value "${token}".`,
              });
              addedIssue = true;
              break;
            }

            expectValue = false;
            previousToken = token;
            continue;
          }

          if (!isArithmeticOperator(token)) {
            issues.push({
              line: index + 1,
              token,
              message: `Missing operator between "${previousToken}" and "${token}".`,
            });
            addedIssue = true;
            break;
          }

          expectValue = true;
          previousToken = token;
        }

        if (!addedIssue && expectValue) {
          issues.push({
            line: index + 1,
            token: expressionTokens[expressionTokens.length - 1] ?? "",
            message: "An expression cannot end with an operator.",
          });
        }
      }
    }

    if (
      ["variable", "let", "const"].includes(lowerFirst) &&
      !/^(variable|let|const)\s+[a-zA-Z][\w]*\s*[:=]\s*.+$/i.test(trimmed)
    ) {
      issues.push({
        line: index + 1,
        token: firstToken,
        message: "Expected: variable name = value (or name: value)",
      });
    }
  });

  return issues;
};

const colorizeLine = (
  line: string,
  issueMessagesByToken: Map<string, string[]>,
) => {
  if (!line) {
    return "<span class=\"tok-whitespace\"> </span>";
  }

  const tokenPattern = /(\s+|"[^"]*"|'[^']*'|\b\d+(?:\.\d+)?\b|[a-zA-Z_][\w-]*|==|=|\[|\]|\(|\)|,|\.|:|;|\+|-|\*|\/)/g;
  const parts = line.split(tokenPattern).filter((part) => part.length > 0);

  return parts
    .map((part) => {
      const escaped = escapeHtml(part);

      if (/^\s+$/.test(part)) {
        return escaped;
      }

      const normalized = part.toLowerCase();
      const classes: string[] = [];

      if (commandKeywords.has(normalized)) {
        classes.push("tok-command");
      } else if (typeKeywords.has(normalized)) {
        classes.push("tok-type");
      } else if (expressionKeywords.has(normalized)) {
        classes.push("tok-keyword");
      } else if (/^"[^"]*"$|^'[^']*'$/.test(part)) {
        classes.push("tok-string");
      } else if (/^\d+(\.\d+)?$/.test(part)) {
        classes.push("tok-number");
      } else if (/^(=|\+|-|\*|\/|\[|\]|\(|\)|,|\.|:|;)$/.test(part)) {
        classes.push("tok-operator");
      }

      const issueMessages = issueMessagesByToken.get(part.toLowerCase());

      if (issueMessages && issueMessages.length > 0) {
        classes.push("tok-error");
      }

      if (classes.length === 0) {
        return escaped;
      }

      const title =
        issueMessages && issueMessages.length > 0
          ? ` title=\"${escapeHtml(issueMessages.join(" | "))}\"`
          : "";

      return `<span${title} class=\"${classes.join(" ")}\">${escaped}</span>`;
    })
    .join("");
};

type RunState = "idle" | "success" | "not-yet" | "error";

type LayoutState = {
  leftWidth: number;
  rightWidth: number;
  missionHeight: number;
  bottomTerminalHeight: number;
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
    }
  | {
      type: "terminal-bottom";
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
  const [outputTab, setOutputTab] = useState<"terminal" | "javascript" | "problems">("terminal");
  const [runState, setRunState] = useState<RunState>("idle");
  const [layout, setLayout] = useState<LayoutState>({
    leftWidth: 220,
    rightWidth: 320,
    missionHeight: 330,
    bottomTerminalHeight: 240,
  });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const editorBackdropRef = useRef<HTMLPreElement | null>(null);
  const editorGutterRef = useRef<HTMLDivElement | null>(null);
  const [showCommandsPanel, setShowCommandsPanel] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);
  const [showTutorialCard, setShowTutorialCard] = useState(true);

  const activeChallenge = challenges[activeIndex];
  const program = drafts[activeChallenge.id] ?? "";
  const liveIssues = useMemo(() => lintProgram(program), [program]);
  const programLines = useMemo(() => program.split(/\r?\n/), [program]);

  const highlightedProgram = useMemo(() => {
    const issueTokensByLine = new Map<number, Map<string, string[]>>();

    liveIssues.forEach((issue) => {
      const existing = issueTokensByLine.get(issue.line) ?? new Map<string, string[]>();
      const tokenKey = issue.token.toLowerCase();
      const messages = existing.get(tokenKey) ?? [];
      messages.push(issue.message);
      existing.set(tokenKey, messages);
      issueTokensByLine.set(issue.line, existing);
    });

    return programLines
      .map((line, index) =>
        colorizeLine(line, issueTokensByLine.get(index + 1) ?? new Map<string, string[]>()),
      )
      .join("\n");
  }, [liveIssues, programLines]);

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
          bottomTerminalHeight:
            parsed.bottomTerminalHeight ?? current.bottomTerminalHeight,
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
    setSuccessFlash(false);
    setShowCommandsPanel(false);
  }, [activeChallenge]);

  useEffect(() => {
    if (!successFlash) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSuccessFlash(false);
    }, 1100);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [successFlash]);

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
    setOutputTab("terminal");

    if (passed) {
      setCompletedIds((current) => {
        if (current.includes(activeChallenge.id)) {
          return current;
        }

        return [...current, activeChallenge.id];
      });

      setCelebration(`Mission complete: ${activeChallenge.title}`);
      setRunState("success");
      setSuccessFlash(true);

      const nextChallengeIndex = Math.min(activeIndex + 1, challenges.length - 1);

      if (nextChallengeIndex > activeIndex) {
        setTimeout(() => {
          setActiveIndex(nextChallengeIndex);
        }, 350);
      }

      return;
    }

    setCelebration("");
    setRunState(nextResult.errors.length > 0 ? "error" : "not-yet");
  };

  const canOpenChallenge = (index: number) =>
    index === 0 || completedIds.includes(challenges[index - 1].id);

  const lineCount = program.trim().length === 0 ? 0 : programLines.length;
  const editorLineCount = Math.max(1, programLines.length);
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

  const runtimeProblems = result.errors.map((error, index) => ({
    id: `runtime-${index}`,
    line: null,
    message: error,
  }));

  const lintProblems = liveIssues.map((issue, index) => ({
    id: `lint-${index}`,
    line: issue.line,
    message: issue.message,
    token: issue.token,
  }));

  const allProblems = [...lintProblems, ...runtimeProblems];

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

    if (dragState.type === "terminal-bottom") {
      const nextHeight = clamp(
        dragState.startHeight - (event.clientY - dragState.startY),
        120,
        600,
      );

      setLayout((current) => ({
        ...current,
        bottomTerminalHeight: nextHeight,
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
      dragState.type === "mission" || dragState.type === "terminal-bottom"
        ? "row-resize"
        : "col-resize";

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

  const consoleBodyStyle = isCompactLayout
    ? undefined
    : {
        gridTemplateRows: `6px minmax(0, ${layout.bottomTerminalHeight}px)`,
      };

  const syncEditorScroll = (event: React.UIEvent<HTMLTextAreaElement>) => {
    const nextTop = event.currentTarget.scrollTop;
    const nextLeft = event.currentTarget.scrollLeft;

    if (editorBackdropRef.current) {
      editorBackdropRef.current.scrollTop = nextTop;
      editorBackdropRef.current.scrollLeft = nextLeft;
    }

    if (editorGutterRef.current) {
      editorGutterRef.current.scrollTop = nextTop;
    }
  };

  const terminalPanel = (
    <div className={`panel-surface code-card terminal-panel ${successFlash ? "terminal-success" : ""}`}>
      <div className="terminal-topbar">
        <div className="output-tabs">
          <button
            className={`output-tab ${outputTab === "terminal" ? "active" : ""}`}
            onClick={() => setOutputTab("terminal")}
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
          <button
            className={`output-tab ${outputTab === "problems" ? "active" : ""}`}
            onClick={() => setOutputTab("problems")}
            type="button"
          >
            Problems
          </button>
        </div>
      </div>
      <pre className="code-view">
        {outputTab === "terminal"
          ? result.output.length > 0
            ? [`$ run ${activeChallenge.title}.story`, ...result.output].join("\n")
            : "$ Run your code to see output."
          : result.generatedCode.length > 0
            ? outputTab === "javascript"
              ? result.generatedCode.join("\n")
              : allProblems
                  .map((problem) =>
                    problem.line
                      ? `Line ${problem.line}: ${problem.message}`
                      : problem.message,
                  )
                  .join("\n")
            : outputTab === "javascript"
              ? "// Translated JavaScript will appear here."
              : allProblems.length > 0
                ? allProblems
                    .map((problem) =>
                      problem.line
                        ? `Line ${problem.line}: ${problem.message}`
                        : problem.message,
                    )
                    .join("\n")
                : "No problems found."}
      </pre>
      <div className="debug-list">
        {allProblems.length > 0 ? (
          <>
            <div className="problems-header">
              <strong>Problems</strong>
              <span>{allProblems.length} issue{allProblems.length > 1 ? "s" : ""}</span>
            </div>
            {allProblems.map((problem) => (
              <p key={problem.id} className="error-line problem-entry">
                <span className="problem-bullet">•</span>
                <span>
                  {problem.line ? `Line ${problem.line}: ` : ""}
                  {problem.message}
                </span>
              </p>
            ))}
          </>
        ) : result.steps.length > 0 ? (
          result.steps.map((step) => <p key={step}>{step}</p>)
        ) : (
          <p>Status messages will appear here after you run the mission.</p>
        )}
      </div>
    </div>
  );

  const commandReferencePanel = showCommandsPanel ? (
    <div className="command-popout" role="dialog" aria-label="Command reference">
      <div className="command-popout-header">
        <strong>Command Reference</strong>
        <button
          className="secondary-button"
          onClick={() => setShowCommandsPanel(false)}
          type="button"
        >
          Close
        </button>
      </div>
      <p className="guide-copy">Quick patterns you can use anywhere in the missions.</p>
      <div className="guide-list">
        {languageGuide.map((line) => (
          <code key={line} className="guide-line">
            {line}
          </code>
        ))}
      </div>
    </div>
  ) : null;

  const tutorialPanel = showTutorialCard ? (
    <div className="tutorial-banner" role="region" aria-label="Tutorial">
      <div className="tutorial-badge">Start Here</div>
      <div className="tutorial-content">
        <h2>Learn by playing</h2>
        <p>
          This place mixes Scratch-style friendly steps with a code editor. Read the goal, write one line at a
          time, then run it to see the console change.
        </p>
        <div className="tutorial-steps">
          <div className="tutorial-step">
            <strong>1. Read the mission</strong>
            <span>Each level gives you a small job.</span>
          </div>
          <div className="tutorial-step">
            <strong>2. Type your code</strong>
            <span>Try simple variable words, lists, and show commands.</span>
          </div>
          <div className="tutorial-step">
            <strong>3. Run and check</strong>
            <span>The console and Problems panel tell you what happened.</span>
          </div>
        </div>
      </div>
      <div className="tutorial-actions">
        <button className="primary-button" onClick={() => setActiveIndex(0)} type="button">
          Start Tutorial
        </button>
        <button
          className="secondary-button"
          onClick={() => setShowCommandsPanel(true)}
          type="button"
        >
          Open command tab
        </button>
        <button
          className="secondary-button"
          onClick={() => setShowTutorialCard(false)}
          type="button"
        >
          Skip for now
        </button>
      </div>
    </div>
  ) : null;

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

        {tutorialPanel}

        <section className="workspace-body">
          <section className="ide-grid" style={ideGridStyle}>
            <aside className="sidebar panel-surface">
            <div className="section-label section-label-accent">Explorer</div>

            <div className="explorer-note">
              <strong>Choose a path</strong>
              <span>Blue tags are friendly lessons. Locked missions open as you finish the one before.</span>
            </div>

            <div className="mission-list">
              {(() => {
                const map = new Map<string, typeof challenges>();

                challenges.forEach((c) => {
                  const key = c.category ?? "General";
                  if (!map.has(key)) map.set(key, [] as typeof challenges);
                  map.get(key)!.push(c);
                });

                return Array.from(map.entries()).map(([category, items]) => (
                  <div key={category} style={{ marginBottom: 8 }}>
                    <div className="section-label section-label-category">{category}</div>
                    {items.map((challenge) => {
                      const index = challenges.findIndex((ch) => ch.id === challenge.id);
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
                            <span className={`file-icon file-icon-${category.toLowerCase().replace(/[^a-z]/g, "-")}`} />
                            <strong>{challenge.title}.story</strong>
                          </div>
                          <div className="mission-pill-row">
                            <span className="mission-pill">{challenge.badge}</span>
                            <span className="mission-pill mission-pill-secondary">{category}</span>
                          </div>
                          <span className="mission-status">
                            {complete ? "done" : unlocked ? challenge.badge.toLowerCase() : "locked"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>

            <div className="sidebar-footer">
              <div className="section-label section-label-accent">Progress</div>
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
                <button
                  className={`file-tab command-tab ${showCommandsPanel ? "active" : ""}`}
                  onClick={() => setShowCommandsPanel((current) => !current)}
                  type="button"
                >
                  Command reference
                </button>
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

            <div className="lesson-strip">
              <strong>Today&apos;s lesson</strong>
              <span>
                {activeIndex === 0
                  ? "Start with the tutorial, then move through the adventure line by line."
                  : `You are on mission ${activeIndex + 1}. Finish this one to unlock the next.`}
              </span>
            </div>

            <div className="editor-shell">
              <div className="editor-gutter" ref={editorGutterRef} aria-hidden="true">
                {Array.from({ length: editorLineCount }, (_, index) => (
                  <span key={`line-${index + 1}`}>{index + 1}</span>
                ))}
              </div>

              <div className="editor-stack">
                <pre
                  className="editor-highlight"
                  ref={editorBackdropRef}
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: `${highlightedProgram}\n` }}
                />
                <textarea
                  className="editor-input"
                  placeholder={"Write one action per line."}
                  spellCheck={false}
                  value={program}
                  onChange={(event) => updateProgram(event.target.value)}
                  onScroll={syncEditorScroll}
                />
              </div>
            </div>

            <div className="editor-footer">
              <span>{lineCount} lines</span>
              <span>{showHint ? activeChallenge.hint : "Tip is tucked away."}</span>
              <span className={`footer-status footer-status-${runState}`}>
                {allProblems.length > 0
                  ? `${allProblems.length} problem${allProblems.length > 1 ? "s" : ""}`
                  : celebration || statusLabel}
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
                <strong>Command reference</strong>
                <p className="guide-copy">Open the tab above to see syntax examples.</p>
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

              <div className="console-shell" style={consoleBodyStyle}>
                <div
                  aria-label="Resize console"
                  className="resize-handle resize-handle-horizontal console-grab"
                  onPointerDown={(event) => {
                    if (isCompactLayout) {
                      return;
                    }

                    event.preventDefault();
                    setDragState({
                      type: "terminal-bottom",
                      startY: event.clientY,
                      startHeight: layout.bottomTerminalHeight,
                    });
                  }}
                  role="separator"
                />
                {terminalPanel}
              </div>
            </aside>
          </section>
        </section>
        {commandReferencePanel}
      </section>
    </main>
  );
}
