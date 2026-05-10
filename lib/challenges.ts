import { StoryResult, StoryValue } from "./story-runtime";

export type Challenge = {
  id: string;
  title: string;
  badge: string;
  category?: string;
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

const outputMatchesAny = (result: StoryResult, values: string[]) =>
  values.some((value) => outputHas(result, value));

const outputContains = (result: StoryResult, text: string) =>
  result.errors.length === 0 &&
  result.output.some((line) =>
    line.trim().toLowerCase().includes(text.toLowerCase()),
  );

const variableHasValue = (result: StoryResult, target: StoryValue) =>
  Object.values(result.variables).some((value) => value === target);

const variableHasArray = (result: StoryResult, target: StoryValue[]) =>
  Object.values(result.variables).some((value) => sameArray(value, target));

const hasAnyListWithLength = (result: StoryResult, minimum: number) =>
  Object.values(result.variables).some(
    (value) => Array.isArray(value) && value.length >= minimum,
  );

const sourceHas = (result: StoryResult, pattern: RegExp) =>
  pattern.test(result.source);

const listSecondItemWasPrinted = (result: StoryResult) =>
  Object.values(result.variables).some((value) => {
    if (!Array.isArray(value) || value.length < 2) {
      return false;
    }

    return outputHas(result, String(value[1]));
  });

export const challenges: Challenge[] = [
  {
    id: "club-roll-call",
    category: "Tutorial",
    title: "Club Roll Call",
    badge: "Start",
    story:
      "The coding club projector is still asleep. It wakes up when someone types the first message of the day.",
    mission:
      "Make the screen say hello in your own words.",
    winText: "Pass when at least one line appears with no errors.",
    hint: "Use a talking command, not a variable command.",
    starter: "",
    placeholder: "Write one action per line.",
    check: (result) =>
      result.errors.length === 0 &&
      result.output.length > 0 &&
      sourceHas(result, /^\s*(say|show|print)\b/im),
  },
  {
    id: "mascot-message",
    category: "Tutorial",
    title: "Mascot Message",
    badge: "Words",
    story:
      "Your cardboard team mascot needs a catchphrase for the hallway poster.",
    mission:
      "Save a short message in a variable, then display it.",
    winText: "Pass when a saved text message gets printed.",
    hint: "This one wants storage first, then output.",
    starter: "",
    placeholder: "Try storing text before you show it.",
    check: (result) =>
      result.errors.length === 0 &&
      result.output.length > 0 &&
      Object.values(result.variables).some((value) => typeof value === "string") &&
      sourceHas(result, /^\s*(variable|let|const|set)\b/im),
  },
  {
    id: "robot-mic-check",
    category: "Control Flow",
    title: "Robot Mic Check",
    badge: "Repeat",
    story:
      "A tiny stage robot must repeat the same test word three times before the talent show starts.",
    mission:
      "Use a repeat block to make exactly three lines of output.",
    winText: "Pass when a repeat-style solution makes three lines.",
    hint: "A repeat block needs an indented line under it.",
    starter: "",
    placeholder: "Use a repeat block here.",
    check: (result) =>
      result.errors.length === 0 &&
      result.output.length === 3 &&
      sourceHas(result, /^\s*repeat\b/im),
  },
  {
    id: "backpack-builder",
    category: "Data",
    title: "Backpack Builder",
    badge: "Lists",
    story:
      "Your game character is packing for a forest quest and wants to know which item sits second in the bag.",
    mission:
      "Create a list with at least three items, then show item 2 of that list.",
    winText: "Pass when the second item from a real list is printed.",
    hint: "This mission wants list access, not just printing random words.",
    starter: "",
    placeholder: "Build a list, then pull one item out of it.",
    check: (result) =>
      result.errors.length === 0 &&
      hasAnyListWithLength(result, 3) &&
      listSecondItemWasPrinted(result) &&
      sourceHas(result, /\bitem\s+2\s+of\b/i),
  },
  {
    id: "bake-sale-total",
    category: "Data",
    title: "Bake Sale Total",
    badge: "Numbers",
    story:
      "Four friends dropped cookie boxes on your table right before the school bake sale opened.",
    mission:
      "Use 3, 5, 2, 4 and calculate the total.",
    winText: "Pass when the program really works out 14.",
    hint: "You can total the numbers with a helper or by building the answer step by step.",
    starter: "",
    placeholder: "Use the given numbers to build a real total.",
    check: (result) =>
      result.errors.length === 0 &&
      variableHasArray(result, [3, 5, 2, 4]) &&
      variableHasValue(result, 14) &&
      outputHas(result, "14") &&
      sourceHas(result, /\b(sum of|change\b|plus|\+)\b/i),
  },
  {
    id: "skate-ramp-record",
    category: "Data",
    title: "Skate Ramp Record",
    badge: "Compare",
    story:
      "Your friends measured five homemade skate ramps and want the tallest one without guessing.",
    mission:
      "Use heights 4, 12, 7, 18, 9 and find the biggest value.",
    winText: "Pass when the tallest value is found from the list.",
    hint: "Use a list and a biggest-style helper.",
    starter: "",
    placeholder: "Find the biggest height from the given list.",
    check: (result) =>
      result.errors.length === 0 &&
      variableHasArray(result, [4, 12, 7, 18, 9]) &&
      outputHas(result, "18") &&
      sourceHas(result, /\b(biggest|largest) number in\b/i),
  },
  {
    id: "dimmest-flashlight",
    category: "Data",
    title: "Dimmest Flashlight",
    badge: "Compare",
    story:
      "You are testing four flashlights for a camping trip and need the weakest one fast.",
    mission:
      "Use 8, 3, 12, 5 and find the smallest value.",
    winText: "Pass when the smallest value is found from the list.",
    hint: "Use a list and a smallest-style helper.",
    starter: "",
    placeholder: "Find the smallest number from the list.",
    check: (result) =>
      result.errors.length === 0 &&
      variableHasArray(result, [8, 3, 12, 5]) &&
      outputHas(result, "3") &&
      sourceHas(result, /\bsmallest number in\b/i),
  },
  {
    id: "scoreboard-clicker",
    category: "Control Flow",
    title: "Scoreboard Clicker",
    badge: "Change",
    story:
      "An old arcade scoreboard starts at zero and only understands tiny score changes.",
    mission:
      "Start at 0 and change the total until it becomes 10.",
    winText: "Pass when a changing-number solution reaches 10.",
    hint: "This one wants the number to grow over time.",
    starter: "",
    placeholder: "Start from 0, then change the total.",
    check: (result) =>
      result.errors.length === 0 &&
      variableHasValue(result, 10) &&
      outputHas(result, "10") &&
      (result.source.match(/^\s*change\b/gim)?.length ?? 0) >= 2,
  },
  {
    id: "party-guest-list",
    category: "Data",
    title: "Party Guest Shuffle",
    badge: "Lists",
    story:
      "Your guest list changed three times in a row, and now you need the final order to be right.",
    mission:
      "Start a list with \"Amy\", \"Ben\", \"Dia\". Insert \"Kai\" as item 2, replace item 4 with \"Zoe\", then show the finished list.",
    winText: "Pass when the final list becomes [Amy, Kai, Ben, Zoe].",
    hint: "This mission uses list editing blocks.",
    starter: "",
    placeholder: "Build a list, then edit the list in place.",
    check: (result) =>
      result.errors.length === 0 &&
      variableHasArray(result, ["Amy", "Kai", "Ben", "Zoe"]) &&
      outputContains(result, "[Amy, Kai, Ben, Zoe]") &&
      sourceHas(result, /\binsert\b/i) &&
      sourceHas(result, /\breplace item\b/i),
  },
  {
    id: "treasure-key-pair",
    category: "Algorithms",
    title: "Treasure Key Pair",
    badge: "Boss",
    story:
      "A treasure chest has four numbered keys, but only two of them open the lock together.",
    mission:
      "Use 2, 7, 11, 15 and target 9 to find the matching pair of index spots.",
    winText: "Pass when the correct pair [0, 1] is found.",
    hint: "There is a built-in pair helper, but you still need to use the real list and target.",
    starter: "",
    placeholder: "Set up the numbers and target, then find the pair.",
    check: (result) =>
      result.errors.length === 0 &&
      variableHasArray(result, [2, 7, 11, 15]) &&
      variableHasValue(result, 9) &&
      sourceHas(result, /\bindex pair from\b/i) &&
      (sameArray(result.variables.pair, [0, 1]) ||
        sameArray(result.variables.pair, [1, 0]) ||
        outputMatchesAny(result, ["[0, 1]", "[1, 0]", "0, 1", "1, 0"])),
  },
];
