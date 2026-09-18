import type { ValidationResult, CompositionPlan } from '../../types'

/**
 * Validate generated Strudel code before presenting to the user.
 * Pure function — no side effects.
 */
export function validatePattern(
  code: string,
  plan?: CompositionPlan,
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. Must not be empty
  if (!code.trim()) {
    errors.push('Generated code is empty')
    return { valid: false, errors, warnings }
  }

  // 2. Balanced braces/parens/brackets
  checkSyntax(code, errors)

  // Generated patterns are JavaScript and must not escape the musical DSL.
  checkUnsafeCode(code, errors)

  // 3. Must contain stack() call
  if (!/stack\s*\(/.test(code)) {
    errors.push('Missing stack() — the top-level combinator is required')
  }

  // 4. Must contain setcpm() call
  if (!/setcpm\s*\(/.test(code)) {
    warnings.push('Missing setcpm() — tempo should be set explicitly')
  }

  // 5. Layer marker checks
  const { starts, ends } = extractMarkers(code)
  if (starts.length === 0) {
    errors.push('No @agent:layer:*:start markers found — each layer must be marked')
  } else {
    checkMarkerPairs(starts, ends, errors, warnings)
    if (plan) checkLayerNames(starts, plan, warnings)
  }

  // 6. Empty layer blocks
  checkEmptyLayers(code, starts, ends, warnings)

  return { valid: errors.length === 0, errors, warnings }
}

const UNSAFE_CODE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|Worker|SharedWorker)\s*\(/, label: 'network or worker API' },
  { pattern: /\b(?:document|window|globalThis|navigator|location|localStorage|sessionStorage|indexedDB|caches)\b/, label: 'browser global' },
  { pattern: /\b(?:eval|Function)\s*\(/, label: 'dynamic code execution' },
  { pattern: /\bimport\s*\(/, label: 'dynamic import' },
  { pattern: /\b(?:constructor|prototype|__proto__|process)\b/, label: 'object escape primitive' },
  { pattern: /\b(?:Object|Reflect|Proxy|frames|opener)\b/, label: 'global object escape primitive' },
  { pattern: /(?:[\w$)'"\]}])\s*\[/, label: 'computed property access' },
]

function checkUnsafeCode(code: string, errors: string[]): void {
  const executableCode = stripStringsAndComments(code)
  for (const { pattern, label } of UNSAFE_CODE_PATTERNS) {
    if (pattern.test(executableCode)) {
      errors.push(`Unsafe ${label} is not allowed in generated patterns`)
    }
  }
}

function stripStringsAndComments(code: string): string {
  let result = ''
  let quote: "'" | '"' | '`' | null = null
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < code.length; i++) {
    const char = code[i]
    const next = code[i + 1]

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false
        result += '\n'
      } else result += ' '
      continue
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false
        result += '  '
        i++
      } else result += char === '\n' ? '\n' : ' '
      continue
    }
    if (quote) {
      if (char === '\\') {
        result += '  '
        i++
      } else if (char === quote) {
        quote = null
        result += ' '
      } else result += char === '\n' ? '\n' : ' '
      continue
    }
    if (char === '/' && next === '/') {
      inLineComment = true
      result += '  '
      i++
    } else if (char === '/' && next === '*') {
      inBlockComment = true
      result += '  '
      i++
    } else if (char === "'" || char === '"' || char === '`') {
      quote = char
      result += ' '
    } else result += char
  }

  return result
}

function checkSyntax(code: string, errors: string[]): void {
  const closingFor: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
  const stack: { char: string; position: number }[] = []
  let quote: "'" | '"' | '`' | null = null
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < code.length; i++) {
    const char = code[i]
    const next = code[i + 1]

    if (inLineComment) {
      if (char === '\n') inLineComment = false
      continue
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false
        i++
      }
      continue
    }
    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = null
      continue
    }
    if (char === '/' && next === '/') {
      inLineComment = true
      i++
      continue
    }
    if (char === '/' && next === '*') {
      inBlockComment = true
      i++
      continue
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char
      continue
    }
    if (char in closingFor) {
      stack.push({ char, position: i })
      continue
    }
    if (char === ')' || char === ']' || char === '}') {
      const open = stack.pop()
      if (!open || closingFor[open.char] !== char) {
        errors.push(`Unexpected "${char}" at position ${i}`)
        return
      }
    }
  }

  const unclosed = stack.at(-1)
  if (unclosed) {
    errors.push(`Unclosed "${unclosed.char}" at position ${unclosed.position}`)
  }
}

function extractMarkers(code: string): {
  starts: { name: string; line: number }[]
  ends: { name: string; line: number }[]
} {
  const lines = code.split('\n')
  const starts: { name: string; line: number }[] = []
  const ends: { name: string; line: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const sm = lines[i].match(/@agent:layer:([\w-]+):start/)
    if (sm) starts.push({ name: sm[1], line: i + 1 })
    const em = lines[i].match(/@agent:layer:([\w-]+):end/)
    if (em) ends.push({ name: em[1], line: i + 1 })
  }

  return { starts, ends }
}

function checkMarkerPairs(
  starts: { name: string; line: number }[],
  ends: { name: string; line: number }[],
  errors: string[],
  _warnings: string[],
): void {
  const startNames = new Set(starts.map((s) => s.name))
  const endNames = new Set(ends.map((e) => e.name))

  for (const name of new Set([...startNames, ...endNames])) {
    const startCount = starts.filter((marker) => marker.name === name).length
    const endCount = ends.filter((marker) => marker.name === name).length
    if (startCount !== 1 || endCount !== 1) {
      errors.push(`Layer "${name}" must have exactly one start and one end marker (found ${startCount}/${endCount})`)
    }
  }

  for (const s of starts) {
    if (!endNames.has(s.name)) {
      errors.push(`Layer "${s.name}" has @agent:layer:${s.name}:start at line ${s.line} but no matching :end`)
    }
  }
  for (const e of ends) {
    if (!startNames.has(e.name)) {
      errors.push(`Layer "${e.name}" has @agent:layer:${e.name}:end at line ${e.line} but no matching :start`)
    }
  }

  // Check order: for each pair, start must come before end
  for (const s of starts) {
    const matchingEnd = ends.find((e) => e.name === s.name)
    if (matchingEnd && matchingEnd.line <= s.line) {
      errors.push(`Layer "${s.name}": end marker (line ${matchingEnd.line}) appears before start marker (line ${s.line})`)
    }
  }
}

function checkLayerNames(
  starts: { name: string; line: number }[],
  plan: CompositionPlan,
  warnings: string[],
): void {
  const planNames = new Set(plan.layers.map((l) => l.name))
  for (const s of starts) {
    if (!planNames.has(s.name)) {
      warnings.push(`Layer "${s.name}" at line ${s.line} not found in composition plan layers`)
    }
  }
  for (const l of plan.layers) {
    if (!starts.some((s) => s.name === l.name)) {
      warnings.push(`Plan layer "${l.name}" has no @agent:layer marker in generated code`)
    }
  }
}

function checkEmptyLayers(
  code: string,
  starts: { name: string; line: number }[],
  ends: { name: string; line: number }[],
  warnings: string[],
): void {
  const lines = code.split('\n')
  for (const s of starts) {
    const e = ends.find((x) => x.name === s.name)
    if (!e) continue
    const blockLines = lines.slice(s.line, e.line - 1)
    const hasContent = blockLines.some((l) => {
      const trimmed = l.trim()
      return trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('@agent')
    })
    if (!hasContent) {
      warnings.push(`Layer "${s.name}" (lines ${s.line}-${e.line}) has no code content`)
    }
  }
}
