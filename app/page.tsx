"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { challenges } from "@/lib/challenges";
import { runStoryProgram, type StoryResult } from "@/lib/story-runtime";

const completionStorageKey = "story-code-lab-progress";
const layoutStorageKey = "story-code-lab-layout";
const assistStorageKey = "story-code-lab-scratch-assist";

const defaultResult: StoryResult = {
  generatedCode: [],
  output: [],
  variables: {},
  steps: [],
  errors: [],
  lineCount: 0,
  source: "",
};

type CommandSection = {
  title: string;
  lines: string[];
};

const commandLibrary: CommandSection[] = [
  {
    title: "Talking",
    lines: ['say "Hello!"', "show total", 'print("Ready")'],
  },
  {
    title: "Numbers",
    lines: [
      "make a number called score with 10",
      "set total to 0",
      "change total by 1",
      "show score + 2",
    ],
  },
  {
    title: "Lists",
    lines: [
      'create list backpack',
      'make a list called snacks with "apple", "pear", "toast"',
      'add "water" to backpack',
      "show item 2 of snacks",
      'insert "Kai" at 2 of guests',
      'replace item 4 of guests with "Zoe"',
      "delete item 1 of guests",
      'show backpack contains "map"',
    ],
  },
  {
    title: "Loops",
    lines: ['repeat 3 times\n  say "beep"', "repeat total times\n  change score by 1"],
  },
];

type EditorIssue = {
  line: number;
  token: string;
  message: string;
};

type AutocompleteSnippet = {
  label: string;
  snippet: string;
  trigger: string;
};

const autocompleteSnippets: AutocompleteSnippet[] = [
  { trigger: "say", label: 'say "..."', snippet: 'say "<>"' },
  { trigger: "show", label: "show value", snippet: "show <>total" },
  { trigger: "repeat", label: "repeat block", snippet: 'repeat <>3 times\n  say "beep"' },
  { trigger: "create list", label: "create list", snippet: "create list <>items" },
  {
    trigger: "make a list",
    label: "make list",
    snippet: 'make a list called <>items with "map", "snack", "rope"',
  },
  {
    trigger: "make a number",
    label: "make number",
    snippet: "make a number called <>score with 10",
  },
  { trigger: "set", label: "set value", snippet: "set <>total to sum of nums" },
  { trigger: "change", label: "change number", snippet: "change <>score by 1" },
  { trigger: "add", label: "add item", snippet: 'add <>"flashlight" to backpack' },
  { trigger: "insert", label: "insert item", snippet: 'insert <>"Kai" at 2 of guests' },
  {
    trigger: "replace item",
    label: "replace item",
    snippet: 'replace item <>2 of guests with "Zoe"',
  },
  {
    trigger: "delete item",
    label: "delete item",
    snippet: "delete item <>1 of guests",
  },
  {
    trigger: "show item",
    label: "show item",
    snippet: "show item <>2 of snacks",
  },
];

const commandKeywords = new Set([
  "make",
  "create",
  "variable",
  "let",
  "const",
  "set",
  "answer",
  "add",
  "push",
  "append",
  "insert",
  "replace",
  "delete",
  "change",
  "repeat",
  "show",
  "print",
  "say",
]);

const typeKeywords = new Set([
  "list",
  "array",
  "number",
  "word",
  "text",
  "string",
  "boolean",
  "flag",
]);

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
  "contains",
  "true",
  "false",
  "and",
]);

const arithmeticTokenPattern =
  /"[^"]*"|'[^']*'|\b-?\d+(?:\.\d+)?\b|[a-zA-Z_][\w]*|[+\-*/]/g;

const isArithmeticOperator = (token: string) =>
  token === "+" || token === "-" || token === "*" || token === "/";

const isKnownValueToken = (token: string, knownNames: Set<string>) =>
  /^-?\d+(?:\.\d+)?$/.test(token) ||
  /^"[^"]*"$|^'[^']*'$/.test(token) ||
  knownNames.has(token.toLowerCase());

const normalizeEditorName = (value: string) =>
  value.trim().replace(/\s+/g, "_");

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
  const table = Array.from({ length: rows }, () =>
    Array<number>(cols).fill(0),
  );

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

  return matches.sort(
    (left, right) => left.trigger.length - right.trigger.length,
  )[0];
};

const getLineRange = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
) => {
  const lineStart =
    value.lastIndexOf("\n", Math.max(selectionStart - 1, 0)) + 1;
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
  const { lineEnd, lineStart } = getLineRange(
    value,
    selectionStart,
    selectionEnd,
  );
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
  const nextCaret =
    lineStart + (caretOffset === -1 ? completedLine.length : caretOffset);

  return {
    nextCaret,
    nextValue,
  };
};

const lintProgram = (program: string): EditorIssue[] => {
  const issues: EditorIssue[] = [];
  const knownNames = new Set<string>();
  const lines = program.split(/\r?\n/);
  const blockStack: number[] = [];

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    const indent = (rawLine.match(/^\s*/) ?? [""])[0]
      .replace(/\t/g, "  ")
      .length;

    if (!trimmed) {
      return;
    }

    while (
      blockStack.length > 0 &&
      indent <= blockStack[blockStack.length - 1]
    ) {
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

    if (lowerFirst === "create" && !/^create list [a-zA-Z][\w\s]*$/i.test(trimmed)) {
      issues.push({
        line: index + 1,
        token: "create",
        message: "Expected: create list <name>",
      });
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

    if (lowerFirst === "insert" && !/^insert .+ at .+ of [a-zA-Z][\w\s]*$/i.test(trimmed)) {
      issues.push({
        line: index + 1,
        token: "insert",
        message: "Expected: insert <item> at <number> of <list>",
      });
    }

    if (
      lowerFirst === "replace" &&
      !/^replace item .+ of [a-zA-Z][\w\s]* with .+$/i.test(trimmed)
    ) {
      issues.push({
        line: index + 1,
        token: "replace",
        message: "Expected: replace item <number> of <list> with <item>",
      });
    }

    if (lowerFirst === "delete" && !/^delete item .+ of [a-zA-Z][\w\s]*$/i.test(trimmed)) {
      issues.push({
        line: index + 1,
        token: "delete",
        message: "Expected: delete item <number> of <list>",
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
      const expression = trimmed
        .replace(/^(show|print)\s*/i, "")
        .replace(/^\((.+)\)$/i, "$1")
        .trim();
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

    if (
      lowerFirst === "set" &&
      !/^set [a-zA-Z][\w\s]* (?:to|=) .+$/i.test(trimmed)
    ) {
      issues.push({
        line: index + 1,
        token: firstToken,
        message: "Expected: set <name> to <value>",
      });
    }

    if (
      lowerFirst === "change" &&
      !/^change [a-zA-Z][\w\s]* by .+$/i.test(trimmed)
    ) {
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

  const tokenPattern =
    /(\s+|"[^"]*"|'[^']*'|\b\d+(?:\.\d+)?\b|[a-zA-Z_][\w-]*|==|=|\[|\]|\(|\)|,|\.|:|;|\+|-|\*|\/)/g;
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
type InspectorTab = "mission" | "commands";
type PanelId = "console" | "problems";
type PanelDock = "bottom" | "floating";

type LayoutState = {
  bottomHeight: number;
  leftWidth: number;
  rightWidth: number;
};

type DragState =
  | { type: "left"; startX: number; startWidth: number }
  | { type: "right"; startX: number; startWidth: number }
  | { type: "bottom"; startY: number; startHeight: number };

type DockPanelState = {
  dock: PanelDock;
  height: number;
  width: number;
  x: number;
  y: number;
};

type FloatingDragState = {
  offsetX: number;
  offsetY: number;
  panelId: PanelId;
};

const panelTitles: Record<PanelId, string> = {
  console: "Terminal",
  problems: "Problems",
};

export default function Home() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      challenges.map((challenge) => [challenge.id, challenge.starter]),
    ),
  );
  const [result, setResult] = useState<StoryResult>(defaultResult);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [celebration, setCelebration] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [runState, setRunState] = useState<RunState>("idle");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("mission");
  const [layout, setLayout] = useState<LayoutState>({
    leftWidth: 220,
    rightWidth: 320,
    bottomHeight: 230,
  });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const editorBackdropRef = useRef<HTMLPreElement | null>(null);
  const editorGutterRef = useRef<HTMLDivElement | null>(null);
  const editorInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [assistEnabled, setAssistEnabled] = useState(true);
  const [editorSelection, setEditorSelection] = useState({ start: 0, end: 0 });
  const [successFlash, setSuccessFlash] = useState(false);
  const [showAllProblems, setShowAllProblems] = useState(false);
  const bottomDockRef = useRef<HTMLDivElement | null>(null);
  const consolePanelRef = useRef<HTMLDivElement | null>(null);
  const problemsPanelRef = useRef<HTMLDivElement | null>(null);
  const [floatingDrag, setFloatingDrag] = useState<FloatingDragState | null>(null);
  const [panels, setPanels] = useState<Record<PanelId, DockPanelState>>({
    console: { dock: "bottom", height: 220, width: 460, x: 220, y: 140 },
    problems: { dock: "bottom", height: 240, width: 460, x: 300, y: 180 },
  });

  const activeChallenge = challenges[activeIndex];
  const program = drafts[activeChallenge.id] ?? "";
  const liveIssues = useMemo(() => lintProgram(program), [program]);
  const programLines = useMemo(() => program.split(/\r?\n/), [program]);
  const autocompletePreview = useMemo(
    () =>
      assistEnabled
        ? getAutocompletePreview(
            program,
            editorSelection.start,
            editorSelection.end,
          )
        : null,
    [assistEnabled, editorSelection.end, editorSelection.start, program],
  );

  const highlightedProgram = useMemo(() => {
    const issueTokensByLine = new Map<number, Map<string, string[]>>();

    liveIssues.forEach((issue) => {
      const existing =
        issueTokensByLine.get(issue.line) ?? new Map<string, string[]>();
      const tokenKey = issue.token.toLowerCase();
      const messages = existing.get(tokenKey) ?? [];

      messages.push(issue.message);
      existing.set(tokenKey, messages);
      issueTokensByLine.set(issue.line, existing);
    });

    return programLines
      .map((line, index) =>
        colorizeLine(
          line,
          issueTokensByLine.get(index + 1) ?? new Map<string, string[]>(),
        ),
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
      setAssistEnabled(savedAssistMode === "on");
    }
  }, []);

  useEffect(() => {
    const savedLayout = window.localStorage.getItem(layoutStorageKey);

    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout) as Partial<LayoutState>;

        setLayout((current) => ({
          bottomHeight: parsed.bottomHeight ?? current.bottomHeight,
          leftWidth: parsed.leftWidth ?? current.leftWidth,
          rightWidth: parsed.rightWidth ?? current.rightWidth,
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
    window.localStorage.setItem(assistStorageKey, assistEnabled ? "on" : "off");
  }, [assistEnabled]);

  useEffect(() => {
    setResult(defaultResult);
    setCelebration("");
    setShowHint(false);
    setRunState("idle");
    setShowAllProblems(false);
    setEditorSelection({ start: 0, end: 0 });
  }, [activeChallenge]);

  useEffect(() => {
    if (!successFlash) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSuccessFlash(false);
    }, 1400);

    return () => window.clearTimeout(timeout);
  }, [successFlash]);

  useEffect(() => {
    if (isCompactLayout) {
      setDragState(null);
      setFloatingDrag(null);
      setPanels((current) => ({
        console: { ...current.console, dock: "bottom" },
        problems: { ...current.problems, dock: "bottom" },
      }));
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
      end: target.selectionEnd,
      start: target.selectionStart,
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

  const handleEditorKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    const target = event.currentTarget;

    if (event.key === "Tab") {
      event.preventDefault();

      if (assistEnabled) {
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
      const { lineStart } = getLineRange(
        program,
        target.selectionStart,
        target.selectionEnd,
      );
      const currentLine = program.slice(lineStart, target.selectionStart);
      const currentIndent = (currentLine.match(/^\s*/) ?? [""])[0];
      const extraIndent = /^repeat .+ times\s*:?\s*$/i.test(
        currentLine.trim(),
      )
        ? "  "
        : "";

      event.preventDefault();
      insertAtSelection(`\n${currentIndent}${extraIndent}`, target);
    }
  };

  const runProgram = () => {
    const nextResult = runStoryProgram(program);
    const passed = activeChallenge.check(nextResult);

    setResult(nextResult);
    setShowAllProblems(false);

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
      ? "That run solved the mission."
      : runState === "error"
        ? "The code hit a real problem. Read the Problems panel and try again."
        : runState === "not-yet"
          ? "The code ran, but it did not satisfy the mission yet."
          : activeMissionComplete
            ? "This mission was already cleared."
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
  }));

  const allProblems = [...lintProblems, ...runtimeProblems];
  const visibleProblems = showAllProblems ? allProblems : allProblems.slice(0, 8);
  const hiddenProblems = Math.max(0, allProblems.length - visibleProblems.length);
  const terminalLines =
    result.output.length > 14 ? result.output.slice(-14) : result.output;
  const hiddenTerminalLines = Math.max(0, result.output.length - terminalLines.length);

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
        380,
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
        280,
        430,
      );

      setLayout((current) => ({
        ...current,
        rightWidth: nextWidth,
      }));
      return;
    }

    const nextHeight = clamp(
      dragState.startHeight - (event.clientY - dragState.startY),
      170,
      360,
    );

    setLayout((current) => ({
      ...current,
      bottomHeight: nextHeight,
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
      dragState.type === "bottom" ? "row-resize" : "col-resize";

    return () => {
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [dragState, handleDragMove]);

  const handleFloatingMove = useEffectEvent((event: PointerEvent) => {
    if (!floatingDrag) {
      return;
    }

    const nextX = clamp(
      event.clientX - floatingDrag.offsetX,
      24,
      window.innerWidth - 220,
    );
    const nextY = clamp(
      event.clientY - floatingDrag.offsetY,
      56,
      window.innerHeight - 120,
    );

    setPanels((current) => ({
      ...current,
      [floatingDrag.panelId]: {
        ...current[floatingDrag.panelId],
        dock: "floating",
        x: nextX,
        y: nextY,
      },
    }));
  });

  useEffect(() => {
    if (!floatingDrag) {
      return;
    }

    const handlePointerUp = (event: PointerEvent) => {
      const dockRect = bottomDockRef.current?.getBoundingClientRect();

      if (
        dockRect &&
        event.clientX >= dockRect.left &&
        event.clientX <= dockRect.right &&
        event.clientY >= dockRect.top - 32 &&
        event.clientY <= dockRect.bottom + 32
      ) {
        setPanels((current) => ({
          ...current,
          [floatingDrag.panelId]: {
            ...current[floatingDrag.panelId],
            dock: "bottom",
          },
        }));
      }

      setFloatingDrag(null);
    };

    window.addEventListener("pointermove", handleFloatingMove);
    window.addEventListener("pointerup", handlePointerUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "move";

    return () => {
      window.removeEventListener("pointermove", handleFloatingMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [floatingDrag, handleFloatingMove]);

  const startPanelDrag = (
    panelId: PanelId,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (isCompactLayout) {
      return;
    }

    const panelRef =
      panelId === "console" ? consolePanelRef.current : problemsPanelRef.current;

    if (!panelRef) {
      return;
    }

    const rect = panelRef.getBoundingClientRect();

    setPanels((current) => ({
      ...current,
      [panelId]: {
        ...current[panelId],
        dock: "floating",
        height: rect.height,
        width: rect.width,
        x: rect.left,
        y: rect.top,
      },
    }));
    setFloatingDrag({
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      panelId,
    });
  };

  const dockBottomPanels = (Object.keys(panels) as PanelId[]).filter(
    (panelId) => panels[panelId].dock === "bottom",
  );
  const floatingPanels = (Object.keys(panels) as PanelId[]).filter(
    (panelId) => panels[panelId].dock === "floating",
  );

  const ideGridStyle = isCompactLayout
    ? undefined
    : {
        gridTemplateColumns: `${layout.leftWidth}px 6px minmax(0, 1fr) 6px ${layout.rightWidth}px`,
      };

  const workbenchStyle = isCompactLayout
    ? undefined
    : {
        gridTemplateRows: `minmax(0, 1fr) 6px ${layout.bottomHeight}px`,
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

  const renderPanel = (panelId: PanelId, floating = false) => {
    const panelRef = panelId === "console" ? consolePanelRef : problemsPanelRef;
    const panelState = panels[panelId];

    return (
      <div
        className={`dock-panel ${floating ? "dock-panel-floating" : ""}`}
        key={panelId}
        ref={panelRef}
        style={
          floating
            ? {
                height: panelState.height,
                left: panelState.x,
                top: panelState.y,
                width: panelState.width,
              }
            : undefined
        }
      >
        <div
          className="dock-panel-header"
          onPointerDown={(event) => startPanelDrag(panelId, event)}
        >
          <div>
            <strong>{panelTitles[panelId]}</strong>
            <span>{floating ? "Floating panel" : "Drag to undock"}</span>
          </div>
          <div className="dock-panel-actions">
            {floating ? (
              <button
                className="secondary-button"
                onClick={() =>
                  setPanels((current) => ({
                    ...current,
                    [panelId]: { ...current[panelId], dock: "bottom" },
                  }))
                }
                type="button"
              >
                Dock Bottom
              </button>
            ) : null}
          </div>
        </div>

        {panelId === "console" ? (
          <div className="dock-panel-body">
            {hiddenTerminalLines > 0 ? (
              <p className="panel-note">
                Showing the latest {terminalLines.length} lines. {hiddenTerminalLines} earlier
                line{hiddenTerminalLines > 1 ? "s were" : " was"} hidden.
              </p>
            ) : null}
            <pre className="code-view dock-code-view">
              {terminalLines.length > 0
                ? [`$ run ${activeChallenge.title}.story`, ...terminalLines].join("\n")
                : "$ Run your code to see output."}
            </pre>
          </div>
        ) : (
          <div className="dock-panel-body">
            {visibleProblems.length > 0 ? (
              <>
                <div className="problem-summary">
                  <strong>{allProblems.length} problem{allProblems.length > 1 ? "s" : ""}</strong>
                  {hiddenProblems > 0 ? (
                    <button
                      className="secondary-button"
                      onClick={() => setShowAllProblems((current) => !current)}
                      type="button"
                    >
                      {showAllProblems ? "Show fewer" : `Show ${hiddenProblems} more`}
                    </button>
                  ) : null}
                </div>
                <div className="problem-list">
                  {visibleProblems.map((problem) => (
                    <p key={problem.id} className="error-line">
                      {problem.line ? `Line ${problem.line}: ` : ""}
                      {problem.message}
                    </p>
                  ))}
                </div>
              </>
            ) : result.steps.length > 0 ? (
              <div className="problem-list">
                {result.steps.slice(-6).map((step) => (
                  <p key={step}>{step}</p>
                ))}
              </div>
            ) : (
              <p className="panel-note">
                Problems will appear here. Clean runs leave this panel quiet.
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

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
            <span>
              Mission {activeIndex + 1} of {challenges.length}
            </span>
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
                const previousCategory =
                  index === 0 ? null : challenges[index - 1].category;
                const showCategory = challenge.category !== previousCategory;

                return (
                  <div key={challenge.id}>
                    {showCategory ? (
                      <div className="section-label section-label-category">
                        {challenge.category}
                      </div>
                    ) : null}
                    <button
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
                        <span
                          className={`file-icon file-icon-${(challenge.category ?? "general")
                            .toLowerCase()
                            .replace(/[^a-z]/g, "-")}`}
                        />
                        <strong>
                          {index + 1}. {challenge.title}.story
                        </strong>
                      </div>
                      <span className="mission-status">
                        {complete
                          ? "done"
                          : unlocked
                            ? challenge.badge.toLowerCase()
                            : "locked"}
                      </span>
                    </button>
                  </div>
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
                <span>
                  {completedCount} / {challenges.length} missions
                </span>
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
                startWidth: layout.leftWidth,
                startX: event.clientX,
                type: "left",
              });
            }}
            role="separator"
          />

          <section className="workbench-column" style={workbenchStyle}>
            <section
              className={`editor-column panel-surface ${successFlash ? "editor-success" : ""}`}
            >
              <div className="editor-toolbar">
                <div className="tab-row">
                  <span className="file-tab active">{activeChallenge.title}.story</span>
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
                    {showHint ? "Hide hint" : "Hint"}
                  </button>
                  <button
                    className={`secondary-button ${assistEnabled ? "mode-button-active" : ""}`}
                    onClick={() => setAssistEnabled((current) => !current)}
                    type="button"
                  >
                    {assistEnabled ? "Assist on" : "Assist off"}
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

              <div className="editor-shell">
                <div className="editor-gutter" ref={editorGutterRef} aria-hidden="true">
                  {Array.from({ length: editorLineCount }, (_, index) => (
                    <span key={`line-${index + 1}`}>{index + 1}</span>
                  ))}
                </div>

                <div className="editor-stack">
                  {successFlash ? (
                    <div className="success-overlay" aria-hidden="true">
                      <div className="success-badge">Passed</div>
                    </div>
                  ) : null}
                  <pre
                    className="editor-highlight"
                    ref={editorBackdropRef}
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: `${highlightedProgram}\n` }}
                  />
                  <textarea
                    className="editor-input"
                    placeholder={activeChallenge.placeholder}
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
                <span>
                  {showHint
                    ? activeChallenge.hint
                    : assistEnabled && autocompletePreview
                      ? `Tab completes: ${autocompletePreview.preview}`
                      : assistEnabled
                        ? "Tab can autocomplete Scratch-style commands."
                        : "Hints are hidden."}
                </span>
                <span className={`footer-status footer-status-${runState}`}>
                  {allProblems.length > 0
                    ? `${allProblems.length} problem${allProblems.length > 1 ? "s" : ""}`
                    : celebration || statusLabel}
                </span>
              </div>
            </section>

            <div
              aria-label="Resize output dock"
              className="resize-handle resize-handle-horizontal"
              onPointerDown={(event) => {
                if (isCompactLayout) {
                  return;
                }

                event.preventDefault();
                setDragState({
                  startHeight: layout.bottomHeight,
                  startY: event.clientY,
                  type: "bottom",
                });
              }}
              role="separator"
            />

            <section className="dock-area" ref={bottomDockRef}>
              <div className="dock-area-header">
                <strong>Output Dock</strong>
                <span>Drag Terminal or Problems to float them, then drag them back here to dock.</span>
              </div>
              <div
                className="dock-area-grid"
                style={{
                  gridTemplateColumns:
                    dockBottomPanels.length <= 1 ? "1fr" : "repeat(2, minmax(0, 1fr))",
                }}
              >
                {dockBottomPanels.length > 0 ? (
                  dockBottomPanels.map((panelId) => renderPanel(panelId))
                ) : (
                  <div className="dock-empty">
                    Drag Terminal or Problems here to dock them again.
                  </div>
                )}
              </div>
            </section>
          </section>

          <div
            aria-label="Resize mission panel"
            className="resize-handle resize-handle-vertical"
            onPointerDown={(event) => {
              if (isCompactLayout) {
                return;
              }

              event.preventDefault();
              setDragState({
                startWidth: layout.rightWidth,
                startX: event.clientX,
                type: "right",
              });
            }}
            role="separator"
          />

          <aside className="inspector-column panel-surface">
            <div className="inspector-tabs">
              <button
                className={`output-tab ${inspectorTab === "mission" ? "active" : ""}`}
                onClick={() => setInspectorTab("mission")}
                type="button"
              >
                Mission
              </button>
              <button
                className={`output-tab ${inspectorTab === "commands" ? "active" : ""}`}
                onClick={() => setInspectorTab("commands")}
                type="button"
              >
                Commands
              </button>
            </div>

            <div className="inspector-body">
              {inspectorTab === "mission" ? (
                <div className="info-card">
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
                  ) : (
                    <div className="goal-box subtle-box">
                      <strong>Hint</strong>
                      <p>Hidden until you ask for it.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="info-card">
                  <div className="goal-box subtle-box">
                    <strong>Command Library</strong>
                    <p className="guide-copy">
                      These are general building blocks. They are examples, not mission answers.
                    </p>
                  </div>
                  <div className="command-library">
                    {commandLibrary.map((section) => (
                      <div className="command-section" key={section.title}>
                        <strong>{section.title}</strong>
                        <div className="guide-list">
                          {section.lines.map((line) => (
                            <code className="guide-line" key={line}>
                              {line}
                            </code>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </section>

        {floatingPanels.map((panelId) => renderPanel(panelId, true))}
      </section>
    </main>
  );
}
