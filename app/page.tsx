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

const assistStorageKey = "story-code-lab-scratch-assist";

type GuideEntry = {
  scratch: string;
  python: string;
  note: string;
};

const languageGuide: GuideEntry[] = [
  {
    scratch: 'say "Hello!"',
    python: 'print("Hello!")',
    note: "Friendly output for beginners.",
  },
  {
    scratch: "repeat 3 times\n  say \"beep\"",
    python: "for i in range(3):\n    print(\"beep\")",
    note: "Use repeat blocks now, loops later.",
  },
  {
    scratch: "make a number called score with 10",
    python: "score = 10",
    note: "A simple variable with a name.",
  },
  {
    scratch: "change score by 1",
    python: "score += 1",
    note: "Quick way to grow a number.",
  },
  {
    scratch: "make a list called backpack with \"map\", \"snack\", \"rope\"",
    python: "backpack = [\"map\", \"snack\", \"rope\"]",
    note: "Lists hold multiple items.",
  },
  {
    scratch: "add \"flashlight\" to backpack",
    python: "backpack.append(\"flashlight\")",
    note: "Adds one new item to a list.",
  },
  {
    scratch: "set total to sum of nums",
    python: "total = sum(nums)",
    note: "Built-in helper for totals.",
  },
  {
    scratch: "set tallest to biggest number in heights",
    python: "tallest = max(heights)",
    note: "Find the biggest value fast.",
  },
];

type AutocompleteSnippet = {
  description: string;
  label: string;
  snippet: string;
  trigger: string;
};

const autocompleteSnippets: AutocompleteSnippet[] = [
  {
    trigger: "say",
    label: 'say "..."',
    snippet: 'say "<>"',
    description: "Make the screen talk in a Scratch-style way.",
  },
  {
    trigger: "show",
    label: "show value",
    snippet: "show <>total",
    description: "Print a variable, number, or list.",
  },
  {
    trigger: "repeat",
    label: "repeat block",
    snippet: 'repeat <>3 times\n  say "beep"',
    description: "Create a small loop block with indentation.",
  },
  {
    trigger: "make a list",
    label: "make list",
    snippet: 'make a list called <>items with "map", "snack", "rope"',
    description: "Start a list of items.",
  },
  {
    trigger: "make a number",
    label: "make number",
    snippet: "make a number called <>score with 10",
    description: "Create a number variable.",
  },
  {
    trigger: "set",
    label: "set variable",
    snippet: "set <>total to sum of nums",
    description: "Set a variable to a new value.",
  },
  {
    trigger: "change",
    label: "change number",
    snippet: "change <>score by 1",
    description: "Increase or decrease a number.",
  },
  {
    trigger: "add",
    label: "add to list",
    snippet: 'add <>"flashlight" to backpack',
    description: "Add a new item into a list.",
  },
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
  "append",
  "change",
  "repeat",
  "show",
  "print",
  "say",
]);

const typeKeywords = new Set(["list", "array", "number", "word", "text", "string", "boolean", "flag"]);

const expressionKeywords = new Set([
  "called",
  "with",
  "sum",
  "of",
  "biggest",
  "largest",
  "smallest",
  "size",
  "length",
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

const stripCaretMarker = (value: string) => value.replace("<>", "");

const getSnippetMatch = (linePrefix: string) => {
  const normalizedPrefix = linePrefix.trim().toLowerCase();

  if (!normalizedPrefix) {
    return null;
  }

  const matches = autocompleteSnippets.filter((snippet) =>
    snippet.trigger.startsWith(normalizedPrefix),
  );

  if (matches.length === 0) {
    return null;
  }

  return matches.sort((left, right) => left.trigger.length - right.trigger.length)[0];
};

const getLineRange = (value: string, selectionStart: number, selectionEnd: number) => {
  const lineStart = value.lastIndexOf("\n", Math.max(selectionStart - 1, 0)) + 1;
  const nextBreak = value.indexOf("\n", selectionEnd);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;

  return { lineEnd, lineStart };
};

const indentSnippet = (snippet: string, indent: string) =>
  snippet
    .split("\n")
    .map((line) => `${indent}${line}`)
    .join("\n");

const getAutocompletePreview = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
) => {
  if (selectionStart !== selectionEnd) {
    return null;
  }

  const { lineStart } = getLineRange(value, selectionStart, selectionEnd);
  const beforeCaret = value.slice(lineStart, selectionStart);
  const snippet = getSnippetMatch(beforeCaret);

  if (!snippet) {
    return null;
  }

  return {
    ...snippet,
    preview: stripCaretMarker(snippet.snippet),
  };
};

const applyAutocomplete = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
) => {
  const { lineEnd, lineStart } = getLineRange(value, selectionStart, selectionEnd);
  const fullLine = value.slice(lineStart, lineEnd);
  const beforeCaret = value.slice(lineStart, selectionStart);
  const snippet = getSnippetMatch(beforeCaret);

  if (!snippet) {
    return null;
  }

  const indent = (fullLine.match(/^\s*/) ?? [""])[0];
  const expandedSnippet = indentSnippet(snippet.snippet, indent);
  const caretOffset = expandedSnippet.indexOf("<>");
  const completedLine = stripCaretMarker(expandedSnippet);
  const nextValue = `${value.slice(0, lineStart)}${completedLine}${value.slice(lineEnd)}`;
  const nextCaret = lineStart + (caretOffset === -1 ? completedLine.length : caretOffset);

  return {
    nextCaret,
    nextValue,
    snippet,
  };
};

const lintProgram = (program: string): EditorIssue[] => {
  const issues: EditorIssue[] = [];
  const knownNames = new Set<string>();
  const lines = program.split(/\r?\n/);
  const blockStack: number[] = [];

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    const indent = (rawLine.match(/^\s*/) ?? [""])[0].replace(/\t/g, "  ").length;

    if (!trimmed) {
      return;
    }

    while (blockStack.length > 0 && indent <= blockStack[blockStack.length - 1]) {
      blockStack.pop();
    }

    const firstToken = (trimmed.match(/^([a-zA-Z_][\w-]*)/) ?? [""])[1];

    if (!firstToken) {
      return;
    }

    const isAssignmentLike = /^([a-zA-Z_][\w]*)\s*[:=]/.test(trimmed);
    const lowerFirst = firstToken.toLowerCase();

    if (indent > 0 && blockStack.length === 0) {
      issues.push({
        line: index + 1,
        token: firstToken,
        message: "This indented line needs to sit under a repeat block.",
      });
    }

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
        /^make (?:a )?(list|array|number|word|text|string|boolean|flag) called ([a-zA-Z][\w\s]*) (?:with|=) (.+)$/i;

      if (!makePattern.test(trimmed)) {
        issues.push({
          line: index + 1,
          token: "make",
          message: "Expected: make a <type> called <name> with <value>",
        });
      } else {
        const createdName = trimmed.match(makePattern);

        if (createdName) {
          knownNames.add(normalizeEditorName(createdName[2]));
        }
      }
    }

    if (lowerFirst === "repeat") {
      if (!/^repeat .+ times(\s*:\s*.+)?\s*$/i.test(trimmed)) {
        issues.push({
          line: index + 1,
          token: "repeat",
          message: "Expected: repeat <number> times",
        });
      } else if (!/:/.test(trimmed)) {
        blockStack.push(indent);
      }
    }

    if (
      ["show", "print", "say"].includes(lowerFirst) &&
      !/^(show|print|say)\s*(\(.+\)|.+)$/i.test(trimmed)
    ) {
      issues.push({
        line: index + 1,
        token: firstToken,
        message: "Expected a value after say/show/print.",
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

    if (["show", "print"].includes(lowerFirst)) {
      const expression = trimmed.replace(/^(show|print)\s*/i, "").replace(/^\((.+)\)$/i, "$1").trim();
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

    if (lowerFirst === "set" && !/^set [a-zA-Z][\w\s]* (?:to|=) .+$/i.test(trimmed)) {
      issues.push({
        line: index + 1,
        token: firstToken,
        message: "Expected: set <name> to <value>",
      });
    }

    if (lowerFirst === "change" && !/^change [a-zA-Z][\w\s]* by .+$/i.test(trimmed)) {
      issues.push({
        line: index + 1,
        token: firstToken,
        message: "Expected: change <name> by <number>",
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
  const editorInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [showCommandsPanel, setShowCommandsPanel] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);
  const [showTutorialCard, setShowTutorialCard] = useState(true);
  const [scratchAssistEnabled, setScratchAssistEnabled] = useState(true);
  const [editorSelection, setEditorSelection] = useState({ start: 0, end: 0 });

  const activeChallenge = challenges[activeIndex];
  const program = drafts[activeChallenge.id] ?? "";
  const liveIssues = useMemo(() => lintProgram(program), [program]);
  const programLines = useMemo(() => program.split(/\r?\n/), [program]);
  const autocompletePreview = useMemo(
    () =>
      scratchAssistEnabled
        ? getAutocompletePreview(program, editorSelection.start, editorSelection.end)
        : null,
    [editorSelection.end, editorSelection.start, program, scratchAssistEnabled],
  );

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
    const savedAssistMode = window.localStorage.getItem(assistStorageKey);

    if (savedAssistMode) {
      setScratchAssistEnabled(savedAssistMode === "on");
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
    window.localStorage.setItem(
      assistStorageKey,
      scratchAssistEnabled ? "on" : "off",
    );
  }, [scratchAssistEnabled]);

  useEffect(() => {
    setResult(defaultResult);
    setCelebration("");
    setShowHint(false);
    setRunState("idle");
    setSuccessFlash(false);
    setShowCommandsPanel(false);
    setEditorSelection({ start: 0, end: 0 });
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

  const syncEditorSelection = (target: HTMLTextAreaElement) => {
    setEditorSelection({
      start: target.selectionStart,
      end: target.selectionEnd,
    });
  };

  const updateProgramAndSelection = (
    nextValue: string,
    nextStart: number,
    nextEnd = nextStart,
  ) => {
    updateProgram(nextValue);

    requestAnimationFrame(() => {
      if (!editorInputRef.current) {
        return;
      }

      editorInputRef.current.focus();
      editorInputRef.current.setSelectionRange(nextStart, nextEnd);
      setEditorSelection({ start: nextStart, end: nextEnd });
    });
  };

  const insertAtSelection = (
    valueToInsert: string,
    target: HTMLTextAreaElement,
  ) => {
    const nextValue =
      program.slice(0, target.selectionStart) +
      valueToInsert +
      program.slice(target.selectionEnd);
    const nextCaret = target.selectionStart + valueToInsert.length;

    updateProgramAndSelection(nextValue, nextCaret);
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;

    if (event.key === "Tab") {
      event.preventDefault();

      if (scratchAssistEnabled) {
        const completion = applyAutocomplete(
          program,
          target.selectionStart,
          target.selectionEnd,
        );

        if (completion) {
          updateProgramAndSelection(completion.nextValue, completion.nextCaret);
          return;
        }
      }

      insertAtSelection("  ", target);
      return;
    }

    if (event.key === "Enter") {
      const { lineStart } = getLineRange(program, target.selectionStart, target.selectionEnd);
      const currentLine = program.slice(lineStart, target.selectionStart);
      const currentIndent = (currentLine.match(/^\s*/) ?? [""])[0];
      const extraIndent = /^repeat .+ times\s*:?\s*$/i.test(currentLine.trim()) ? "  " : "";

      event.preventDefault();
      insertAtSelection(`\n${currentIndent}${extraIndent}`, target);
    }
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
        ? "The code hit a real problem. Check the line notes and try again."
        : runState === "not-yet"
          ? "Your code ran, but it has not finished the mission yet."
          : activeMissionComplete
            ? "This mission was already cleared before."
            : "Write your code, then press Run.";

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
        <strong>Scratch To Python Guide</strong>
        <button
          className="secondary-button"
          onClick={() => setShowCommandsPanel(false)}
          type="button"
        >
          Close
        </button>
      </div>
      <p className="guide-copy">
        Use the Scratch-style version on the left. The Python version is there so kids can see
        where they are heading next.
      </p>
      <div className="guide-list">
        {languageGuide.map((entry) => (
          <div key={entry.scratch} className="guide-card">
            <div>
              <span className="guide-label">Scratch-style now</span>
              <code className="guide-line">{entry.scratch}</code>
            </div>
            <div>
              <span className="guide-label">Python later</span>
              <code className="guide-line">{entry.python}</code>
            </div>
            <p className="guide-note">{entry.note}</p>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const tutorialPanel = showTutorialCard ? (
    <div className="tutorial-banner" role="region" aria-label="Tutorial">
      <div className="tutorial-badge">Start Here</div>
      <div className="tutorial-content">
        <h2>Scratch first, Python next</h2>
        <p>
          This game starts with easy commands like <code>say</code> and <code>repeat 3 times</code>,
          then slowly points toward real Python. Read the mission, type one idea at a time, and run it.
        </p>
        <div className="tutorial-steps">
          <div className="tutorial-step">
            <strong>1. Read the mission</strong>
            <span>Each level gives you a small job with a clear goal.</span>
          </div>
          <div className="tutorial-step">
            <strong>2. Type your code</strong>
            <span>Try kid-friendly commands like say, repeat, make, set, and change.</span>
          </div>
          <div className="tutorial-step">
            <strong>3. Run and check</strong>
            <span>The console and Problems tab explain what worked and what needs fixing.</span>
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
          Open syntax guide
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
              <p className="brand-kicker">Scratch To Python</p>
              <h1>Mission Code Lab</h1>
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
              <span>Start small, clear each mission, and unlock the next one like a game map.</span>
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
                  Syntax guide
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
                  className={`secondary-button ${scratchAssistEnabled ? "mode-button-active" : ""}`}
                  onClick={() => setScratchAssistEnabled((current) => !current)}
                  type="button"
                >
                  {scratchAssistEnabled ? "Scratch assist: on" : "Scratch assist: off"}
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
                  ? "Start with say and simple messages. You do not need perfect Python on day one."
                  : `Mission ${activeIndex + 1} builds on the one before it. Scratch-style code is allowed here.`}
              </span>
            </div>

            {scratchAssistEnabled ? (
              <div className="assist-strip">
                <strong>Scratch assist</strong>
                <span>
                  {autocompletePreview
                    ? `Press Tab to complete: ${autocompletePreview.preview}`
                    : "Press Tab to autocomplete commands like say, repeat, make a list, or change score by 1."}
                </span>
              </div>
            ) : null}

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
                  placeholder={"Write one action per line. Try: say \"Hello!\""}
                  ref={editorInputRef}
                  spellCheck={false}
                  value={program}
                  onChange={(event) => {
                    updateProgram(event.target.value);
                    syncEditorSelection(event.currentTarget);
                  }}
                  onClick={(event) => syncEditorSelection(event.currentTarget)}
                  onKeyDown={handleEditorKeyDown}
                  onKeyUp={(event) => syncEditorSelection(event.currentTarget)}
                  onScroll={syncEditorScroll}
                  onSelect={(event) => syncEditorSelection(event.currentTarget)}
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
                <strong>Bridge to Python</strong>
                <p className="guide-copy">
                  Use Scratch-style commands here. Open the syntax guide to compare them with Python.
                </p>
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
