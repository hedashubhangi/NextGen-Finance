import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './LearningApp.css'
import './Profile.css'
import ChapterOne from './ChapterOne.tsx'
import type { ActivityProgress, ActivityState, LearningState, QuestionProgress } from './ChapterOne.tsx'

type View = 'home' | 'learn' | 'progress' | 'achievements' | 'parent' | 'about' | 'profile'
const viewTitles: Record<View, { eyebrow: string; title: string }> = {
  home: { eyebrow: 'YOUR DASHBOARD', title: 'Financial foundations' },
  learn: { eyebrow: 'LEARNING PATH', title: 'Money basics' },
  progress: { eyebrow: 'YOUR LEARNING', title: 'Progress overview' },
  achievements: { eyebrow: 'YOUR LEARNING', title: 'Achievements' },
  parent: { eyebrow: 'FAMILY SPACE', title: 'For parents and caregivers' },
  about: { eyebrow: 'OUR STORY', title: 'About NextGen Finance' },
  profile: { eyebrow: 'YOUR ACCOUNT', title: 'Profile and settings' },
}
type ProfileSummary = { id: string; name: string; grade: number }
type Account = { id: string; username: string; email: string }
type AccountForm = { identifier: string; username: string; email: string; password: string; name: string; grade: number }
const apiBase = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}
type Profile = ProfileSummary & {
  joinedAt: string
  completedLessons: number[]
  savedLessons: number[]
  badges: string[]
  quizResults: { score: number; passed: boolean; completedAt: string }[]
  completedActivities: string[]
  xp: number
  coins: number
  savingsGoal?: { goal: string; plan: string; updatedAt: string } | null
  learningState: LearningState
}

const lessons = [
  { id: 1, title: 'What is money?', type: 'Article', time: '8 min', summary: 'Discover how money helps people exchange goods and services.', activity: 'Sort items you would trade for.' },
  { id: 2, title: 'Needs, wants, and choices', type: 'Interactive', time: '10 min', summary: 'Tell the difference between what we need and what we want.', activity: 'Choose a need or a want.' },
  { id: 3, title: 'Smart ways to save', type: 'Practice', time: '12 min', summary: 'Build a plan for something important to you.', activity: 'Set your first savings goal.' },
]
const homeLessons = [
  { id: 'article-1', title: 'What is money?', type: 'Article', time: '2–3 min', summary: 'Discover how money helps people exchange goods and services.' },
  { id: 'video-3', title: 'Needs, wants, and choices', type: 'Video', time: '3–5 min', summary: 'Tell the difference between what we need and what we want.' },
  { id: 'final-project', title: 'Make a savings plan', type: 'Project', time: '5 min', summary: 'Build a plan for something important to you.' },
]
const firstVisitTour = [
  { icon: '👋', title: 'Welcome to your money adventure!', text: 'Learn everyday money skills with short lessons, playful games, and tiny challenges. Go at your own pace.', target: '.learning-brand', view: 'home' as View },
  { icon: '🧭', title: 'Your website controls', text: 'This sidebar is your map. Home is your dashboard; Learn opens your chapter; Progress and Achievements celebrate how far you’ve come.', target: '.learning-nav button[aria-label="Learn"]', view: 'home' as View },
  { icon: '📚', title: 'Follow your learning path', text: 'The chapter map keeps lessons in order. Finish one activity to unlock the next, and use the map to see what’s ahead.', target: '.chapter-map > div', view: 'learn' as View },
  { icon: '💾', title: 'Your place is saved', text: 'Explore a video, story, practice check, or game. Your answers and lesson spot save as you go, so you can take a break and return later.', target: '.chapter-content > :nth-child(2)', view: 'learn' as View },
  { icon: '🔥', title: 'Try a quick-check question', text: 'Practice checks need 4 correct answers in a row. Choose an answer below, then check it. A wrong answer resets the streak and brings a fresh question.', target: '.chapter-content > :nth-child(2)', view: 'learn' as View, demo: { prompt: 'What can money help people buy?', answers: ['Goods and services', 'Only toys', 'More time in a day'], correct: 0, success: 'That’s it! One correct answer toward a 4-answer streak. Keep going in the real lesson.' } },
  { icon: '🕹️', title: 'Play to learn', text: 'Games are hands-on challenges, not just quizzes. Move items to the right spot or tap a target. Finish a game to earn XP, coins, and a topic badge.', target: '.chapter-content > :nth-child(2)', view: 'learn' as View, demo: { prompt: 'A fresh apple is…', answers: ['📦 Goods basket', '🤝 Services basket'], correct: 0, success: 'Nice sorting! In Goods Dash you’ll sort a whole stream of items, one move at a time.' } },
  { icon: '🏁', title: 'The final challenge', text: 'After the chapter practice and quiz, take the final test: get 10 answers right in a row to pass. Then make a savings goal to finish the chapter.', target: '.chapter-map button:nth-of-type(19)', view: 'learn' as View },
  { icon: '🏆', title: 'See your rewards', text: 'XP and coins add up on your dashboard. Visit Achievements to see badges you’ve earned from lessons, quizzes, and games. You’re ready to explore!', target: '.learning-nav button[aria-label="Achievements"]', view: 'learn' as View },
]
const TOUR_STORAGE_KEY = 'nextgen-first-visit-tour-complete'

const request = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const headers = new Headers(options?.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const token = localStorage.getItem('nextgen-auth-token')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let response: Response
  try {
    response = await fetch(`${apiBase}${path}`, { ...options, headers })
  } catch (error) {
    if (!(error instanceof TypeError)) throw error
    throw new Error(import.meta.env.DEV
      ? 'Could not reach the local API server. Start the app with `npm run dev` to run the frontend and API together.'
      : 'Could not reach the account server. Check your connection and try again.')
  }
  if (!response.ok) {
    if (response.status === 502 && import.meta.env.DEV) {
      throw new ApiError('The local API server is unavailable. Stop the old development server and restart with `npm run dev` from the project root or frontend folder.', 502)
    }
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new ApiError(body.error ?? `Request failed (${response.status}).`, response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function LearningApp() {
  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [view, setView] = useState<View>('home')
  const [selectedActivity, setSelectedActivity] = useState('welcome')
  const [showProfiles, setShowProfiles] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [accountMode, setAccountMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [grade, setGrade] = useState(1)
  const [message, setMessage] = useState('')
  const [tourOpen, setTourOpen] = useState(() => localStorage.getItem(TOUR_STORAGE_KEY) !== 'true')
  const [tourStep, setTourStep] = useState(0)
  const tourContent = firstVisitTour[tourStep]

  const finishTour = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true')
    window.scrollTo(0, 0)
    document.querySelector<HTMLElement>('.chapter-map')?.scrollTo(0, 0)
    setTourOpen(false)
  }
  const advanceTour = () => {
    if (tourStep === firstVisitTour.length - 1) finishTour()
    else {
      const nextStep = tourStep + 1
      if (firstVisitTour[nextStep].target.startsWith('.learning-nav')) {
        window.scrollTo(0, 0)
        document.querySelector<HTMLElement>('.chapter-map')?.scrollTo(0, 0)
      }
      setTourStep(nextStep)
      setView(firstVisitTour[nextStep].view)
    }
  }
  const retreatTour = () => {
    if (tourStep > 0) {
      const previousStep = tourStep - 1
      setTourStep(previousStep)
      setView(firstVisitTour[previousStep].view)
    }
  }

  const loadProfiles = async () => {
    try {
      const token = localStorage.getItem('nextgen-auth-token')
      let accountSession: { account: Account; profiles: ProfileSummary[] } | null = null
      if (token) {
        try {
          accountSession = await request<{ account: Account; profiles: ProfileSummary[] }>('/api/auth/me')
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 401) throw error
          localStorage.removeItem('nextgen-auth-token')
          localStorage.removeItem('nextgen-active-profile')
          setAccount(null)
          setMessage('Your account session ended. Log in again to continue learning.')
        }
      }
      const nextProfiles = accountSession ? accountSession.profiles : await request<ProfileSummary[]>('/api/profiles')
      setAccount(accountSession?.account ?? null)
      setProfiles(nextProfiles)
      const remembered = localStorage.getItem('nextgen-active-profile')
      const active = localStorage.getItem('nextgen-signed-out') === 'true' ? undefined : nextProfiles.find((item) => item.id === remembered) ?? nextProfiles[0]
      if (active) await selectProfile(active.id)
      else { setProfile(null); setAccount(accountSession?.account ?? null) }
    } catch (error) {
      if (localStorage.getItem('nextgen-auth-token')) {
        localStorage.removeItem('nextgen-auth-token')
        setAccount(null)
      }
      setMessage(error instanceof Error ? error.message : 'Could not load learner profiles. Check that the API server is running.')
    }
  }

  const selectProfile = async (id: string) => {
    try {
      const nextProfile = await request<Profile>(`/api/profiles/${id}`)
      const normalizedProfile = { ...nextProfile, learningState: nextProfile.learningState ?? { activeActivity: 'welcome', questionProgress: {}, activityProgress: {} } }
      setProfile(normalizedProfile)
      setSelectedActivity(normalizedProfile.learningState.activeActivity)
      setView('home')
      localStorage.removeItem('nextgen-signed-out')
      localStorage.setItem('nextgen-active-profile', id)
      setShowProfiles(false)
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That profile could not be loaded.')
    }
  }

  const signOut = async () => {
    const hasAccount = Boolean(localStorage.getItem('nextgen-auth-token'))
    let failed = false
    if (hasAccount) {
      try { await request<void>('/api/auth/logout', { method: 'POST' }) }
      catch { failed = true }
    }
    setProfile(null)
    setAccount(null)
    setSelectedActivity('welcome')
    setShowProfiles(false)
    setMessage('You are signed out. Choose a learner profile to log in.')
    localStorage.removeItem('nextgen-active-profile')
    localStorage.removeItem('nextgen-auth-token')
    localStorage.setItem('nextgen-signed-out', 'true')
    if (failed) setMessage('You are signed out on this device, but the server could not revoke the session. Please log in again to continue.')
  }

  useEffect(() => { void loadProfiles() }, [])

  const updateProfile = (nextProfile: Profile) => {
    setProfile({ ...nextProfile, learningState: nextProfile.learningState ?? { activeActivity: 'welcome', questionProgress: {}, activityProgress: {} } })
    setProfiles((current) => current.map((item) => item.id === nextProfile.id ? { id: nextProfile.id, name: nextProfile.name, grade: nextProfile.grade } : item))
  }

  const createProfile = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const nextProfile = await request<Profile>('/api/profiles', { method: 'POST', body: JSON.stringify({ name, grade }) })
      setProfiles((current) => [...current, { id: nextProfile.id, name: nextProfile.name, grade: nextProfile.grade }])
      updateProfile(nextProfile)
      setSelectedActivity('welcome')
      setView('home')
      localStorage.removeItem('nextgen-signed-out')
      localStorage.setItem('nextgen-active-profile', nextProfile.id)
      setName('')
      setShowCreate(false)
      setMessage(`Welcome, ${nextProfile.name}. Your learning space is ready.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create the learner profile.')
    }
  }

  const submitAccount = async (event: FormEvent, mode: 'login' | 'register', values: AccountForm) => {
    event.preventDefault()
    try {
      const result = await request<{ token: string; account: Account; profiles: ProfileSummary[] }>(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(mode === 'login'
          ? { identifier: values.identifier, password: values.password }
          : { username: values.username, email: values.email, password: values.password, name: values.name, grade: values.grade }),
      })
      localStorage.setItem('nextgen-auth-token', result.token)
      localStorage.removeItem('nextgen-signed-out')
      setAccount(result.account)
      setProfiles(result.profiles)
      setShowAccount(false)
      if (result.profiles[0]) await selectProfile(result.profiles[0].id)
      setMessage(mode === 'register' ? `Welcome, ${result.profiles[0]?.name ?? result.account.username}! Your account is ready.` : `Welcome back, ${result.account.username}!`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'We could not access your account. Please try again.')
      throw error
    }
  }

  const saveProfile = async (name: string, grade: number) => {
    if (!profile) return false
    try {
      const nextProfile = await request<Profile>(`/api/profiles/${profile.id}`, { method: 'PATCH', body: JSON.stringify({ name, grade }) })
      updateProfile(nextProfile)
      setMessage('Profile updated.')
      return true
    } catch {
      setMessage('We could not update this profile. Please try again.')
      return false
    }
  }

  const deleteProfile = async () => {
    if (!profile) return
    try {
      await request<{ id: string }>(`/api/profiles/${profile.id}`, { method: 'DELETE' })
      setProfiles((current) => current.filter((item) => item.id !== profile.id))
      setProfile(null)
      setView('home')
      localStorage.removeItem('nextgen-active-profile')
      localStorage.setItem('nextgen-signed-out', 'true')
      setMessage('Profile deleted. Choose another learner or create a new profile.')
    } catch {
      setMessage('We could not delete this profile. Please try again.')
    }
  }

  const completeActivity = async (activity: ActivityProgress) => {
    if (!profile) return false
    try {
      const nextProfile = await request<Profile>(`/api/profiles/${profile.id}/activities/${activity.id}/complete`, { method: 'POST', body: JSON.stringify({ xp: activity.xp, coins: activity.coins, ...(activity.goal ? { goal: activity.goal, plan: activity.plan } : {}), ...(activity.score !== undefined ? { score: activity.score } : {}) }) })
      updateProfile(nextProfile)
      if (activity.score !== undefined) setMessage(activity.score >= 70 ? `Quiz passed with ${activity.score}%. Quiz Master badge earned!` : `Quiz result saved: ${activity.score}%. Review the chapter and try again.`)
      else if (!profile.completedActivities.includes(activity.id)) setMessage(`Nice work! You earned ${activity.xp} XP and ${activity.coins} coins.`)
      return true
    } catch { setMessage('We could not save that activity yet. Your place is saved; try again when you are back online.'); return false }
  }

  const selectActivity = (id: string) => {
    setSelectedActivity(id)
    if (!profile) return
    void request<Profile>(`/api/profiles/${profile.id}/learning-state`, { method: 'PATCH', body: JSON.stringify({ activeActivity: id }) })
      .then(updateProfile)
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not save your place in the chapter.'))
  }

  const saveQuestionProgress = (activityId: string, progress: QuestionProgress) => {
    if (!profile) return
    void request<Profile>(`/api/profiles/${profile.id}/learning-state`, { method: 'PATCH', body: JSON.stringify({ activityId, progress }) })
      .then(updateProfile)
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not save your question progress.'))
  }

  const saveActivityProgress = (activityId: string, activityState: ActivityState) => {
    if (!profile) return
    void request<Profile>(`/api/profiles/${profile.id}/learning-state`, { method: 'PATCH', body: JSON.stringify({ activityId, activityState }) })
      .then(updateProfile)
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not save your activity progress.'))
  }

  const completed = profile?.completedActivities.length ?? 0
  const progress = Math.round((completed / 20) * 100)
  const firstName = profile?.name.split(' ')[0] ?? 'Learner'
  const startLearning = () => setView('learn')

  return <div className="learning-app">
    <aside className="learning-sidebar">
      <div className={`learning-brand ${tourOpen && tourStep === 0 ? 'tour-target' : ''}`}><img src="/logo.png" alt="" /><span className="learning-brand-name">NextGen <b>Finance</b></span></div>
      <button className="profile-switcher" onClick={() => setShowProfiles(true)}>
        <strong>{profile ? profile.name : 'Log in to a profile'}</strong>
        <small>{profile ? `Grade ${profile.grade}` : 'Profile required'}</small><i>⌄</i>
      </button>
      <nav className={`learning-nav ${tourOpen && tourStep >= 1 && tourStep <= 3 ? 'tour-target' : ''}`} aria-label="Learning navigation">
        {([['home', 'Home', '⌂'], ['learn', 'Learn', '▤'], ['progress', 'Progress', '◔'], ['achievements', 'Achievements', '★'], ['parent', 'For parents', '◇'], ['about', 'About us', '♡'], ['profile', 'Profile', '○']] as [View, string, string][]).map(([id, label, icon]) => <button className={view === id ? 'active' : ''} onClick={() => setView(id)} disabled={id !== 'about' && !profile} key={id} title={label} aria-label={label}><span aria-hidden="true">{icon}</span>{label}</button>)}
      </nav>
      <div className={`sidebar-course ${tourOpen && tourStep === 4 ? 'tour-target' : ''}`}><span>GRADE {profile?.grade ?? 1}</span><strong>Money basics</strong><p>{completed} of 20 activities complete</p><div><i style={{ width: `${progress}%` }} /></div></div>
    </aside>
    <main className="learning-main">
      <header className="learning-topbar"><div><span>{viewTitles[view].eyebrow}</span><strong>{viewTitles[view].title}</strong></div><div className="topbar-actions">{account ? <button className="account-button" onClick={() => setView('profile')}>@{account.username}</button> : <button className="account-button" onClick={() => { setAccountMode('login'); setShowAccount(true) }}>Log in / Create account</button>}</div></header>
      {message && <div className="notice" role="status">{message}<button onClick={() => setMessage('')} aria-label="Dismiss notification">×</button></div>}
      {!profile && view !== 'about' && <section className="empty-state"><span>◎</span><h1>Welcome to NextGen Finance</h1><p>Create an account with an email, username, and password to save your learning progress and log in from any device. You can also choose a local learner profile.</p><div className="empty-actions"><button onClick={() => { setAccountMode('register'); setShowAccount(true) }}>Create an account</button><button className="secondary-action" onClick={() => { setAccountMode('login'); setShowAccount(true) }}>Log in</button><button className="secondary-action" onClick={() => setShowProfiles(true)}>Choose a learner</button></div></section>}
      {view === 'about' && <About onExplore={() => {
        if (profile) setView('learn')
        else { setAccountMode('register'); setShowAccount(true) }
      }} />}
      {profile && view === 'home' && <Home firstName={firstName} progress={progress} completed={completed} xp={profile.xp} coins={profile.coins} completedActivities={profile.completedActivities} started={completed > 0 || profile.learningState.activeActivity !== 'welcome'} onLearn={startLearning} />}
      {profile && view === 'learn' && <ChapterOne key={profile.id} learnerName={firstName} completed={profile.completedActivities} xp={profile.xp} coins={profile.coins} savingsGoal={profile.savingsGoal} selectedActivity={selectedActivity} learningState={profile.learningState} onSelectActivity={selectActivity} onComplete={completeActivity} onSaveQuestionProgress={saveQuestionProgress} onSaveActivityProgress={saveActivityProgress} />}
      {profile && view === 'progress' && <Progress progress={progress} profile={profile} />}
      {profile && view === 'achievements' && <Achievements profile={profile} />}
      {profile && view === 'parent' && <Parent profile={profile} progress={progress} />}
      {profile && view === 'profile' && <ProfilePage profile={profile} account={account} profiles={profiles} progress={progress} onSave={saveProfile} onChooseProfile={() => setShowProfiles(true)} onCreateProfile={() => setShowCreate(true)} onLogout={signOut} onDelete={deleteProfile} />}
    </main>
    {showProfiles && <ProfileDialog profiles={profiles} activeId={profile?.id} onClose={() => setShowProfiles(false)} onSelect={selectProfile} onCreate={() => { setShowProfiles(false); setShowCreate(true) }} onLogout={signOut} />}
    {showCreate && <CreateDialog name={name} grade={grade} onName={setName} onGrade={setGrade} onClose={() => setShowCreate(false)} onSubmit={createProfile} />}
    {showAccount && <AccountDialog mode={accountMode} onMode={setAccountMode} onClose={() => setShowAccount(false)} onSubmit={submitAccount} />}
    {tourOpen && <TourDialog key={tourStep} step={tourStep} total={firstVisitTour.length} content={tourContent} onNext={advanceTour} onBack={retreatTour} onSkip={finishTour} />}
  </div>
}

function TourDialog({ step, total, content, onNext, onBack, onSkip }: { step: number; total: number; content: { icon: string; title: string; text: string; target: string; view: View; demo?: { prompt: string; answers: string[]; correct: number; success: string } }; onNext: () => void; onBack: () => void; onSkip: () => void }) {
  const cardRef = useRef<HTMLElement>(null)
  const [spotlight, setSpotlight] = useState<{ top: number; left: number; right: number; bottom: number; cardTop: number; cardLeft: number; placement: 'right' | 'left' | 'below' | 'above' } | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)
  const isDemoCorrect = selectedAnswer === content.demo?.correct
  useEffect(() => {
    let didRevealTarget = false
    const measure = () => {
      const target = document.querySelector<HTMLElement>(content.target) ?? document.querySelector<HTMLElement>('.learning-main')
      if (!target) return
      const initialBounds = target.getBoundingClientRect()
      if (!didRevealTarget && (initialBounds.top < 0 || initialBounds.bottom > window.innerHeight)) {
        didRevealTarget = true
        target.scrollIntoView({ block: 'center', behavior: 'auto' })
      }
      const bounds = target.getBoundingClientRect()
      const padding = 9
      const top = Math.max(8, bounds.top - padding)
      const left = Math.max(8, bounds.left - padding)
      const right = Math.min(window.innerWidth - 8, bounds.right + padding)
      const bottom = Math.min(window.innerHeight - 8, bounds.bottom + padding)
      const card = cardRef.current?.getBoundingClientRect()
      const cardWidth = card?.width ?? Math.min(420, window.innerWidth - 32)
      const cardHeight = card?.height ?? 380
      const gap = 18
      let placement: 'right' | 'left' | 'below' | 'above' = 'right'
      let cardLeft = right + gap
      let cardTop = Math.max(16, Math.min(window.innerHeight - cardHeight - 16, top + 10))
      if (cardLeft + cardWidth > window.innerWidth - 12) {
        placement = 'left'
        cardLeft = left - cardWidth - gap
      }
      if (cardLeft < 12) {
        placement = bottom + cardHeight + gap <= window.innerHeight ? 'below' : 'above'
        cardLeft = Math.max(12, Math.min(window.innerWidth - cardWidth - 12, left + (right - left) / 2 - cardWidth / 2))
        cardTop = placement === 'below' ? bottom + gap : Math.max(12, top - cardHeight - gap)
      }
      setSpotlight({ top, left, right, bottom, cardTop, cardLeft, placement })
    }
    const frame = window.requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [content.target])

  return <div className="tour-stage">
    {spotlight && <>
      <div className="tour-shade tour-shade-top" style={{ height: spotlight.top }} />
      <div className="tour-shade tour-shade-left" style={{ top: spotlight.top, left: 0, width: spotlight.left, height: spotlight.bottom - spotlight.top }} />
      <div className="tour-shade tour-shade-right" style={{ top: spotlight.top, left: spotlight.right, right: 0, height: spotlight.bottom - spotlight.top }} />
      <div className="tour-shade tour-shade-bottom" style={{ top: spotlight.bottom, bottom: 0 }} />
      <div className="tour-spotlight" style={{ top: spotlight.top, left: spotlight.left, width: spotlight.right - spotlight.left, height: spotlight.bottom - spotlight.top }} />
    </>}
    <section ref={cardRef} className={`tour-card tour-card-${spotlight?.placement ?? 'below'}`} style={spotlight ? { top: spotlight.cardTop, left: spotlight.cardLeft } : undefined} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-description">
      <button className="tour-skip" onClick={onSkip}>Skip tour</button>
      <div className="tour-step-count">YOUR QUICK TOUR <span>{step + 1} / {total}</span></div>
      <div className="tour-progress" aria-label={`Step ${step + 1} of ${total}`}><i style={{ width: `${((step + 1) / total) * 100}%` }} /></div>
      <div className="tour-icon" aria-hidden="true">{content.icon}</div>
      <h2 id="tour-title">{content.title}</h2>
      <p id="tour-description">{content.text}</p>
      {content.demo && <div className="tour-demo">
        <strong>{content.demo.prompt}</strong>
        <div>{content.demo.answers.map((answer, index) => <button key={answer} aria-pressed={selectedAnswer === index} className={selectedAnswer === index ? 'selected' : ''} onClick={() => { setSelectedAnswer(index); setChecked(false) }}><span>{String.fromCharCode(65 + index)}</span>{answer}</button>)}</div>
        {checked && <p className={isDemoCorrect ? 'tour-demo-success' : 'tour-demo-retry'} role="status">{isDemoCorrect ? content.demo.success : 'Not quite—try another choice!'}</p>}
        <button className="tour-demo-check" disabled={selectedAnswer === null || checked && isDemoCorrect} onClick={() => setChecked(true)}>{checked && isDemoCorrect ? 'Nice work! ✓' : 'Check my choice'}</button>
      </div>}
      <div className="tour-actions">
        {step > 0 && <button className="tour-back-button" onClick={onBack}>← Back</button>}
        <button className="tour-next-button" disabled={Boolean(content.demo && !(checked && isDemoCorrect))} onClick={onNext}>{step === total - 1 ? 'Let’s go!' : content.demo ? 'Keep going' : 'Next'} <span aria-hidden="true">→</span></button>
      </div>
    </section>
  </div>
}

function Home({ firstName, progress, completed, xp, coins, completedActivities, started, onLearn }: { firstName: string; progress: number; completed: number; xp: number; coins: number; completedActivities: string[]; started: boolean; onLearn: () => void }) {
  const nextLesson = homeLessons.find((lesson) => !completedActivities.includes(lesson.id))
  const featuredLesson = nextLesson ?? homeLessons[homeLessons.length - 1]
  return <div className="screen"><section className="welcome"><div><p>YOUR PERSONAL LEARNING SPACE</p><h1>Good morning, {firstName}.</h1><h2>What will you learn today?</h2><button onClick={onLearn}>{started ? 'Keep Learning!' : 'Start Chapter 1'} <span>→</span></button></div><div className="welcome-art"><b>$</b><i>+</i><em>1</em></div></section><section className="quick-stats"><div><strong>{progress}%</strong><span>Course progress</span></div><div><strong>{completed}</strong><span>Activities finished</span></div><div><strong>{xp}</strong><span>XP earned</span></div><div><strong>{coins}</strong><span>Coins collected</span></div></section><section className="section-title"><div><p>KEEP GOING</p><h2>{nextLesson ? 'Your next lesson' : 'Chapter highlights'}</h2></div><button onClick={onLearn}>View course →</button></section><article className="next-lesson"><span className="lesson-number">{nextLesson ? homeLessons.indexOf(featuredLesson) + 1 : '✓'}</span><div><small>{featuredLesson.type} · {featuredLesson.time}</small><h2>{featuredLesson.title}</h2><p>{featuredLesson.summary}</p></div><button onClick={onLearn}>{nextLesson ? 'Keep learning' : 'Review project'} →</button></article><section className="section-title"><div><p>YOUR COURSE</p><h2>Money basics</h2></div></section><div className="lesson-grid">{homeLessons.map((lesson, index) => <button className="lesson-card" key={lesson.id} onClick={onLearn}><span>{completedActivities.includes(lesson.id) ? '✓' : index + 1}</span><small>{lesson.type}</small><strong>{lesson.title}</strong><p>{lesson.time}</p></button>)}</div></div>
}

function About({ onExplore }: { onExplore: () => void }) {
  return <div className="screen about-screen">
    <section className="about-hero">
      <div className="about-hero-copy">
        <p className="about-eyebrow">YOUTH-LED · BUILT FOR REAL LIFE</p>
        <h1>Big money confidence starts with small steps.</h1>
        <p>NextGen Finance helps children build strong money habits early through engaging, interactive, and personalized lessons.</p>
        <button className="about-primary" onClick={onExplore}>Explore the learning path <span aria-hidden="true">→</span></button>
      </div>
      <div className="about-hero-art" aria-hidden="true"><span>✦</span><strong>$</strong><i>Learn<br />a little</i></div>
    </section>

    <section className="about-founders" aria-labelledby="about-founders-title">
      <div className="about-section-heading"><p>THE PEOPLE BEHIND THE IDEA</p><h2 id="about-founders-title">Meet our founders</h2></div>
      <article className="about-founder-card">
        <span className="about-founder-mark" aria-hidden="true">N</span>
        <div><h3>Srinath Parthiban &amp; Shubhangi Heda</h3><p>NextGen Finance is a youth-led financial literacy program founded by Srinath Parthiban and Shubhangi Heda. They share a belief that learning about money should feel approachable, useful, and relevant to young people.</p></div>
      </article>
    </section>

    <section className="about-purpose" aria-label="Our mission and goal">
      <article className="about-purpose-card about-mission"><span aria-hidden="true">✦</span><p>OUR MISSION</p><h2>Build strong money habits early.</h2><p>We make financial learning engaging, interactive, and personal so children can practice useful ideas as they grow.</p></article>
      <article className="about-purpose-card about-goal"><span aria-hidden="true">◎</span><p>OUR GOAL</p><h2>Prepare young people for what’s next.</h2><p>We want to help create a generation of financially confident, responsible, and informed young leaders.</p></article>
    </section>

    <section className="about-approach" id="about-approach">
      <div className="about-section-heading"><p>MADE TO MAKE SENSE</p><h2>Learning that feels like real life</h2><span>Money skills grow through curiosity, practice, and conversations.</span></div>
      <div className="about-approach-grid">
        <article><span aria-hidden="true">01</span><h3>Start with everyday ideas</h3><p>Explore topics like money, goods and services, needs and wants, and saving through clear, age-aware lessons.</p></article>
        <article><span aria-hidden="true">02</span><h3>Learn by doing</h3><p>Interactive questions and games let learners try ideas, see explanations, and build understanding one step at a time.</p></article>
        <article><span aria-hidden="true">03</span><h3>Celebrate steady progress</h3><p>Saved learning progress helps learners pick up where they left off, while XP and rewards make effort feel worth celebrating.</p></article>
      </div>
    </section>

    <section className="about-family">
      <div><p className="about-eyebrow">LEARN TOGETHER</p><h2>Good money conversations can start anywhere.</h2><p>Families and caregivers can use the topics in each lesson to keep talking about everyday choices, goals, and the habits that matter to them.</p></div>
      <button onClick={onExplore}>Take a look around <span aria-hidden="true">→</span></button>
    </section>
  </div>
}

export function Learn({ profile, lesson, selectedLesson, onSelectLesson, onComplete, onSave, onQuiz }: { profile: Profile; lesson: typeof lessons[number]; selectedLesson: number; onSelectLesson: (id: number) => void; onComplete: (id: number) => void; onSave: (id: number) => void; onQuiz: () => void }) {
  const done = profile.completedLessons.includes(selectedLesson)
  const saved = profile.savedLessons.includes(selectedLesson)
  const unlockedQuiz = profile.completedLessons.length === lessons.length
  return <div className="screen learn-screen"><div className="unit-header"><div><p>GRADE {profile.grade} · UNIT 1</p><h1>Money basics</h1><span>Build a strong relationship with money, one small choice at a time.</span></div><strong>{profile.completedLessons.length} / {lessons.length}<small> lessons</small></strong></div><div className="course-layout"><aside className="unit-list"><p>UNIT LESSONS</p>{lessons.map((item) => <button key={item.id} className={item.id === selectedLesson ? 'active' : ''} onClick={() => onSelectLesson(item.id)}><span>{profile.completedLessons.includes(item.id) ? '✓' : item.id}</span><div><strong>{item.title}</strong><small>{item.type} · {item.time}</small></div></button>)}<button className="quiz-link" disabled={!unlockedQuiz} onClick={onQuiz}><span>★</span><div><strong>Unit quiz</strong><small>{unlockedQuiz ? 'Ready to take' : 'Complete all lessons to unlock'}</small></div></button></aside><article className="lesson-panel"><div className="lesson-panel-top"><span>{lesson.type.toUpperCase()} · {lesson.time}</span><button onClick={() => onSave(lesson.id)}>{saved ? '★ Saved' : '☆ Save'}</button></div><h2>{lesson.title}</h2><p className="lesson-summary">{lesson.summary}</p><div className="learning-visual"><span>$</span><span>?</span><span>$</span></div><div className="activity"><small>TRY IT</small><h3>{lesson.activity}</h3><p>Think about a real choice you could make today. Small practice builds powerful habits.</p></div><div className="lesson-controls"><button className="quiet-button" onClick={() => onSave(lesson.id)}>{saved ? 'Remove saved lesson' : 'Save for later'}</button><button className="complete-button" onClick={() => onComplete(lesson.id)}>{done ? 'Completed ✓' : 'Mark complete'} <span>→</span></button></div></article></div></div>
}

function Progress({ progress, profile }: { progress: number; profile: Profile }) { return <div className="screen"><section className="page-heading"><p>YOUR LEARNING DATA</p><h1>Progress that belongs to you.</h1><span>See every completed lesson, saved resource, and assessment in one place.</span></section><div className="progress-overview"><div className="progress-circle"><strong>{progress}%</strong><span>complete</span></div><div><p>GRADE {profile.grade} · MONEY BASICS</p><h2>{progress === 100 ? 'You completed the unit.' : 'You are building momentum.'}</h2><div className="bar"><i style={{ width: `${progress}%` }} /></div><span>{profile.completedActivities.length} of 20 chapter activities complete</span></div></div><section className="detail-grid"><div><h2>Completed activities</h2>{profile.completedActivities.length ? profile.completedActivities.map((activity) => <p key={activity}><b>✓</b>{activity.replace(/-/g, ' ')}</p>) : <p className="muted">Your completed activities will appear here.</p>}</div><div><h2>Saved for later</h2>{profile.savedLessons.length ? profile.savedLessons.map((id) => <p key={id}><b>★</b>{lessons.find((lesson) => lesson.id === id)?.title}</p>) : <p className="muted">No saved lessons yet.</p>}</div><div><h2>Quiz results</h2>{profile.quizResults.length ? profile.quizResults.map((result, index) => <p key={index}><b>{result.passed ? '✓' : '○'}</b>{result.score}% score</p>) : <p className="muted">Your results will appear here.</p>}</div></section></div> }

function Achievements({ profile }: { profile: Profile }) { const badges = [{ name: 'Lesson Starter', note: 'Finish your first lesson.' }, { name: 'Barter Market Champion', note: 'Clear the Barter Market arcade game.' }, { name: 'Goods Dash Champion', note: 'Sort every item in Goods Dash.' }, { name: 'Needs & Wants Hero', note: 'Help Penny make thoughtful choices.' }, { name: 'Quiz Master', note: 'Pass a unit quiz.' }, { name: 'Money Explorer', note: 'Complete Money basics.' }, { name: 'Savings Planner', note: 'Create a savings goal.' }]; return <div className="screen"><section className="page-heading"><p>ACHIEVEMENTS</p><h1>Celebrate your effort.</h1><span>Every badge marks a skill you have practiced.</span></section><div className="badge-grid">{badges.map((badge) => { const earned = profile.badges.includes(badge.name); return <article className={earned ? 'achievement earned' : 'achievement'} key={badge.name}><span>{earned ? '★' : '◇'}</span><h2>{badge.name}</h2><p>{badge.note}</p><small>{earned ? 'Earned' : 'Keep learning'}</small></article> })}</div></div> }

function ProfilePage({ profile, account, profiles, progress, onSave, onChooseProfile, onCreateProfile, onLogout, onDelete }: { profile: Profile; account: Account | null; profiles: ProfileSummary[]; progress: number; onSave: (name: string, grade: number) => Promise<boolean>; onChooseProfile: () => void; onCreateProfile: () => void; onLogout: () => void; onDelete: () => Promise<void> }) {
  const [name, setName] = useState(profile.name)
  const [grade, setGrade] = useState(profile.grade)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const unchanged = name.trim() === profile.name && grade === profile.grade

  useEffect(() => { setName(profile.name); setGrade(profile.grade) }, [profile.id, profile.name, profile.grade])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    await onSave(name.trim(), grade)
    setSaving(false)
  }

  return <div className="screen profile-screen">
    <section className="page-heading"><p>YOUR ACCOUNT</p><h1>Profile & settings</h1><span>Manage learner details, keep track of progress, and switch accounts.</span></section>
    <section className="profile-hero"><div className="profile-avatar">{profile.name.trim()[0]?.toUpperCase() ?? 'L'}</div><div className="profile-hero-copy"><span>LEARNER PROFILE</span><h2>{profile.name}</h2><p>Grade {profile.grade} · Member since {new Date(profile.joinedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p></div><button onClick={onChooseProfile}>Switch learner</button></section>
    <section className="profile-stats" aria-label="Learning totals"><div><strong>{progress}%</strong><span>Course progress</span></div><div><strong>{profile.completedActivities.length}</strong><span>Activities complete</span></div><div><strong>{profile.xp}</strong><span>XP earned</span></div><div><strong>{profile.coins}</strong><span>Coins collected</span></div><div><strong>{profile.badges.length}</strong><span>Badges earned</span></div><div><strong>{profile.quizResults.length}</strong><span>Quiz attempts</span></div></section>
    <div className="profile-columns">
      <form className="profile-section profile-edit" onSubmit={submit}><div className="profile-section-heading"><div><span>PERSONAL DETAILS</span><h2>Learner information</h2></div></div>{account && <><div className="profile-record-row"><span>Username</span><strong>@{account.username}</strong></div><div className="profile-record-row"><span>Email</span><strong>{account.email}</strong></div></>}<label>Display name<input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} required /></label><label>Grade<select value={grade} onChange={(event) => setGrade(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Grade {index + 1}</option>)}</select></label><button className="profile-primary" type="submit" disabled={saving || unchanged}>{saving ? 'Saving...' : 'Save changes'}</button></form>
      <section className="profile-section profile-learning"><div className="profile-section-heading"><div><span>LEARNING RECORD</span><h2>Your activity</h2></div><b>{profile.completedActivities.length} / 20</b></div><div className="profile-progress-track"><i style={{ width: `${progress}%` }} /></div><div className="profile-record-row"><span>Saved lessons</span><strong>{profile.savedLessons.length}</strong></div><div className="profile-record-row"><span>Quiz results</span><strong>{profile.quizResults.length ? `${profile.quizResults.length} attempts · ${Math.round(profile.quizResults.reduce((total, result) => total + result.score, 0) / profile.quizResults.length)}% avg.` : 'No attempts yet'}</strong></div><div className="profile-record-row"><span>Achievements</span><strong>{profile.badges.length ? profile.badges.join(', ') : 'None yet'}</strong></div>{profile.savingsGoal && <div className="profile-goal"><span>SAVINGS GOAL</span><strong>{profile.savingsGoal.goal}</strong><p>{profile.savingsGoal.plan}</p></div>}</section>
    </div>
    <section className="profile-section profile-accounts"><div className="profile-section-heading"><div><span>ACCOUNT MANAGEMENT</span><h2>Learner accounts</h2></div><b>{profiles.length} {profiles.length === 1 ? 'profile' : 'profiles'}</b></div><p>Each learner has a separate learning history and saved progress.</p><div className="profile-account-actions"><button onClick={onChooseProfile}>Switch learner</button><button onClick={onCreateProfile}>Create profile</button><button className="profile-logout" onClick={onLogout}>Log out</button></div></section>
    <section className="profile-section profile-danger"><div><span>REMOVE LEARNER</span><h2>Delete this profile</h2><p>This permanently removes {profile.name}'s learning history, rewards, and saved information.</p></div>{confirmDelete ? <div className="profile-confirm"><strong>Delete {profile.name}'s profile permanently?</strong><button onClick={() => setConfirmDelete(false)}>Cancel</button><button className="profile-delete" onClick={() => void onDelete()}>Delete profile</button></div> : <button className="profile-delete" onClick={() => setConfirmDelete(true)}>Delete profile</button>}</section>
  </div>
}

function Parent({ profile, progress }: { profile: Profile; progress: number }) {
  const [discussed, setDiscussed] = useState<string[]>([])
  const support = [
    ['Ask what they learned', 'Invite your child to explain one new money idea in their own words.'],
    ['Use real-life examples', 'Talk about needs, wants, goods, and services during everyday choices.'],
    ['Encourage steady practice', 'A short lesson together is more useful than a long lecture.'],
    ['Celebrate progress', 'Notice effort, thoughtful choices, and lessons completed.'],
  ]
  const prompts = ['What did you learn today?', 'What surprised you?', 'How could you use this in real life?']
  const toggleDiscussed = (question: string) => setDiscussed((current) => current.includes(question) ? current.filter((item) => item !== question) : [...current, question])
  return <div className="screen parent-guide">
    <section className="parent-hero"><p>FOR PARENTS AND GUARDIANS</p><h1>Support {profile.name}'s learning.</h1><span>Financial literacy is an important life skill. You do not need to be a finance expert; curiosity and everyday conversations go a long way.</span></section>
    <section className="parent-data" aria-label="Learner overview"><div><strong>{progress}%</strong><span>Chapter progress</span></div><div><strong>{profile.completedActivities.length} / 20</strong><span>Activities complete</span></div><div><strong>{profile.quizResults.length}</strong><span>Assessments taken</span></div></section>
    {profile.savingsGoal && <section className="parent-savings"><span>Current savings goal</span><strong>{profile.savingsGoal.goal}</strong><p>{profile.savingsGoal.plan}</p></section>}
    <section className="parent-support"><div className="section-title"><div><p>A LITTLE SUPPORT GOES A LONG WAY</p><h2>Ways to help</h2></div></div><div className="parent-support-grid">{support.map(([title, detail], index) => <article className="parent-support-card" key={title}><span>{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></article>)}</div></section>
    <section className="family-prompts"><div><p>TRY ONE TOGETHER</p><h2>Conversation starters</h2><span>{discussed.length} of {prompts.length} discussed</span></div>{prompts.map((question) => { const done = discussed.includes(question); return <div className={`parent-prompt ${done ? 'discussed' : ''}`} key={question}><p>“{question}”</p><button onClick={() => toggleDiscussed(question)} aria-pressed={done}>{done ? 'Discussed ✓' : 'Mark discussed'}</button></div> })}</section>
  </div>
}

function ProfileDialog({ profiles, activeId, onClose, onSelect, onCreate, onLogout }: { profiles: ProfileSummary[]; activeId?: string; onClose: () => void; onSelect: (id: string) => void; onCreate: () => void; onLogout: () => void }) { return <div className="dialog-backdrop"><section className="dialog"><button className="close-dialog" onClick={onClose} aria-label="Close profile chooser">×</button><p>LEARNER PROFILES</p><h2>{activeId ? 'Switch learner' : 'Log in to a learner profile'}</h2><div className="profile-list">{profiles.map((item) => <button className={item.id === activeId ? 'selected' : ''} key={item.id} onClick={() => onSelect(item.id)}><span>{item.name[0]}</span><div><strong>{item.name}</strong><small>Grade {item.grade}</small></div>{item.id === activeId && <b>✓</b>}</button>)}</div>{activeId && <button className="logout-button" onClick={onLogout}>Log out of {profiles.find((item) => item.id === activeId)?.name}</button>}<button className="create-profile-button" onClick={onCreate}>+ Create a learner profile</button></section></div> }

function CreateDialog({ name, grade, onName, onGrade, onClose, onSubmit }: { name: string; grade: number; onName: (value: string) => void; onGrade: (value: number) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) { return <div className="dialog-backdrop"><form className="dialog create-dialog" onSubmit={onSubmit}><button type="button" className="close-dialog" onClick={onClose}>×</button><p>NEW LEARNER</p><h2>Make a personal learning space</h2><label>Name<input value={name} maxLength={40} onChange={(event) => onName(event.target.value)} placeholder="Learner's name" autoFocus /></label><label>Grade<select value={grade} onChange={(event) => onGrade(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Grade {index + 1}</option>)}</select></label><button className="create-profile-button" type="submit">Create profile →</button></form></div> }

function AccountDialog({ mode, onMode, onClose, onSubmit }: { mode: 'login' | 'register'; onMode: (mode: 'login' | 'register') => void; onClose: () => void; onSubmit: (event: FormEvent, mode: 'login' | 'register', values: AccountForm) => Promise<void> }) {
  const [identifier, setIdentifier] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [grade, setGrade] = useState(1)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const submit = async (event: FormEvent) => {
    setBusy(true)
    setError('')
    try {
      await onSubmit(event, mode, { identifier, username, email, password, name, grade })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'We could not access your account.')
    } finally {
      setBusy(false)
    }
  }
  return <div className="dialog-backdrop"><form className="dialog create-dialog account-dialog" onSubmit={(event) => void submit(event)}>
    <button type="button" className="close-dialog" onClick={onClose} aria-label="Close account dialog">×</button>
    <p>YOUR NEXTGEN ACCOUNT</p><h2>{mode === 'register' ? 'Create your account' : 'Welcome back'}</h2>
    <span className="account-promise">Your email and password let you continue learning on another device.</span>
    {mode === 'register' ? <>
      <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={24} pattern="[A-Za-z0-9._\-]+" autoComplete="username" required /></label>
      <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
      <label>Password<div className="password-input-wrap"><input aria-label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} autoComplete="new-password" required /><button className="password-visibility-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
      <label>Learner name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} autoComplete="name" required /></label>
      <label>Grade<select value={grade} onChange={(event) => setGrade(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Grade {index + 1}</option>)}</select></label>
    </> : <>
      <label>Email or username<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" required /></label>
      <label>Password<div className="password-input-wrap"><input aria-label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /><button className="password-visibility-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
    </>}
    {error && <p className="account-error" role="alert">{error}</p>}
    <button className="create-profile-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create account →' : 'Log in →'}</button>
    <button type="button" className="account-mode-toggle" onClick={() => { setError(''); onMode(mode === 'register' ? 'login' : 'register') }}>{mode === 'register' ? 'Already have an account? Log in' : 'New here? Create an account'}</button>
  </form></div>
}

export default LearningApp