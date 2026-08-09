// Parses `qodercli --list-models` output. The listing is a plain-text table:
// a `MODEL` header row, then one display name per line, optionally suffixed
// with the underlying model id in parentheses, e.g.
//   MODEL
//   Auto
//   Ultimate
//   Peach-07-17-DogFooding (qwen3.8-v98-dogfood-crit)
// The display name is what `-m/--model` and `/model` accept.

export type QoderCliListedModel = {
  /** Value the CLI accepts for `--model` and `/model` (the display name). */
  id: string
  label: string
  /** The underlying model id when the listing annotates one in parentheses. */
  description?: string
}

const HEADER_ROW = /^model$/i

export function parseQoderCliModelList(stdout: string): QoderCliListedModel[] {
  const seen = new Set<string>()
  const models: QoderCliListedModel[] = []
  // Why: only rows after the MODEL header count — a logged-out CLI can print
  // error text with exit 0, which must not parse as a model list.
  let headerSeen = false
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!headerSeen) {
      headerSeen = HEADER_ROW.test(line)
      continue
    }
    if (!line) {
      continue
    }
    const match = /^(.+?)(?:\s+\(([^()]+)\))?$/.exec(line)
    if (!match) {
      continue
    }
    const id = match[1].trim()
    if (!id || seen.has(id)) {
      continue
    }
    seen.add(id)
    models.push({
      id,
      label: id,
      ...(match[2]?.trim() ? { description: match[2].trim() } : {})
    })
  }
  return models
}
