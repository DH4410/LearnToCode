export type StoryValue = number | string | boolean | StoryValue[];

export type StoryResult = {
  generatedCode: string[];
  output: string[];
  variables: Record<string, StoryValue>;
  steps: string[];
  errors: string[];
  lineCount: number;
};

const defineOrAssign = (
  variables: Record<string, StoryValue>,
  variableName: string,
  value: StoryValue,
) =>
  variableName in variables
    ? `${variableName} = ${formatJsValue(value)};`
    : `let ${variableName} = ${formatJsValue(value)};`;

const normalizeName = (value: string) => value.trim().replace(/\s+/g, "_");

const isQuoted = (value: string) =>
  (value.startsWith('"') && value.endsWith('"')) ||
  (value.startsWith("'") && value.endsWith("'"));

const stripQuotes = (value: string) => value.slice(1, -1);

const splitTopLevel = (source: string): string[] => {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let quote: '"' | "'" | null = null;

  for (const char of source) {
    if (quote) {
      current += char;

      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (char === "[") {
      depth += 1;
      current += char;
      continue;
    }

    if (char === "]") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }

    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim().length > 0) {
    parts.push(current.trim());
  }

  return parts;
};

const formatJsValue = (value: StoryValue): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatJsValue(item)).join(", ")}]`;
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  return String(value);
};

const formatOutputValue = (value: StoryValue): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatOutputValue(item)).join(", ")}]`;
  }

  return String(value);
};

const parseList = (source: string): StoryValue[] => {
  const cleaned = source.replace(/\band\b/gi, ",");
  const parts = cleaned.includes(",")
    ? splitTopLevel(cleaned)
    : cleaned.split(/\s+/);

  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => parseLiteral(part));
};

const parseLiteral = (source: string): StoryValue => {
  const trimmed = source.trim();

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();

    if (inner.length === 0) {
      return [];
    }

    return splitTopLevel(inner).map((part) => parseLiteral(part));
  }

  if (isQuoted(trimmed)) {
    return stripQuotes(trimmed);
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (/^(true|false)$/i.test(trimmed)) {
    return trimmed.toLowerCase() === "true";
  }

  return trimmed;
};

const getNumber = (value: StoryValue, label: string): number => {
  if (typeof value === "number") {
    return value;
  }

  throw new Error(`${label} should be a number.`);
};

const getList = (value: StoryValue, label: string): StoryValue[] => {
  if (Array.isArray(value)) {
    return value;
  }

      throw new Error(`${label} should be a list.`);
};

const parseValueByKind = (
  kind: string,
  rawValue: string,
  variableName: string,
): StoryValue => {
  if (kind === "list" || kind === "array") {
    if (rawValue.trim().startsWith("[") && rawValue.trim().endsWith("]")) {
      const parsed = parseLiteral(rawValue);

      if (Array.isArray(parsed)) {
        return parsed;
      }
    }

    return parseList(rawValue);
  }

  if (kind === "number") {
    return getNumber(parseLiteral(rawValue), variableName);
  }

  if (kind === "boolean" || kind === "flag") {
    const parsed = parseLiteral(rawValue);

    if (typeof parsed !== "boolean") {
      throw new Error(`${variableName} should be true or false.`);
    }

    return parsed;
  }

  if (kind === "word" || kind === "text" || kind === "string") {
    return isQuoted(rawValue) ? stripQuotes(rawValue) : rawValue;
  }

  return evaluateExpression(rawValue, {});
};

const resolveToken = (
  token: string,
  variables: Record<string, StoryValue>,
): StoryValue => {
  const cleaned = token.trim();

  if (cleaned in variables) {
    return variables[cleaned];
  }

  return parseLiteral(cleaned);
};

const findTwoSumPair = (items: StoryValue[], target: number): number[] => {
  const seen = new Map<number, number>();

  for (let index = 0; index < items.length; index += 1) {
    const value = items[index];

    if (typeof value !== "number") {
      continue;
    }

    const match = target - value;

    if (seen.has(match)) {
      return [seen.get(match) ?? 0, index];
    }

    seen.set(value, index);
  }

  return [];
};

const evaluateExpression = (
  expression: string,
  variables: Record<string, StoryValue>,
): StoryValue => {
  const trimmed = expression.trim();
  let match: RegExpMatchArray | null;

  match = trimmed.match(/^a list with (.+)$/i);
  if (match) {
    return parseList(match[1]);
  }

  match = trimmed.match(/^sum of (\w+)$/i);
  if (match) {
    const listName = normalizeName(match[1]);
    const list = getList(variables[listName], listName);

    return list.reduce<number>(
      (total, item) => total + getNumber(item, listName),
      0,
    );
  }

  match = trimmed.match(/^biggest number in (\w+)$/i);
  if (match) {
    const listName = normalizeName(match[1]);
    const list = getList(variables[listName], listName);

    return Math.max(...list.map((item) => getNumber(item, listName)));
  }

  match = trimmed.match(/^smallest number in (\w+)$/i);
  if (match) {
    const listName = normalizeName(match[1]);
    const list = getList(variables[listName], listName);

    return Math.min(...list.map((item) => getNumber(item, listName)));
  }

  match = trimmed.match(/^size of (\w+)$/i);
  if (match) {
    const listName = normalizeName(match[1]);
    const list = getList(variables[listName], listName);

    return list.length;
  }

  match = trimmed.match(/^first item in (\w+)$/i);
  if (match) {
    const listName = normalizeName(match[1]);
    const list = getList(variables[listName], listName);

    return list[0];
  }

  match = trimmed.match(/^last item in (\w+)$/i);
  if (match) {
    const listName = normalizeName(match[1]);
    const list = getList(variables[listName], listName);

    return list[list.length - 1];
  }

  match = trimmed.match(/^number at (.+) in (\w+)$/i);
  if (match) {
    const index = getNumber(resolveToken(match[1], variables), "index");
    const listName = normalizeName(match[2]);
    const list = getList(variables[listName], listName);

    return list[index];
  }

  match = trimmed.match(/^index pair from (\w+) that adds to (.+)$/i);
  if (match) {
    const listName = normalizeName(match[1]);
    const list = getList(variables[listName], listName);
    const target = getNumber(resolveToken(match[2], variables), "target");

    return findTwoSumPair(list, target);
  }

  match = trimmed.match(/^(.+?) plus (.+)$/i);
  if (match) {
    const left = resolveToken(match[1], variables);
    const right = resolveToken(match[2], variables);

    return getNumber(left, "left side") + getNumber(right, "right side");
  }

  match = trimmed.match(/^(.+?) minus (.+)$/i);
  if (match) {
    const left = resolveToken(match[1], variables);
    const right = resolveToken(match[2], variables);

    return getNumber(left, "left side") - getNumber(right, "right side");
  }

  match = trimmed.match(/^(.+?) times (.+)$/i);
  if (match) {
    const left = resolveToken(match[1], variables);
    const right = resolveToken(match[2], variables);

    return getNumber(left, "left side") * getNumber(right, "right side");
  }

  match = trimmed.match(/^(.+?) divided by (.+)$/i);
  if (match) {
    const left = resolveToken(match[1], variables);
    const right = resolveToken(match[2], variables);

    return getNumber(left, "left side") / getNumber(right, "right side");
  }

  if (trimmed in variables) {
    return variables[trimmed];
  }

  return parseLiteral(trimmed);
};

export const runStoryProgram = (source: string): StoryResult => {
  const variables: Record<string, StoryValue> = {};
  const generatedCode: string[] = [];
  const output: string[] = [];
  const steps: string[] = [];
  const errors: string[] = [];

  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  lines.forEach((line, index) => {
    const cleanedLine = line.replace(/[.;]+$/, "");
    let match: RegExpMatchArray | null;

    try {
      match = cleanedLine.match(
        /^make a (list|number|word|text|boolean|flag) called ([a-zA-Z][\w\s]*) with (.+)$/i,
      );
      if (match) {
        const kind = match[1].toLowerCase();
        const variableName = normalizeName(match[2]);
        const rawValue = match[3].trim();

        const value = parseValueByKind(kind, rawValue, variableName);

        const jsLine = defineOrAssign(variables, variableName, value);
        variables[variableName] = value;
        generatedCode.push(jsLine);
        steps.push(`Created ${variableName}.`);
        return;
      }

      match = cleanedLine.match(
        /^(variable|let|const)\s+([a-zA-Z][\w]*)\s*[:=]\s*(.+)$/i,
      );
      if (match) {
        const variableName = normalizeName(match[2]);
        const value = evaluateExpression(match[3].trim(), variables);
        const declarationKeyword = match[1].toLowerCase() === "const" ? "const" : "let";
        const jsLine =
          variableName in variables
            ? `${variableName} = ${formatJsValue(value)};`
            : `${declarationKeyword} ${variableName} = ${formatJsValue(value)};`;

        variables[variableName] = value;
        generatedCode.push(jsLine);
        steps.push(`Created ${variableName}.`);
        return;
      }

      match = cleanedLine.match(/^([a-zA-Z][\w]*)\s*=\s*(.+)$/);
      if (match) {
        const variableName = normalizeName(match[1]);
        const value = evaluateExpression(match[2].trim(), variables);
        const jsLine = defineOrAssign(variables, variableName, value);

        variables[variableName] = value;
        generatedCode.push(jsLine);
        steps.push(`Updated ${variableName}.`);
        return;
      }

      match = cleanedLine.match(/^set ([a-zA-Z][\w\s]*) to (.+)$/i);
      if (match) {
        const variableName = normalizeName(match[1]);
        const expression = match[2].trim();
        const value = evaluateExpression(expression, variables);

        const jsLine = defineOrAssign(variables, variableName, value);
        variables[variableName] = value;
        generatedCode.push(jsLine);
        steps.push(`Updated ${variableName}.`);
        return;
      }

      match = cleanedLine.match(/^add (.+) to ([a-zA-Z][\w\s]*)$/i);
      if (match) {
        const valueToAdd = getNumber(resolveToken(match[1], variables), "added value");
        const variableName = normalizeName(match[2]);
        const current = getNumber(variables[variableName], variableName);
        const nextValue = current + valueToAdd;

        variables[variableName] = nextValue;
        generatedCode.push(`${variableName} += ${valueToAdd};`);
        steps.push(`Added to ${variableName}.`);
        return;
      }

      match = cleanedLine.match(/^push (.+) into ([a-zA-Z][\w\s]*)$/i);
      if (match) {
        const nextItem = resolveToken(match[1], variables);
        const variableName = normalizeName(match[2]);
        const list = [...getList(variables[variableName], variableName), nextItem];

        variables[variableName] = list;
        generatedCode.push(`${variableName}.push(${formatJsValue(nextItem)});`);
        steps.push(`Pushed a value into ${variableName}.`);
        return;
      }

      match = cleanedLine.match(/^(show|print)\s+(.+)$/i);
      if (match) {
        const value = evaluateExpression(match[2], variables);

        output.push(formatOutputValue(value));
        generatedCode.push(`console.log(${formatJsValue(value)});`);
        steps.push("Printed to the console.");
        return;
      }

      throw new Error(
        "I do not understand that line yet. Use one action per line with commands like 'make', 'variable', 'set', 'add', 'push', 'show', or 'print'.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error.";
      errors.push(`Line ${index + 1}: ${message}`);
    }
  });

  return {
    generatedCode,
    output,
    variables,
    steps,
    errors,
    lineCount: lines.length,
  };
};
