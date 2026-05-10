import { StoryResult } from "./story-runtime";

export type Challenge = {
  id: string;
  title: string;
  badge: string;
  story: string;
  mission: string;
  winText: string;
  hint: string;
  starter: string;
  placeholder: string;
  check: (result: StoryResult) => boolean;
};

const sameArray = (value: unknown, target: unknown[]) =>
  Array.isArray(value) &&
  value.length === target.length &&
  value.every((item, index) => item === target[index]);

const outputHas = (result: StoryResult, text: string) =>
  result.errors.length === 0 &&
  result.output.some((line) => line.trim().toLowerCase() === text.toLowerCase());

const hasListValue = (result: StoryResult, target: number[]) =>
  Object.values(result.variables).some((value) => sameArray(value, target));

const outputContains = (result: StoryResult, text: string) =>
  result.errors.length === 0 &&
  result.output.some((line) => line.trim().toLowerCase().includes(text.toLowerCase()));

export const challenges: Challenge[] = [
  {
    id: "echo-canyon",
    title: "Echo Canyon",
    badge: "Warm-up",
    story:
      "Your scout drone is trying to sync with a mountain relay. It only connects when your opening message sounds human and confident.",
    mission:
      "Print any custom intro line in the console. Add your name, team, mood, or mission code.",
    winText: "Pass when at least one line prints with no errors.",
    hint: "Any style is valid: variable text = \"Hi\", variable text: \"Hi\", or just show \"Hi\".",
    starter: "",
    placeholder:
      "One action per line.\n\nIdeas:\nvariable text: \"Pilot Nova online\"\nshow text\n\nOr:\nshow \"Relay check complete\"",
    check: (result) =>
      result.errors.length === 0 &&
      result.output.length > 0,
  },
  {
    id: "snack-counter",
    title: "Snack Counter",
    badge: "Logic",
    story:
      "You are running a festival food truck. Four runners delivered snack crates and the line is growing fast.",
    mission:
      "Use numbers 3, 5, 2, 4 and print the final snack total before the timer hits zero.",
    winText: "Pass when the console shows 14.",
    hint: "You can solve it in multiple ways: list + sum, direct math, or a variable that becomes 14.",
    starter: "",
    placeholder:
      "One action per line.\n\nExample styles:\nmake a list called snacks with 3, 5, 2, 4\nset total to sum of snacks\nshow total",
    check: (result) =>
      result.errors.length === 0 &&
      outputHas(result, "14"),
  },
  {
    id: "mountain-watch",
    title: "Mountain Watch",
    badge: "Data",
    story:
      "A weather balloon streamed five peak heights, and your control room needs the highest value for a storm alert.",
    mission:
      "Use heights 4, 12, 7, 18, 9 and report the tallest peak in the console.",
    winText: "Pass when the console shows 18.",
    hint: "Try biggest number in heights, but any valid path to output 18 is accepted.",
    starter: "",
    placeholder:
      "One action per line.\n\nUse the heights 4, 12, 7, 18, 9.\nMake a list, find the biggest number, then show it.",
    check: (result) =>
      result.errors.length === 0 &&
      outputHas(result, "18"),
  },
  {
    id: "two-sum-quest",
    title: "Two Sum Quest",
    badge: "Challenge",
    story:
      "You reached a vault door with a dual-pin lock. It opens when you output two index slots whose values combine to the target charge.",
    mission:
      "Use the numbers 2, 7, 11, 15 and the target 9. Print the matching pair of index spots.",
    winText: "Pass when the console shows [0, 1].",
    hint: "Built-in phrase: index pair from nums that adds to target. Output [0, 1] or [1, 0].",
    starter: "",
    placeholder:
      "One action per line.\n\nExample styles:\nlet nums = [2, 7, 11, 15]\nlet target = 9\npair = index pair from nums that adds to target\nshow pair",
    check: (result) =>
      result.errors.length === 0 &&
      (sameArray(result.variables.pair, [0, 1]) ||
        sameArray(result.variables.pair, [1, 0]) ||
        outputContains(result, "[0, 1]") ||
        outputContains(result, "[1, 0]") ||
        outputContains(result, "0, 1") ||
        outputContains(result, "1, 0")),
  },
];
