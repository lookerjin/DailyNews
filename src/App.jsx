import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const REPO_URL = 'https://github.com/lookerjin/DailyNews'
const ISSUES_URL = `${REPO_URL}/issues`

function readRoute() {
  const value = window.location.hash.replace(/^#\/?/, '')
  if (!value) return { name: 'home' }
  const [kind, ...rest] = value.split('/')
  if (kind === 'issue' && rest[0]) return { name: 'issue', id: Number(rest[0]) }
  if (kind === 'task' && rest.length) return { name: 'task', id: decodeURIComponent(rest.join('/')) }
  return { name: 'home' }
}

function navigate(path = '') {
  window.location.hash = path ? `/${path}` : '/'
}

function formatDate(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${date}T12:00:00+08:00`))
}

function formatTime(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function relativeCount(items, task) {
  const count = task === 'all' ? items.length : items.filter((item) => item.task === task).length
  return `${count} ${count === 1 ? 'entry' : 'entries'}`
}

function Header() {
  return (
    <header className="site-header">
      <button className="brand" onClick={() => navigate()} aria-label="返回首页">
        <span className="brand-mark">D</span>
        <span>DailyNews</span>
      </button>
      <nav className="header-actions">
        <a href={ISSUES_URL} target="_blank" rel="noreferrer">Issues</a>
        <a className="github-button" href={REPO_URL} target="_blank" rel="noreferrer">GitHub ↗</a>
      </nav>
    </header>
  )
}

function EmptyState() {
  return (
    <section className="empty-state">
      <span className="eyebrow">Ready for the first signal</span>
      <h2>还没有日报，时间线正在等第一条 Issue。</h2>
      <p>每次定时任务完成后创建一个 GitHub Issue。DailyNews 会在下一次构建时自动把它变成时间线中的一条记录。</p>
      <a className="primary-link" href={`${ISSUES_URL}/new`} target="_blank" rel="noreferrer">创建第一条 Issue ↗</a>
    </section>
  )
}

function TimelineCard({ item }) {
  return (
    <article className="timeline-card" onClick={() => navigate(`issue/${item.number}`)}>
      <div className="timeline-card-top">
        <button className="task-link" onClick={(event) => { event.stopPropagation(); navigate(`task/${encodeURIComponent(item.task)}`) }}>
          {item.taskName}
        </button>
        <time>{formatTime(item.generatedAt || item.createdAt)}</time>
      </div>
      <h3>{item.title}</h3>
      {item.summary && <p>{item.summary}</p>}
      <div className="card-footer">
        <div className="tag-row">
          {item.category && <span>{item.category}</span>}
          {item.status && item.status !== 'success' && <span>{item.status}</span>}
        </div>
        <span className="read-more">阅读全文 →</span>
      </div>
    </article>
  )
}

function Timeline({ items }) {
  const groups = useMemo(() => {
    return items.reduce((acc, item) => {
      const date = item.date || item.createdAt.slice(0, 10)
      if (!acc[date]) acc[date] = []
      acc[date].push(item)
      return acc
    }, {})
  }, [items])

  const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a))
  if (!dates.length) return <EmptyState />

  return (
    <div className="timeline">
      {dates.map((date) => (
        <section className="day-group" key={date}>
          <div className="day-label">
            <strong>{formatDate(date)}</strong>
            <span>{date}</span>
          </div>
          <div className="day-feed">
            {groups[date].map((item) => <TimelineCard item={item} key={item.number} />)}
          </div>
        </section>
      ))}
    </div>
  )
}

function Home({ issues, initialTask = 'all' }) {
  const [activeTask, setActiveTask] = useState(initialTask)
  useEffect(() => setActiveTask(initialTask), [initialTask])

  const tasks = useMemo(() => {
    const map = new Map()
    issues.forEach((item) => map.set(item.task, item.taskName))
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [issues])

  const filtered = activeTask === 'all' ? issues : issues.filter((item) => item.task === activeTask)
  const currentName = activeTask === 'all' ? '全部信息' : tasks.find((item) => item.id === activeTask)?.name || activeTask

  return (
    <main>
      <section className="hero">
        <span className="eyebrow">Personal intelligence feed</span>
        <h1>每天值得知道的事，<br />汇成一条时间线。</h1>
        <p>GitHub Issues 是数据源，GitHub Pages 是阅读界面。简单、可搜索、可迁移，也不依赖某一个 Agent。</p>
      </section>

      <section className="feed-shell">
        <div className="feed-heading">
          <div>
            <span className="eyebrow">Timeline</span>
            <h2>{currentName}</h2>
          </div>
          <span className="entry-count">{relativeCount(issues, activeTask)}</span>
        </div>

        <div className="tabs" aria-label="任务筛选">
          <button className={activeTask === 'all' ? 'active' : ''} onClick={() => { setActiveTask('all'); if (initialTask !== 'all') navigate() }}>All</button>
          {tasks.map((task) => (
            <button
              key={task.id}
              className={activeTask === task.id ? 'active' : ''}
              onClick={() => { setActiveTask(task.id); navigate(`task/${encodeURIComponent(task.id)}`) }}
            >
              {task.name}
            </button>
          ))}
        </div>

        <Timeline items={filtered} />
      </section>
    </main>
  )
}

function IssueDetail({ issue }) {
  if (!issue) {
    return (
      <main className="detail-page">
        <button className="back-link" onClick={() => navigate()}>← 返回时间线</button>
        <section className="empty-state"><h2>没有找到这条记录。</h2></section>
      </main>
    )
  }

  return (
    <main className="detail-page">
      <button className="back-link" onClick={() => navigate()}>← 返回时间线</button>
      <article className="article">
        <div className="article-meta">
          <button className="task-link" onClick={() => navigate(`task/${encodeURIComponent(issue.task)}`)}>{issue.taskName}</button>
          <span>{issue.date}</span>
          <span>#{issue.number}</span>
        </div>
        <h1>{issue.title}</h1>
        {issue.summary && <p className="article-summary">{issue.summary}</p>}
        <div className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a>,
            }}
          >
            {issue.body || '_这条 Issue 没有正文。_'}
          </ReactMarkdown>
        </div>
        <footer className="article-footer">
          <a href={issue.url} target="_blank" rel="noreferrer">在 GitHub 查看原始 Issue ↗</a>
        </footer>
      </article>
    </main>
  )
}

function App() {
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [route, setRoute] = useState(readRoute())

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}issues.json`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : [])
      .then((data) => setIssues(Array.isArray(data) ? data : []))
      .catch(() => setIssues([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="loading-screen"><span className="brand-mark">D</span><p>Loading DailyNews…</p></div>
  }

  return (
    <>
      <Header />
      {route.name === 'issue'
        ? <IssueDetail issue={issues.find((item) => item.number === route.id)} />
        : <Home issues={issues} initialTask={route.name === 'task' ? route.id : 'all'} />}
      <footer className="site-footer">
        <span>DailyNews</span>
        <span>Issues in. Signal out.</span>
      </footer>
    </>
  )
}

export default App
