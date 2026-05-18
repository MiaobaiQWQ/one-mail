#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'

const DEFAULT_MODEL = 'qwen2.5-coder:latest'
const DIFF_LIMIT = Number(process.env.OLLAMA_COMMIT_DIFF_LIMIT ?? 12000)
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_COMMIT_TIMEOUT_MS ?? 45000)
const OLLAMA_HOST = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434'
const MODEL = process.env.OLLAMA_COMMIT_MODEL ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL
const PRINT_ONLY = process.argv[2] === '--print'
const COMMIT_MESSAGE_FILE = PRINT_ONLY ? undefined : process.argv[2]
const COMMIT_SOURCE = PRINT_ONLY ? undefined : process.argv[3]

if (!PRINT_ONLY && !COMMIT_MESSAGE_FILE) {
  process.exit(0)
}

if (COMMIT_SOURCE && COMMIT_SOURCE !== 'message' && COMMIT_SOURCE !== 'template') {
  process.exit(0)
}

if (COMMIT_MESSAGE_FILE && hasMeaningfulCommitMessage(COMMIT_MESSAGE_FILE)) {
  process.exit(0)
}

const stagedDiff = getStagedDiff()
if (!stagedDiff.trim()) {
  process.exit(0)
}

const prompt = buildPrompt(stagedDiff)
const message = sanitizeCommitMessage(callOllama(prompt))

if (!message) {
  console.warn('[ollama-commit] Skipped commit message generation.')
  process.exit(0)
}

if (PRINT_ONLY) {
  console.log(message)
} else if (COMMIT_MESSAGE_FILE) {
  writeFileSync(COMMIT_MESSAGE_FILE, `${message}\n`, 'utf8')
  console.log(`[ollama-commit] Generated commit message with ${MODEL}.`)
}

function hasMeaningfulCommitMessage(path) {
  if (!existsSync(path)) return false

  const content = readFileSync(path, 'utf8')
  return content.split(/\r?\n/).some((line) => line.trim() !== '' && !line.trim().startsWith('#'))
}

function getStagedDiff() {
  const args = [
    'diff',
    '--cached',
    '--diff-algorithm=minimal',
    '--no-ext-diff',
    '--no-color',
    '--',
    '.'
  ]

  try {
    const diff = execFileSync('git', args, {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 8
    })

    if (diff.length <= DIFF_LIMIT) {
      return diff
    }

    return `${diff.slice(0, DIFF_LIMIT)}\n\n[Diff truncated to ${DIFF_LIMIT} characters.]`
  } catch (error) {
    console.warn(`[ollama-commit] Failed to read staged diff: ${formatError(error)}`)
    return ''
  }
}

function buildPrompt(diff) {
  return [
    'You write concise git commit messages for this repository.',
    'Use the staged diff below to produce exactly one Conventional Commit subject line.',
    'Rules:',
    '- Output only the commit message. No markdown, quotes, explanation, or alternatives.',
    '- Format: type(scope): summary, or type: summary when scope is unclear.',
    '- Allowed types: feat, fix, refactor, chore, docs, test, build, ci, style, perf, revert.',
    '- Keep it under 72 characters when possible.',
    '- Use English.',
    '- Prefer the smallest accurate scope from changed paths.',
    '',
    'Staged diff:',
    diff
  ].join('\n')
}

function callOllama(prompt) {
  const result = spawnSync('ollama', ['run', MODEL], {
    input: prompt,
    encoding: 'utf8',
    env: {
      ...process.env,
      OLLAMA_HOST
    },
    timeout: OLLAMA_TIMEOUT_MS,
    maxBuffer: 1024 * 1024 * 2
  })

  if (result.error) {
    console.warn(`[ollama-commit] Ollama unavailable: ${result.error.message}`)
    return ''
  }

  if (result.status !== 0) {
    const details = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`
    console.warn(`[ollama-commit] Ollama failed: ${details}`)
    return ''
  }

  return result.stdout
}

function sanitizeCommitMessage(output) {
  const firstMeaningfulLine = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('```'))

  if (!firstMeaningfulLine) return ''

  return firstMeaningfulLine
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^\s*(commit message|message)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .slice(0, 120)
    .trim()
}

function formatError(error) {
  if (error && typeof error === 'object' && 'message' in error) {
    return error.message
  }

  return String(error)
}

process.on('SIGTERM', () => {
  console.warn(`[ollama-commit] ${basename(process.argv[1])} timed out or was terminated.`)
  process.exit(0)
})
