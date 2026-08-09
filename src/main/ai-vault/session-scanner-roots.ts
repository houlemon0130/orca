import { homedir } from 'node:os'
import { join } from 'node:path'
import { normalizeAgentSessionsDir } from './session-scanner-values'

// The default local roots for the two agents whose subagent transcripts are
// read back by renderer-supplied path (Claude and OMP). Discovery scans these;
// the IPC listers use the root enumerations below to reject arbitrary paths.
const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects')
export const OMP_SESSIONS_DIR = normalizeAgentSessionsDir(
  process.env.OMP_CODING_AGENT_DIR?.trim() || join(homedir(), '.omp', 'agent', 'sessions'),
  '.omp'
)

// The local host and each WSL distro's `~/.claude/projects`. Callers reading
// Claude session files by path use these roots to reject arbitrary paths.
export function claudeProjectsRootDirs(args: {
  claudeProjectsDir?: string
  wslHomeDirs?: readonly string[]
}): string[] {
  return [
    args.claudeProjectsDir ?? CLAUDE_PROJECTS_DIR,
    ...(args.wslHomeDirs ?? []).map((homeDir) => join(homeDir, '.claude', 'projects'))
  ]
}

// Why: qodercli ships a global build (`~/.qoder`) and a CN build (`~/.qoder-cn`)
// with identical Claude-shaped transcript stores; Orca models both as one agent,
// so every root pair is scanned and allowlisted together.
const QODER_PROJECTS_DIRS = [
  join(homedir(), '.qoder', 'projects'),
  join(homedir(), '.qoder-cn', 'projects')
]

// The local host and each WSL distro's Qoder projects roots. Callers reading
// qodercli session files by path use these roots to reject arbitrary paths.
export function qoderProjectsRootDirs(args: {
  qoderProjectsDirs?: string[]
  wslHomeDirs?: readonly string[]
}): string[] {
  return [
    ...(args.qoderProjectsDirs ?? QODER_PROJECTS_DIRS),
    ...(args.wslHomeDirs ?? []).flatMap((homeDir) => [
      join(homeDir, '.qoder', 'projects'),
      join(homeDir, '.qoder-cn', 'projects')
    ])
  ]
}

// The local host and each WSL distro's OMP sessions root. Callers reading OMP
// session files by path use these roots to reject arbitrary paths.
export function ompSessionsRootDirs(args: {
  ompSessionsDir?: string
  wslHomeDirs?: readonly string[]
}): string[] {
  return (
    sessionRootDirs(
      args.ompSessionsDir ?? OMP_SESSIONS_DIR,
      normalizedWslHomeDirs(args.wslHomeDirs),
      ['.omp', 'agent', 'sessions']
    )
      // Why: OMP_CODING_AGENT_DIR='/' normalizes to '', which resolve()s to the
      // process cwd — an empty root would silently allowlist it.
      .filter((rootDir) => rootDir.trim().length > 0)
  )
}

export function normalizedWslHomeDirs(homeDirs: readonly string[] | undefined): string[] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const homeDir of homeDirs ?? []) {
    const trimmed = homeDir.trim()
    if (!trimmed || seen.has(trimmed)) {
      continue
    }
    seen.add(trimmed)
    unique.push(trimmed)
  }
  return unique
}

export function sessionRootDirs(
  hostRootDir: string,
  wslHomeDirs: readonly string[],
  segments: readonly string[]
): string[] {
  return [hostRootDir, ...wslHomeDirs.map((homeDir) => join(homeDir, ...segments))]
}
