import fs from 'node:fs/promises'
import path from 'node:path'
import YAML from 'yaml'

const repository = process.env.GITHUB_REPOSITORY || 'lookerjin/DailyNews'
const [repositoryOwner] = repository.split('/')
const token = process.env.GITHUB_TOKEN
const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
}

const warnings = []

function warn(issue, message) {
  const text = `Issue #${issue.number}: ${message}`
  warnings.push(text)
  console.warn(`[DailyNews] ${text}`)
}

function parseFrontmatter(body = '') {
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    return {
      meta: {},
      body,
      hasFrontmatter: false,
      validFrontmatter: false,
      error: null,
    }
  }

  try {
    const meta = YAML.parse(match[1])
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
      throw new Error('frontmatter must be a YAML mapping')
    }

    return {
      meta,
      body: match[2].trim(),
      hasFrontmatter: true,
      validFrontmatter: true,
      error: null,
    }
  } catch (error) {
    return {
      meta: {},
      body: match[2].trim(),
      hasFrontmatter: true,
      validFrontmatter: false,
      error: error.message,
    }
  }
}

function humanize(value = 'daily') {
  return String(value)
    .replace(/^task:/, '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function cleanIssueTitle(title = '') {
  const original = String(title).trim()
  const cleaned = original
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/^\d{4}-\d{2}-\d{2}\s*(?:[｜|:：]|[-–—])\s*/, '')
    .trim()

  return cleaned || original
}

function makeSummary(body = '') {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[>*_`~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

function nonEmptyString(value, fallback, issue, field) {
  if (value == null || value === '') return fallback
  if (typeof value !== 'string') {
    warn(issue, `${field} should be a string; using fallback`)
    return fallback
  }

  const normalized = value.trim()
  if (!normalized) {
    warn(issue, `${field} is empty; using fallback`)
    return fallback
  }
  return normalized
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isValidDateTime(value) {
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value))
}

async function fetchAllIssues() {
  const [owner, repo] = repository.split('/')
  const all = []
  for (let page = 1; ; page += 1) {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100&sort=created&direction=desc&page=${page}`
    const response = await fetch(url, { headers })
    if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`)
    const batch = await response.json()
    all.push(...batch.filter((issue) => !issue.pull_request))
    if (batch.length < 100) break
  }
  return all
}

function normalize(issue) {
  const parsed = parseFrontmatter(issue.body || '')
  const author = issue.user?.login || ''

  if (author !== repositoryOwner) {
    warn(issue, `skipped: author ${author || '(unknown)'} is not repository owner ${repositoryOwner}`)
    return null
  }

  if (!parsed.hasFrontmatter) {
    warn(issue, 'skipped: missing DailyNews frontmatter')
    return null
  }

  if (!parsed.validFrontmatter) {
    warn(issue, `skipped: invalid frontmatter (${parsed.error})`)
    return null
  }

  const { meta, body } = parsed
  const task = typeof meta.task === 'string' ? meta.task.trim() : ''
  if (!task) {
    warn(issue, 'skipped: frontmatter.task is required')
    return null
  }

  const labels = (issue.labels || [])
    .map((label) => typeof label === 'string' ? label : label.name)
    .filter(Boolean)

  const taskName = nonEmptyString(meta.task_name ?? meta.taskName, humanize(task), issue, 'task_name')

  const fallbackDate = issue.created_at.slice(0, 10)
  const requestedDate = meta.date == null ? fallbackDate : String(meta.date).trim()
  const date = isValidDate(requestedDate) ? requestedDate : fallbackDate
  if (requestedDate !== fallbackDate && !isValidDate(requestedDate)) {
    warn(issue, `invalid date ${JSON.stringify(requestedDate)}; using ${fallbackDate}`)
  }

  const requestedGeneratedAt = meta.generated_at ?? meta.generatedAt ?? issue.created_at
  const generatedAt = isValidDateTime(requestedGeneratedAt)
    ? String(requestedGeneratedAt).trim()
    : issue.created_at
  if (requestedGeneratedAt !== issue.created_at && !isValidDateTime(requestedGeneratedAt)) {
    warn(issue, `invalid generated_at; using GitHub created_at`)
  }

  let summary = makeSummary(body)
  if (meta.summary != null) {
    if (typeof meta.summary === 'string' && meta.summary.trim()) {
      summary = meta.summary.trim()
    } else {
      warn(issue, 'summary should be a non-empty string; generated summary used')
    }
  }

  const category = meta.category == null
    ? ''
    : nonEmptyString(meta.category, '', issue, 'category')
  const type = nonEmptyString(meta.type, 'daily', issue, 'type')
  const status = nonEmptyString(
    meta.status,
    issue.state === 'closed' ? 'archived' : 'success',
    issue,
    'status',
  )

  return {
    number: issue.number,
    title: cleanIssueTitle(issue.title),
    sourceTitle: issue.title,
    body,
    summary,
    task,
    taskName,
    category,
    type,
    status,
    date,
    generatedAt,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    labels,
    state: issue.state,
    url: issue.html_url,
  }
}

const sourceIssues = await fetchAllIssues()
const issues = sourceIssues
  .map(normalize)
  .filter(Boolean)
  .sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))

const output = path.resolve('public/issues.json')
await fs.mkdir(path.dirname(output), { recursive: true })
await fs.writeFile(output, `${JSON.stringify(issues, null, 2)}\n`)

console.log(`Wrote ${issues.length} published issues to ${output}`)
console.log(`Skipped ${sourceIssues.length - issues.length} non-published or invalid issues`)
if (warnings.length) console.log(`Completed with ${warnings.length} warning(s)`)
