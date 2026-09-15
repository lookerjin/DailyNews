import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './detail-nav.css'

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

function cleanHeadingText(value = '') {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\s+#+\s*$/, '')
    .trim()
}

function headingSlug(value = '') {
  return cleanHeadingText(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
}

function extractHeadings(markdown = '') {
  const headings = []
  const seen = new Map()
  let fence = null

  markdown.split(/\r?\n/).forEach((line) => {
    const fenceMatch = line.match(/^\s*(```|~~~)/)
    if (fenceMatch) {
      fence = fence === fenceMatch[1] ? null : (fence || fenceMatch[1])
      return
    }
    if (fence) return

    const match = line.match(/^(#{2,3})\s+(.+)$/)
    if (!match) return

    const title = cleanHeadingText(match[2])
    if (!title) return

    const base = headingSlug(title) || `section-${headings.length + 1}`
    const count = (seen.get(base) || 0) + 1
    seen.set(base, count)

    headings.push({
      id: `section-${base}${count > 1 ? `-${count}` : ''}`,
      title,
      level: match[1].length,
    })
  })

  return headings
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
        <h1>DailyNews</h1>
        <p>一个把 ChatGPT 和 Agent 定时任务的输出自动归档为 GitHub Issues，并按时间线整理、阅读和长期保存的个人信息主页。</p>
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

function DesktopChapterNav({ headings, activeId, onSelect }) {
  const navRef = useRef(null)

  useEffect(() => {
    if (!activeId || !navRef.current) return
    const activeButton = navRef.current.querySelector(`[data-chapter-id="${CSS.escape(activeId)}"]`)
    activeButton?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  if (!headings.length) return null

  return (
    <aside className="chapter-sidebar" aria-label="文章目录">
      <div className="chapter-sidebar-inner">
        <span className="chapter-sidebar-title">本文目录</span>
        <nav className="chapter-list" ref={navRef}>
          {headings.map((heading) => (
            <button
              key={heading.id}
              type="button"
              data-chapter-id={heading.id}
              className={`${heading.level === 3 ? 'chapter-sub' : ''} ${activeId === heading.id ? 'active' : ''}`.trim()}
              onClick={() => onSelect(heading.id)}
            >
              {heading.title}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  )
}

function MobileChapterSelect({ headings, activeId, onSelect }) {
  if (!headings.length) return null

  return (
    <div className="chapter-mobile">
      <label htmlFor="chapter-select">章节</label>
      <select
        id="chapter-select"
        value={activeId || headings[0].id}
        onChange={(event) => onSelect(event.target.value)}
        aria-label="选择文章章节"
      >
        {headings.map((heading) => (
          <option key={heading.id} value={heading.id}>
            {heading.level === 3 ? `↳ ${heading.title}` : heading.title}
          </option>
        ))}
      </select>
    </div>
  )
}

function BackToStartButton({ visible, onClick }) {
  return (
    <button
      type="button"
      className={`back-to-start ${visible ? 'visible' : ''}`}
      onClick={onClick}
      aria-label="回到文章开始"
      title="回到开始"
    >
      ↑
    </button>
  )
}

function IssueDetail({ issue }) {
  const headings = useMemo(() => extractHeadings(issue?.body || ''), [issue?.body])
  const [activeChapter, setActiveChapter] = useState(headings[0]?.id || '')
  const [showBackToStart, setShowBackToStart] = useState(false)
  const articleStartRef = useRef(null)

  useEffect(() => {
    setActiveChapter(headings[0]?.id || '')
    setShowBackToStart(false)
    if (!issue) return undefined

    const updateScrollState = () => {
      setShowBackToStart(window.scrollY > 520)

      if (!headings.length) return
      let current = headings[0].id
      for (const heading of headings) {
        const element = document.getElementById(heading.id)
        if (!element) continue
        if (element.getBoundingClientRect().top <= 120) current = heading.id
        else break
      }
      setActiveChapter(current)
    }

    const frame = requestAnimationFrame(updateScrollState)
    window.addEventListener('scroll', updateScrollState, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateScrollState)
    }
  }, [headings, issue?.number])

  if (!issue) {
    return (
      <main className="detail-page">
        <button className="back-link" onClick={() => navigate()}>← 返回时间线</button>
        <section className="empty-state"><h2>没有找到这条记录。</h2></section>
      </main>
    )
  }

  let headingCursor = 0
  const renderHeading = (Tag) => ({ children, ...props }) => {
    const heading = headings[headingCursor]
    headingCursor += 1
    return <Tag {...props} id={heading?.id}>{children}</Tag>
  }

  const scrollToChapter = (id) => {
    const target = document.getElementById(id)
    if (!target) return
    setActiveChapter(id)
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const scrollToStart = () => {
    articleStartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="detail-page">
      <button className="back-link" onClick={() => navigate()}>← 返回时间线</button>
      <article className="article" ref={articleStartRef}>
        <div className="article-layout">
          <div className="article-main">
            <div className="article-meta">
              <button className="task-link" onClick={() => navigate(`task/${encodeURIComponent(issue.task)}`)}>{issue.taskName}</button>
              <span>{issue.date}</span>
              <span>#{issue.number}</span>
            </div>
            <h1>{issue.title}</h1>
            {issue.summary && <p className="article-summary">{issue.summary}</p>}

            <MobileChapterSelect headings={headings} activeId={activeChapter} onSelect={scrollToChapter} />

            <div className="markdown-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a>,
                  h2: renderHeading('h2'),
                  h3: renderHeading('h3'),
                }}
              >
                {issue.body || '_这条 Issue 没有正文。_'}
              </ReactMarkdown>
            </div>
            <footer className="article-footer">
              <a href={issue.url} target="_blank" rel="noreferrer">在 GitHub 查看原始 Issue ↗</a>
            </footer>
          </div>

          <DesktopChapterNav headings={headings} activeId={activeChapter} onSelect={scrollToChapter} />
        </div>
      </article>

      <BackToStartButton visible={showBackToStart} onClick={scrollToStart} />
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
