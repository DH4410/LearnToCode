import { StoryResult } from "./story-runtime";

export type Challenge = {
  id: string;
  title: string;
  badge: string;
  story: string;
  goal: string;
  hint: string;
  starter: string;
  examples: string[];
  check: (result: StoryResult) => boolean;
};

const sameArray = (value: unknown, target: unknown[]) =>
  Array.isArray(value) &&
  value.length === target.length &&
  value.every((item, index) => item === target[index]);

export const challenges: Challenge[] = [
  {
    id: "echo-canyon",
    title: "Echo Canyon",
    badge: "Warm-up",
    story:
      "A robot is learning to talk. Teach it one friendly message and have it say it out loud.",
    goal: "Create a word called message and show it.",
    hint: "Try: make a word called message with Hello, world explorer!",
    starter: "make a word called message with Hello, world explorer!\nshow message",
    examples: [
      "make a word called message with Hello, world explorer!",
      "show message",
    ],
    check: (result) =>
      result.errors.length === 0 &&
      result.variables.message === "Hello, world explorer!" &&
      result.output.includes("Hello, world explorer!"),
  },
  {
    id: "snack-counter",
    title: "Snack Counter",
    badge: "Logic",
    story:
      "The campers brought apples for a picnic. Count the whole pile with one sentence-friendly program.",
    goal: "Make a list called apples, set total to the sum, and show total.",
    hint: "Use a list and then write: set total to sum of apples",
    starter:
      "make a list called apples with 3, 5, 2, 4\nset total to sum of apples\nshow total",
    examples: [
      "make a list called apples with 3, 5, 2, 4",
      "set total to sum of apples",
      "show total",
    ],
    check: (result) =>
      result.errors.length === 0 &&
      result.variables.total === 14 &&
      result.output.includes("14"),
  },
  {
    id: "mountain-watch",
    title: "Mountain Watch",
    badge: "Data",
    story:
      "A drone scanned mountain heights. Find the tallest number so the team knows where to look first.",
    goal: "Create heights, set tallest to the biggest number in heights, and show it.",
    hint: "The phrase 'biggest number in heights' is supported.",
    starter:
      "make a list called heights with 4, 12, 7, 18, 9\nset tallest to biggest number in heights\nshow tallest",
    examples: [
      "make a list called heights with 4, 12, 7, 18, 9",
      "set tallest to biggest number in heights",
      "show tallest",
    ],
    check: (result) =>
      result.errors.length === 0 &&
      result.variables.tallest === 18 &&
      result.output.includes("18"),
  },
  {
    id: "two-sum-quest",
    title: "Two Sum Quest",
    badge: "Challenge",
    story:
      "Your rover has a list of numbers and a target. Find the pair of index spots whose values add up to the target.",
    goal: "Set pair to the index pair from nums that adds to target, then show pair.",
    hint: "Use the sentence: set pair to index pair from nums that adds to target",
    starter:
      "make a list called nums with 2, 7, 11, 15\nmake a number called target with 9\nset pair to index pair from nums that adds to target\nshow pair",
    examples: [
      "make a list called nums with 2, 7, 11, 15",
      "make a number called target with 9",
      "set pair to index pair from nums that adds to target",
      "show pair",
    ],
    check: (result) =>
      result.errors.length === 0 &&
      sameArray(result.variables.pair, [0, 1]) &&
      result.output.includes("[0, 1]"),
  },
];
