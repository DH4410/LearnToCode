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

export const challenges: Challenge[] = [
  {
    id: "echo-canyon",
    title: "Echo Canyon",
    badge: "Warm-up",
    story:
      "The canyon robot only wakes up when it hears a cheerful first message from a new coder.",
    mission:
      "Make the robot say a friendly greeting in the console using your own words.",
    winText: "Pass when the console prints a greeting sentence.",
    hint: "Create a word, then show it. Example idea: make a word called greeting with Hello bright canyon!",
    starter: "",
    placeholder:
      "Type your own sentences here.\n\nIdeas:\nmake a word called greeting with Hello bright canyon!\nshow greeting",
    check: (result) => result.errors.length === 0 && result.output.length > 0,
  },
  {
    id: "snack-counter",
    title: "Snack Counter",
    badge: "Logic",
    story:
      "Camp leaders dumped four apple baskets onto the table and need a super fast total before lunch starts.",
    mission:
      "Count apples from the list 3, 5, 2, 4 and print the final total for the team.",
    winText: "Pass when the console shows 14.",
    hint: "Make a list first. Then create a new value from the sum of that list and show it.",
    starter: "",
    placeholder:
      "Count the apples without blocks.\n\nYou need the numbers 3, 5, 2, 4.\nMake a list, find the sum, then show the answer.",
    check: (result) => outputHas(result, "14"),
  },
  {
    id: "mountain-watch",
    title: "Mountain Watch",
    badge: "Data",
    story:
      "A tiny drone scanned the mountain trail, but the rescue team only cares about the tallest peak right now.",
    mission:
      "Use the height list 4, 12, 7, 18, 9 and report the tallest mountain in the console.",
    winText: "Pass when the console shows 18.",
    hint: "There is a built-in phrase for this: biggest number in your list.",
    starter: "",
    placeholder:
      "Find the tallest mountain.\n\nUse the heights 4, 12, 7, 18, 9.\nPrint only the biggest one.",
    check: (result) => outputHas(result, "18"),
  },
  {
    id: "two-sum-quest",
    title: "Two Sum Quest",
    badge: "Challenge",
    story:
      "A rover found a hidden gate. It opens only when you name the two index spots whose numbers combine to the target energy.",
    mission:
      "Use the numbers 2, 7, 11, 15 and the target 9. Print the matching pair of index spots.",
    winText: "Pass when the console shows [0, 1].",
    hint: "After making the list and target, ask for the index pair from your list that adds to the target.",
    starter: "",
    placeholder:
      "Beat the final gate.\n\nYou need the list 2, 7, 11, 15 and target 9.\nFind the matching index pair and show it.",
    check: (result) =>
      result.errors.length === 0 &&
      (sameArray(result.variables.pair, [0, 1]) ||
        result.output.includes("[0, 1]")),
  },
];
