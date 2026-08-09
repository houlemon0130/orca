import type { AgentSessionOptionCatalog, CatalogModel } from './agent-session-option-catalog-types'
import { removeAgentArgOption } from './agent-session-option-agent-args'
import { hasFlag } from './agent-cli-flag-detection'
import { parseQoderCliModelList } from './qodercli-model-list'

function parseQoderCliCatalogModels(stdout: string): CatalogModel[] {
  return parseQoderCliModelList(stdout).map((model) => ({
    id: model.id,
    label: model.label,
    ...(model.description ? { description: model.description } : {}),
    options: []
  }))
}

// Why: unlike Claude's stable family aliases, the fork's model list is
// deployment- and account-specific (gateway aliases like Ultimate, dogfood
// entries), so `Auto` is the only safe universal seed and the probe's
// membership is authoritative. No effort option: the CLI accepts
// `--reasoning-effort` without validating choices, so there is no menu to offer.
export const QODERCLI_SESSION_OPTION_CATALOG: AgentSessionOptionCatalog = {
  supportsWorkerLaunchPreferences: true,
  models: [{ id: 'Auto', label: 'Auto', isDefault: true, options: [] }],
  modelApply: {
    launchArgs: (value) => ['--model', String(value)],
    agentArgsOverride: (tokens) => hasFlag(tokens, ['-m', '--model']),
    removeAgentArgs: (tokens) => removeAgentArgOption(tokens, ['-m', '--model']),
    // Why: no detectAgentInteraction — the fork has no cached-model switch
    // confirmation prompt (its /model echoes "Model set to <name>" directly).
    midSession: {
      kind: 'command',
      build: (value) => `/model ${String(value)}`,
      pickerCommand: '/model'
    }
  },
  unknownModelOptions: [],
  discoveredModelsAreAuthoritative: true,
  listModels: {
    command: 'qodercli --list-models',
    parse: parseQoderCliCatalogModels
  }
}
