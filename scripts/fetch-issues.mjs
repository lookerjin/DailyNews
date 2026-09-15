import fs from 'node:fs/promises'
import path from 'node:path'
import YAML from 'yaml'

const repository = process.env.GITHUB_REPOSITORY || 'lookerjin/DailyNews'
const token = process.env.GITHUB_TOKEN
const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
}

function parseFrontmatter(body = '') {
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { meta: {}, body }
  try {
    return { meta: YAML.parse(match[1]) || {}, body: match[2].trim() }
  } catch (error) {
    console.warn('Invalid YAML frontmatter:', error.message)
    return { meta: {}, body }
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
  const { meta, body } = parseFrontmatter(issue.body || '')
  const labels = issue.labels.map((label) => typeof label === 'string' ? label : label.name).filter(Boolean)
  const taskLabel = labels.find((label) => label.startsWith('task:'))
  const task = String(meta.task || taskLabel?.slice(5) || 'daily').trim()
  const taskName = String(meta.task_name || meta.taskName || humanize(task)).trim()
  const date = String(meta.date || issue.created_at.slice(0, 10))

  return {
    number: issue.number,
    title: cleanIssueTitle(issue.title),
    sourceTitle: issue.title,
    body,
    summary: String(meta.summary || makeSummary(body)),
    task,
    taskName,
    category: meta.category ? String(meta.category) : '',
    type: String(meta.type || 'daily'),
    status: String(meta.status || (issue.state === 'closed' ? 'archived' : 'success')),
    date,
    generatedAt: String(meta.generated_at || meta.generatedAt || issue.created_at),
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    labels,
    state: issue.state,
    url: issue.html_url,
  }
}

const issues = (await fetchAllIssues())
  .map(normalize)
  .sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))

const output = path.resolve('public/issues.json')
await fs.mkdir(path.dirname(output), { recursive: true })
await fs.writeFile(output, `${JSON.stringify(issues, null, 2)}\n`)
console.log(`Wrote ${issues.length} issues to ${output}`)
