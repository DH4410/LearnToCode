import { StoryResult } from "./story-runtime";

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

const hasListValue = (result: StoryResult, target: number[]) =>
  Object.values(result.variables).some((value) => sameArray(value, target));

const outputContains = (result: StoryResult, text: string) =>
  result.errors.length === 0 &&
  result.output.some((line) => line.trim().toLowerCase().includes(text.toLowerCase()));

export const challenges: Challenge[] = [
  {
    id: "echo-canyon",
    category: "Tutorial",
    title: "Club Roll Call",
    badge: "Start",
    story:
      "The coding club projector is still asleep. It wakes up when someone types the first message of the day.",
    mission:
      "Write one line that makes the screen say hello. You can greet the class, your pet rock, or your future Python self.",
    winText: "Pass when at least one line appears with no errors.",
    hint: "Try Scratch-style code first: say \"Hello!\". Later in Python, this becomes print(\"Hello!\").",
    starter: "",
    placeholder:
      "One action per line.\n\nIdeas:\nsay \"Hello, Code Club!\"\n\nOr:\nshow \"Projector online\"",
    check: (result) =>
      result.errors.length === 0 &&
      result.output.length > 0,
  },
  {
    id: "signal-print",
    category: "Tutorial",
    title: "Mascot Message",
    badge: "Words",
    story:
      "Your team's cardboard robot mascot needs a catchphrase for the hallway poster.",
    mission:
      "Make the mascot say any short status message that sounds cheerful or dramatic.",
    winText: "Pass when any line prints successfully.",
    hint: "You can use say \"We are ready!\" or save words in a variable first and then show them.",
    starter: "",
    placeholder: "Examples:\nsay \"Team Turbo is ready!\"\nvariable status: \"Batteries full\"\nshow status",
    check: (result) => result.errors.length === 0 && result.output.length > 0,
  },
  {
    id: "repeat-warmup",
    category: "Control Flow",
    title: "Robot Mic Check",
    badge: "Repeat",
    story: "A tiny stage robot must say the same test word three times before the talent show starts.",
    mission: "Use a repeat-style idea to make three lines of output.",
    winText: "Pass when the console shows three lines.",
    hint: "Scratch-style works here: repeat 3 times, then put an indented say line underneath.",
    starter: "",
    placeholder: "One action per line.\n\nrepeat 3 times\n  say \"beep\"",
    check: (result) => result.errors.length === 0 && result.output.length >= 3,
  },
  {
    id: "inventory-stack",
    category: "Data",
    title: "Backpack Builder",
    badge: "Lists",
    story: "Your game character is leaving for a forest quest and their backpack is still empty.",
    mission: "Make a list with three or more items and print the whole backpack.",
    winText: "Pass when the console shows a list.",
    hint: "Use anything you want: snacks, tools, stickers, or dragon-spraying water bottles.",
    starter: "",
    placeholder:
      "One action per line.\n\nmake a list called backpack with \"map\", \"snack\", \"rope\"\nshow backpack",
    check: (result) =>
      result.errors.length === 0 &&
      result.output.some((line) => line.includes("[")) &&
      result.lineCount >= 2,
  },
  {
    id: "snack-counter",
    category: "Data",
    title: "Bake Sale Total",
    badge: "Numbers",
    story:
      "Four friends dropped cookie boxes on your table right before the school bake sale opened.",
    mission:
      "Use the numbers 3, 5, 2, 4 and print the total number of boxes.",
    winText: "Pass when the console shows 14.",
    hint: "A nice beginner path is: make a list, set total to sum of that list, then show total.",
    starter: "",
    placeholder:
      "One action per line.\n\nmake a list called boxes with 3, 5, 2, 4\nset total to sum of boxes\nshow total",
    check: (result) =>
      result.errors.length === 0 &&
      outputHas(result, "14"),
  },
  {
    id: "mountain-watch",
    category: "Data",
    title: "Skate Ramp Record",
    badge: "Compare",
    story:
      "Your friends measured five homemade skate ramps and now want to brag about the tallest one.",
    mission:
      "Use heights 4, 12, 7, 18, 9 and report the biggest height.",
    winText: "Pass when the console shows 18.",
    hint: "The phrase biggest number in heights works, and largest number in heights works too.",
    starter: "",
    placeholder:
      "One action per line.\n\nmake a list called heights with 4, 12, 7, 18, 9\nset tallest to biggest number in heights\nshow tallest",
    check: (result) =>
      result.errors.length === 0 &&
      outputHas(result, "18"),
  },
  {
    id: "smallest-beacon",
    category: "Data",
    title: "Dimmest Flashlight",
    badge: "Compare",
    story:
      "You are testing four flashlights for a camping trip and need to spot the weakest one.",
    mission:
      "Use 8, 3, 12, 5 and print the smallest value.",
    winText: "Pass when the console shows 3.",
    hint: "Try smallest number in beacons, then show the answer.",
    starter: "",
    placeholder:
      "One action per line.\n\nmake a list called beacons with 8, 3, 12, 5\nset lowest to smallest number in beacons\nshow lowest",
    check: (result) =>
      result.errors.length === 0 && outputContains(result, "3"),
  },
  {
    id: "sum-loop",
    category: "Control Flow",
    title: "Scoreboard Clicker",
    badge: "Repeat",
    story: "An old arcade machine needs to count up points one step at a time.",
    mission: "Make the total for 1, 2, 3, 4 using any method you like.",
    winText: "Pass when the console shows 10.",
    hint: "You can sum directly, or start at 0 and use change total by ... several times.",
    starter: "",
    placeholder:
      "One action per line.\n\nmake a number called total with 0\nchange total by 1\nchange total by 2\nchange total by 3\nchange total by 4\nshow total",
    check: (result) => result.errors.length === 0 && result.output.some((o) => o.includes("10")),
  },
  {
    id: "countdown-triple",
    category: "Control Flow",
    title: "Rocket Countdown",
    badge: "Repeat",
    story: "Your paper rocket only launches if the countdown sounds dramatic enough.",
    mission: "Output at least three countdown lines in any style.",
    winText: "Pass when the console shows three or more lines.",
    hint: "You can do three separate say lines, or use repeat if you want the same line more than once.",
    starter: "",
    placeholder: "Example:\nsay \"3\"\nsay \"2\"\nsay \"1\"",
    check: (result) => result.errors.length === 0 && result.output.length >= 3,
  },
  {
    id: "two-sum-quest",
    category: "Algorithms",
    title: "Treasure Key Pair",
    badge: "Boss",
    story:
      "A treasure chest has four numbered keys, but only two of them open the lock together.",
    mission:
      "Use the numbers 2, 7, 11, 15 and the target 9. Print the pair of index spots that match.",
    winText: "Pass when the console shows [0, 1].",
    hint: "This one has a built-in helper: index pair from nums that adds to target.",
    starter: "",
    placeholder:
      "One action per line.\n\nmake a list called nums with 2, 7, 11, 15\nmake a number called target with 9\nset pair to index pair from nums that adds to target\nshow pair",
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
