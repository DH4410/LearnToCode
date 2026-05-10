export type StoryValue = number | string | boolean | StoryValue[];

export type StoryResult = {
  generatedCode: string[];
  output: string[];
  variables: Record<string, StoryValue>;
  steps: string[];
  errors: string[];
  lineCount: number;
  source: string;
};

type ParsedLine = {
  indent: number;
  lineNumber: number;
  text: string;
};

type RuntimeContext = {
  generatedCode: string[];
  output: string[];
  variables: Record<string, StoryValue>;
  steps: string[];
  errors: string[];
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
  let squareDepth = 0;
  let roundDepth = 0;
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
      squareDepth += 1;
      current += char;
      continue;
    }

    if (char === "]") {
      squareDepth = Math.max(0, squareDepth - 1);
      current += char;
      continue;
    }

    if (char === "(") {
      roundDepth += 1;
      current += char;
      continue;
    }

    if (char === ")") {
      roundDepth = Math.max(0, roundDepth - 1);
      current += char;
      continue;
    }

    if (char === "," && squareDepth === 0 && roundDepth === 0) {
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

const findBalancedClosingParen = (value: string) => {
  let depth = 0;
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (quote) {
      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
};

const unwrapOuterParens = (value: string): string => {
  let trimmed = value.trim();

  while (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    const closingIndex = findBalancedClosingParen(trimmed);

    if (closingIndex !== trimmed.length - 1) {
      break;
    }

    trimmed = trimmed.slice(1, -1).trim();
  }

  return trimmed;
};

const hasFriendlyMathWords = (value: string) =>
  /\b(sum of|biggest number in|largest number in|smallest number in|size of|length of|first item in|last item in|number at|item .+ of|index pair from|plus|minus|times|divided by)\b/i.test(
    value,
  );

const resolveVariable = (
  token: string,
  variables: Record<string, StoryValue>,
): StoryValue | undefined => {
  const cleaned = unwrapOuterParens(token);
  const exactName = normalizeName(cleaned);

  if (exactName in variables) {
    return variables[exactName];
  }

  return undefined;
};

const resolveToken = (
  token: string,
  variables: Record<string, StoryValue>,
): StoryValue => {
  const cleaned = unwrapOuterParens(token);
  const variableValue = resolveVariable(cleaned, variables);

  if (variableValue !== undefined) {
    return variableValue;
  }

  return parseLiteral(cleaned);
};

const arithmeticTokenPattern =
  /"[^"]*"|'[^']*'|\b-?\d+(?:\.\d+)?\b|[a-zA-Z_][\w]*|[+\-*/]/g;

const isArithmeticOperator = (token: string) =>
  token === "+" || token === "-" || token === "*" || token === "/";

const resolveArithmeticValue = (
  token: string,
  variables: Record<string, StoryValue>,
): number => {
  const resolved = resolveToken(token, variables);

  if (typeof resolved === "number") {
    return resolved;
  }

  throw new Error(`"${token}" should be a number.`);
};

const evaluateArithmeticExpression = (
  expression: string,
  variables: Record<string, StoryValue>,
): StoryValue => {
  const tokens = expression.match(arithmeticTokenPattern) ?? [];

  if (tokens.length === 0) {
    return parseLiteral(expression);
  }

  const values: number[] = [];
  const operators: string[] = [];
  let expectValue = true;
  let previousToken = "";

  for (const token of tokens) {
    if (expectValue) {
      if (isArithmeticOperator(token)) {
        throw new Error(`Expected a value before "${token}".`);
      }

      values.push(resolveArithmeticValue(token, variables));
      expectValue = false;
      previousToken = token;
      continue;
    }

    if (!isArithmeticOperator(token)) {
      throw new Error(`Missing operator between "${previousToken}" and "${token}".`);
    }

    operators.push(token);
    expectValue = true;
    previousToken = token;
  }

  if (expectValue) {
    throw new Error("An expression cannot end with an operator.");
  }

  const reducedValues: number[] = [values[0]];
  const reducedOperators: string[] = [];

  for (let index = 0; index < operators.length; index += 1) {
    const operator = operators[index];
    const right = values[index + 1];

    if (operator === "*" || operator === "/") {
      const left = reducedValues.pop() ?? 0;
      reducedValues.push(operator === "*" ? left * right : left / right);
      continue;
    }

    reducedOperators.push(operator);
    reducedValues.push(right);
  }

  let result = reducedValues[0];

  for (let index = 0; index < reducedOperators.length; index += 1) {
    const operator = reducedOperators[index];
    const right = reducedValues[index + 1];

    result = operator === "+" ? result + right : result - right;
  }

  return result;
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

const parseValueByKind = (
  kind: string,
  rawValue: string,
  variableName: string,
  variables: Record<string, StoryValue>,
): StoryValue => {
  if (kind === "list" || kind === "array") {
    const cleaned = unwrapOuterParens(rawValue);

    if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
      const parsed = parseLiteral(cleaned);

      if (Array.isArray(parsed)) {
        return parsed;
      }
    }

    return parseList(cleaned);
  }

  if (kind === "number") {
    return getNumber(resolveToken(rawValue, variables), variableName);
  }

  if (kind === "boolean" || kind === "flag") {
    const parsed = resolveToken(rawValue, variables);

    if (typeof parsed !== "boolean") {
      throw new Error(`${variableName} should be true or false.`);
    }

    return parsed;
  }

  if (kind === "word" || kind === "text" || kind === "string") {
    const cleaned = unwrapOuterParens(rawValue).trim();

    return isQuoted(cleaned) ? stripQuotes(cleaned) : cleaned;
  }

  return evaluateExpression(rawValue, variables);
};

const evaluateExpression = (
  expression: string,
  variables: Record<string, StoryValue>,
  options?: { allowBareWordText?: boolean },
): StoryValue => {
  const trimmed = unwrapOuterParens(expression);
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

  match = trimmed.match(/^(biggest|largest) number in (\w+)$/i);
  if (match) {
    const listName = normalizeName(match[2]);
    const list = getList(variables[listName], listName);

    return Math.max(...list.map((item) => getNumber(item, listName)));
  }

  match = trimmed.match(/^smallest number in (\w+)$/i);
  if (match) {
    const listName = normalizeName(match[1]);
    const list = getList(variables[listName], listName);

    return Math.min(...list.map((item) => getNumber(item, listName)));
  }

  match = trimmed.match(/^(size|length) of (\w+)$/i);
  if (match) {
    const listName = normalizeName(match[2]);
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

  match = trimmed.match(/^item (.+) of (\w+)$/i);
  if (match) {
    const requestedIndex = getNumber(resolveToken(match[1], variables), "item number");
    const listName = normalizeName(match[2]);
    const list = getList(variables[listName], listName);
    const index = Math.max(0, Math.floor(requestedIndex) - 1);

    return list[index];
  }

  match = trimmed.match(/^(\w+) contains (.+)$/i);
  if (match) {
    const listName = normalizeName(match[1]);
    const list = getList(variables[listName], listName);
    const target = resolveToken(match[2], variables);

    return list.some((item) => item === target);
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

  if (/[+\-*/]/.test(trimmed)) {
    return evaluateArithmeticExpression(trimmed, variables);
  }

  const variableValue = resolveVariable(trimmed, variables);

  if (variableValue !== undefined) {
    return variableValue;
  }

  const literalValue = parseLiteral(trimmed);

  if (typeof literalValue !== "string") {
    return literalValue;
  }

  if (/^[a-zA-Z_][\w]*$/.test(trimmed) && !options?.allowBareWordText) {
    throw new Error(
      `I do not know "${trimmed}" yet. Make it first, or put it in quotes if it is just text.`,
    );
  }

  if (hasFriendlyMathWords(trimmed)) {
    throw new Error(`I could not finish that expression yet: "${trimmed}".`);
  }

  return literalValue;
};

const parseSourceLines = (source: string): ParsedLine[] =>
  source
    .split(/\r?\n/)
    .map((line, index) => ({
      raw: line,
      lineNumber: index + 1,
    }))
    .filter((line) => line.raw.trim().length > 0)
    .map((line) => ({
      indent: (line.raw.match(/^\s*/) ?? [""])[0].replace(/\t/g, "  ").length,
      lineNumber: line.lineNumber,
      text: line.raw.trim(),
    }));

const pushGeneratedCode = (
  generatedCode: string[],
  code: string,
  depth: number,
) => {
  generatedCode.push(`${"  ".repeat(depth)}${code}`);
};

const findBlockEnd = (
  lines: ParsedLine[],
  startIndex: number,
  blockIndent: number,
) => {
  let index = startIndex;

  while (index < lines.length && lines[index].indent >= blockIndent) {
    index += 1;
  }

  return index;
};

const executeCommand = (
  rawLine: string,
  lineNumber: number,
  jsDepth: number,
  context: RuntimeContext,
  emitCode = true,
) => {
  const cleanedLine = rawLine
    .replace(/[.;]+$/, "")
    .replace(/^print\s*\((.+)\)$/i, "print $1")
    .replace(/^show\s*\((.+)\)$/i, "show $1")
    .replace(/^say\s*\((.+)\)$/i, "say $1");

  if (/^(#|\/\/)/.test(cleanedLine)) {
    return;
  }

  let match: RegExpMatchArray | null;

  try {
    match = cleanedLine.match(
      /^make (?:a )?(list|array|number|word|text|string|boolean|flag) called ([a-zA-Z][\w\s]*) (?:with|=) (.+)$/i,
    );
    if (match) {
      const kind = match[1].toLowerCase();
      const variableName = normalizeName(match[2]);
      const rawValue = match[3].trim();
      const value = parseValueByKind(kind, rawValue, variableName, context.variables);
      const jsLine = defineOrAssign(context.variables, variableName, value);

      context.variables[variableName] = value;
      if (emitCode) {
        pushGeneratedCode(context.generatedCode, jsLine, jsDepth);
      }
      context.steps.push(`Created ${variableName}.`);
      return;
    }

    match = cleanedLine.match(/^create list ([a-zA-Z][\w\s]*)$/i);
    if (match) {
      const variableName = normalizeName(match[1]);
      const value: StoryValue = [];
      const jsLine = defineOrAssign(context.variables, variableName, value);

      context.variables[variableName] = value;
      if (emitCode) {
        pushGeneratedCode(context.generatedCode, jsLine, jsDepth);
      }
      context.steps.push(`Created ${variableName}.`);
      return;
    }

    match = cleanedLine.match(
      /^(variable|let|const)\s+([a-zA-Z][\w]*)\s*[:=]\s*(.+)$/i,
    );
    if (match) {
      const variableName = normalizeName(match[2]);
      const value = evaluateExpression(match[3].trim(), context.variables);
      const declarationKeyword = match[1].toLowerCase() === "const" ? "const" : "let";
      const jsLine =
        variableName in context.variables
          ? `${variableName} = ${formatJsValue(value)};`
          : `${declarationKeyword} ${variableName} = ${formatJsValue(value)};`;

      context.variables[variableName] = value;
      if (emitCode) {
        pushGeneratedCode(context.generatedCode, jsLine, jsDepth);
      }
      context.steps.push(`Created ${variableName}.`);
      return;
    }

    match = cleanedLine.match(/^([a-zA-Z][\w]*)\s*=\s*(.+)$/);
    if (match) {
      const variableName = normalizeName(match[1]);
      const value = evaluateExpression(match[2].trim(), context.variables);
      const jsLine = defineOrAssign(context.variables, variableName, value);

      context.variables[variableName] = value;
      if (emitCode) {
        pushGeneratedCode(context.generatedCode, jsLine, jsDepth);
      }
      context.steps.push(`Updated ${variableName}.`);
      return;
    }

    match = cleanedLine.match(/^set ([a-zA-Z][\w\s]*) (?:to|=) (.+)$/i);
    if (match) {
      const variableName = normalizeName(match[1]);
      const expression = match[2].trim();
      const value = evaluateExpression(expression, context.variables);
      const jsLine = defineOrAssign(context.variables, variableName, value);

      context.variables[variableName] = value;
      if (emitCode) {
        pushGeneratedCode(context.generatedCode, jsLine, jsDepth);
      }
      context.steps.push(`Updated ${variableName}.`);
      return;
    }

    match = cleanedLine.match(/^change ([a-zA-Z][\w\s]*) by (.+)$/i);
    if (match) {
      const variableName = normalizeName(match[1]);
      const amount = getNumber(resolveToken(match[2], context.variables), "change amount");
      const current = getNumber(context.variables[variableName], variableName);
      const nextValue = current + amount;

      context.variables[variableName] = nextValue;
      if (emitCode) {
        pushGeneratedCode(context.generatedCode, `${variableName} += ${amount};`, jsDepth);
      }
      context.steps.push(`Changed ${variableName}.`);
      return;
    }

    match = cleanedLine.match(/^add (.+) to ([a-zA-Z][\w\s]*)$/i);
    if (match) {
      const variableName = normalizeName(match[2]);
      const currentValue = context.variables[variableName];

      if (Array.isArray(currentValue)) {
        const nextItem = resolveToken(match[1], context.variables);
        const list = [...currentValue, nextItem];

        context.variables[variableName] = list;
        if (emitCode) {
          pushGeneratedCode(
            context.generatedCode,
            `${variableName}.push(${formatJsValue(nextItem)});`,
            jsDepth,
          );
        }
        context.steps.push(`Added an item to ${variableName}.`);
        return;
      }

      const valueToAdd = getNumber(resolveToken(match[1], context.variables), "added value");
      const current = getNumber(currentValue, variableName);
      const nextValue = current + valueToAdd;

      context.variables[variableName] = nextValue;
      if (emitCode) {
        pushGeneratedCode(context.generatedCode, `${variableName} += ${valueToAdd};`, jsDepth);
      }
      context.steps.push(`Added to ${variableName}.`);
      return;
    }

    match = cleanedLine.match(/^(push|append) (.+) (?:into|to) ([a-zA-Z][\w\s]*)$/i);
    if (match) {
      const nextItem = resolveToken(match[2], context.variables);
      const variableName = normalizeName(match[3]);
      const list = [...getList(context.variables[variableName], variableName), nextItem];

      context.variables[variableName] = list;
      if (emitCode) {
        pushGeneratedCode(
          context.generatedCode,
          `${variableName}.push(${formatJsValue(nextItem)});`,
          jsDepth,
        );
      }
      context.steps.push(`Added an item to ${variableName}.`);
      return;
    }

    match = cleanedLine.match(/^insert (.+) at (.+) of ([a-zA-Z][\w\s]*)$/i);
    if (match) {
      const nextItem = resolveToken(match[1], context.variables);
      const requestedIndex = getNumber(resolveToken(match[2], context.variables), "item number");
      const variableName = normalizeName(match[3]);
      const list = [...getList(context.variables[variableName], variableName)];
      const index = Math.max(0, Math.floor(requestedIndex) - 1);

      list.splice(index, 0, nextItem);
      context.variables[variableName] = list;
      if (emitCode) {
        pushGeneratedCode(
          context.generatedCode,
          `${variableName}.splice(${index}, 0, ${formatJsValue(nextItem)});`,
          jsDepth,
        );
      }
      context.steps.push(`Inserted an item into ${variableName}.`);
      return;
    }

    match = cleanedLine.match(/^replace item (.+) of ([a-zA-Z][\w\s]*) with (.+)$/i);
    if (match) {
      const requestedIndex = getNumber(resolveToken(match[1], context.variables), "item number");
      const variableName = normalizeName(match[2]);
      const nextItem = resolveToken(match[3], context.variables);
      const list = [...getList(context.variables[variableName], variableName)];
      const index = Math.max(0, Math.floor(requestedIndex) - 1);

      list[index] = nextItem;
      context.variables[variableName] = list;
      if (emitCode) {
        pushGeneratedCode(
          context.generatedCode,
          `${variableName}[${index}] = ${formatJsValue(nextItem)};`,
          jsDepth,
        );
      }
      context.steps.push(`Replaced an item in ${variableName}.`);
      return;
    }

    match = cleanedLine.match(/^delete item (.+) of ([a-zA-Z][\w\s]*)$/i);
    if (match) {
      const requestedIndex = getNumber(resolveToken(match[1], context.variables), "item number");
      const variableName = normalizeName(match[2]);
      const list = [...getList(context.variables[variableName], variableName)];
      const index = Math.max(0, Math.floor(requestedIndex) - 1);

      list.splice(index, 1);
      context.variables[variableName] = list;
      if (emitCode) {
        pushGeneratedCode(
          context.generatedCode,
          `${variableName}.splice(${index}, 1);`,
          jsDepth,
        );
      }
      context.steps.push(`Deleted an item from ${variableName}.`);
      return;
    }

    match = cleanedLine.match(/^(show|print|say)\s+(.+)$/i);
    if (match) {
      const allowBareWordText = match[1].toLowerCase() === "say";
      const value = evaluateExpression(match[2], context.variables, {
        allowBareWordText,
      });

      context.output.push(formatOutputValue(value));
      if (emitCode) {
        pushGeneratedCode(
          context.generatedCode,
          `console.log(${formatJsValue(value)});`,
          jsDepth,
        );
      }
      context.steps.push("Printed to the console.");
      return;
    }

    throw new Error(
      "I do not understand that line yet. Try friendly commands like 'say', 'repeat 10 times', 'make', 'set', 'change', 'add', or 'show'.",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    context.errors.push(`Line ${lineNumber}: ${message}`);
  }
};

const executeRange = (
  lines: ParsedLine[],
  startIndex: number,
  endIndex: number,
  currentIndent: number,
  jsDepth: number,
  context: RuntimeContext,
  emitCode = true,
): number => {
  let index = startIndex;

  while (index < endIndex) {
    const line = lines[index];

    if (line.indent < currentIndent) {
      return index;
    }

    if (line.indent > currentIndent) {
      context.errors.push(
        `Line ${line.lineNumber}: This line is indented more than I expected. Put it under a 'repeat ... times' block or move it back.`,
      );
      index += 1;
      continue;
    }

    const repeatInlineMatch = line.text.match(/^repeat (.+?) times\s*:\s*(.+)$/i);
    if (repeatInlineMatch) {
      try {
        const count = Math.max(
          0,
          Math.floor(
            getNumber(
              evaluateExpression(repeatInlineMatch[1], context.variables),
              "repeat count",
            ),
          ),
        );

        if (emitCode) {
          pushGeneratedCode(
            context.generatedCode,
            `for (let repeat_${line.lineNumber} = 0; repeat_${line.lineNumber} < ${count}; repeat_${line.lineNumber} += 1) {`,
            jsDepth,
          );
        }

        for (let repeatIndex = 0; repeatIndex < count; repeatIndex += 1) {
          executeCommand(
            repeatInlineMatch[2],
            line.lineNumber,
            jsDepth + 1,
            context,
            emitCode && repeatIndex === 0,
          );
        }

        if (emitCode) {
          pushGeneratedCode(context.generatedCode, "}", jsDepth);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error.";
        context.errors.push(`Line ${line.lineNumber}: ${message}`);
      }

      index += 1;
      continue;
    }

    const repeatMatch = line.text.match(/^repeat (.+?) times\s*:?\s*$/i);
    if (repeatMatch) {
      const nextLine = lines[index + 1];

      if (!nextLine || nextLine.indent <= line.indent) {
        context.errors.push(
          `Line ${line.lineNumber}: 'repeat ... times' needs an indented action underneath it.`,
        );
        index += 1;
        continue;
      }

      try {
        const count = Math.max(
          0,
          Math.floor(
            getNumber(
              evaluateExpression(repeatMatch[1], context.variables),
              "repeat count",
            ),
          ),
        );
        const blockIndent = nextLine.indent;
        const blockEnd = findBlockEnd(lines, index + 1, blockIndent);

        if (emitCode) {
          pushGeneratedCode(
            context.generatedCode,
            `for (let repeat_${line.lineNumber} = 0; repeat_${line.lineNumber} < ${count}; repeat_${line.lineNumber} += 1) {`,
            jsDepth,
          );
        }

        for (let repeatIndex = 0; repeatIndex < count; repeatIndex += 1) {
          executeRange(
            lines,
            index + 1,
            blockEnd,
            blockIndent,
            jsDepth + 1,
            context,
            emitCode && repeatIndex === 0,
          );
        }

        if (emitCode) {
          pushGeneratedCode(context.generatedCode, "}", jsDepth);
        }
        index = blockEnd;
        continue;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error.";
        context.errors.push(`Line ${line.lineNumber}: ${message}`);
        index += 1;
        continue;
      }
    }

    executeCommand(line.text, line.lineNumber, jsDepth, context, emitCode);
    index += 1;
  }

  return index;
};

export const runStoryProgram = (source: string): StoryResult => {
  const variables: Record<string, StoryValue> = {};
  const generatedCode: string[] = [];
  const output: string[] = [];
  const steps: string[] = [];
  const errors: string[] = [];
  const parsedLines = parseSourceLines(source);

  executeRange(
    parsedLines,
    0,
    parsedLines.length,
    0,
    0,
    {
      generatedCode,
      output,
      variables,
      steps,
      errors,
    },
  );

  return {
    generatedCode,
    output,
    variables,
    steps,
    errors,
    lineCount: parsedLines.length,
    source,
  };
};
