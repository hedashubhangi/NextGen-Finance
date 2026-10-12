import cors from 'cors'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { getStore } from '@netlify/blobs'

const workingDirectory = process.cwd()
const __dirname = path.basename(workingDirectory) === 'backend' ? workingDirectory : path.join(workingDirectory, 'backend')
const dataPath = process.env.DATA_FILE || path.join(__dirname, 'data.json')
const blobStore = process.env.NETLIFY === 'true' ? getStore('nextgen-finance-data') : null
const blobKey = 'app-data.json'
const app = express()
const port = Number(process.env.PORT || 3001)
const chapterActivityIds = ['welcome', 'vocabulary', 'video-1', 'check-1', 'article-1', 'barter', 'video-2', 'check-2', 'article-2', 'sort', 'video-3', 'check-3', 'practice-money', 'practice-goods', 'practice-needs', 'needs-game', 'review', 'chapter-quiz', 'chapter-test', 'final-project']
const chapterNavigationIds = [...chapterActivityIds, 'completion']
const gameBadges = { barter: 'Barter Market Champion', sort: 'Goods Dash Champion', 'needs-game': 'Needs & Wants Hero' }
const nonNegativeNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

app.use(cors())
app.use(express.json())

let mutationQueue = Promise.resolve()
app.use(async (request, response, next) => {
  if (!['POST', 'PATCH', 'DELETE'].includes(request.method) || !request.path.startsWith('/api/')) return next()
  const previousMutation = mutationQueue
  let releaseMutation
  mutationQueue = new Promise((resolve) => { releaseMutation = resolve })
  await previousMutation
  let released = false
  const release = () => {
    if (released) return
    released = true
    releaseMutation()
  }
  response.once('finish', release)
  response.once('close', release)
  next()
})

const createProfile = ({ id, name, grade }) => ({
  id,
  name,
  grade,
  joinedAt: new Date().toISOString(),
  completedLessons: [],
  quizResults: [],
  badges: [],
  savedLessons: [],
  completedActivities: [],
  xp: 0,
  coins: 0,
  savingsGoal: null,
  learningState: { activeActivity: 'welcome', questionProgress: {}, activityProgress: {} },
})

const readData = async () => {
  const data = blobStore
    ? await blobStore.get(blobKey, { type: 'json' }) ?? { accounts: [], sessions: [], profiles: [] }
    : JSON.parse(await fs.readFile(dataPath, 'utf8'))
  data.accounts = Array.isArray(data.accounts) ? data.accounts : []
  data.sessions = Array.isArray(data.sessions) ? data.sessions : []
  if (Array.isArray(data.profiles)) {
    let changed = false
    data.profiles.forEach((profile) => {
      const original = JSON.stringify(profile)
      profile.completedActivities = Array.isArray(profile.completedActivities) ? [...new Set(profile.completedActivities.filter((id) => chapterActivityIds.includes(id)))] : []
      profile.completedLessons = Array.isArray(profile.completedLessons) ? profile.completedLessons : []
      profile.quizResults = Array.isArray(profile.quizResults) ? profile.quizResults : []
      profile.badges = Array.isArray(profile.badges) ? profile.badges : []
      profile.xp = nonNegativeNumber(profile.xp)
      profile.coins = nonNegativeNumber(profile.coins)
      profile.savedLessons = Array.isArray(profile.savedLessons) ? profile.savedLessons : []
      profile.savingsGoal ??= null
      profile.learningState ??= { activeActivity: 'welcome', questionProgress: {}, activityProgress: {} }
      profile.learningState.activeActivity = chapterNavigationIds.includes(profile.learningState.activeActivity) ? profile.learningState.activeActivity : 'welcome'
      profile.learningState.questionProgress = profile.learningState.questionProgress && typeof profile.learningState.questionProgress === 'object' ? profile.learningState.questionProgress : {}
      profile.learningState.activityProgress = profile.learningState.activityProgress && typeof profile.learningState.activityProgress === 'object' ? profile.learningState.activityProgress : {}
      if (JSON.stringify(profile) !== original) changed = true
    })
    if (changed) await writeData(data)
    return data
  }
  return {
    accounts: [],
    sessions: [],
    profiles: [{
      ...createProfile(data.student),
      completedLessons: data.completedLessons ?? [],
      quizResults: data.quizResults ?? [],
      badges: data.badges ?? [],
    }],
  }
}
const writeData = async (data) => {
  if (blobStore) {
    await blobStore.setJSON(blobKey, data)
    return
  }
  const temporaryPath = `${dataPath}.${randomBytes(8).toString('hex')}.tmp`
  await fs.writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`)
  await fs.rename(temporaryPath, dataPath)
}
const findProfile = (data, id) => data.profiles.find((profile) => profile.id === id)
const profileSummary = ({ id, name, grade }) => ({ id, name, grade })
const publicAccount = ({ id, username, email }) => ({ id, username, email })
const hashToken = (token) => createHash('sha256').update(token).digest('hex')
const sessionFor = (data, token) => token ? data.sessions.find((session) => session.tokenHash === hashToken(token)) : undefined
const accountFromRequest = (data, request) => {
  const authorization = request.get('authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return undefined
  const session = sessionFor(data, authorization.slice(7))
  return session ? data.accounts.find((account) => account.id === session.accountId) : undefined
}

app.use('/api/profiles/:profileId', async (request, response, next) => {
  try {
    const data = await readData()
    const profile = findProfile(data, request.params.profileId)
    if (!profile) return response.status(404).json({ error: 'Profile not found.' })
    const authorization = request.get('authorization') ?? ''
    const account = accountFromRequest(data, request)
    if (authorization.startsWith('Bearer ') && !account) return response.status(401).json({ error: 'Please log in again.' })
    if (profile.accountId ? profile.accountId !== account?.id : Boolean(account)) return response.status(403).json({ error: 'You cannot access this learner profile.' })
    next()
  } catch {
    response.status(500).json({ error: 'Could not verify profile access.' })
  }
})

app.get('/', (_request, response) => {
  response.status(200).json({
    message: 'NextGen Finance API is running.',
    frontend: 'http://localhost:5173',
    routes: ['/api/health', '/api/progress', '/api/progress/lessons/:lessonId/complete', '/api/progress/quiz'],
  })
})
app.get('/favicon.ico', (_request, response) => response.status(204).end())
app.get('/api/health', (_request, response) => response.json({ ok: true, service: 'nextgen-finance-api' }))
app.get('/api/profiles', async (_request, response) => {
  try {
    const data = await readData()
    const authorization = _request.get('authorization') ?? ''
    const account = accountFromRequest(data, _request)
    if (authorization.startsWith('Bearer ') && !account) return response.status(401).json({ error: 'Please log in again.' })
    response.json(data.profiles.filter((profile) => account ? profile.accountId === account.id : !profile.accountId).map(profileSummary))
  } catch {
    response.status(500).json({ error: 'Could not load profiles.' })
  }
})
app.post('/api/auth/register', async (request, response) => {
  const username = String(request.body?.username ?? '').trim()
  const email = String(request.body?.email ?? '').trim().toLowerCase()
  const password = String(request.body?.password ?? '')
  const name = String(request.body?.name ?? '').trim().slice(0, 40)
  const grade = Number(request.body?.grade)
  if (!/^[A-Za-z0-9_.-]{3,24}$/.test(username)) return response.status(400).json({ error: 'Username must be 3–24 letters, numbers, dots, underscores, or hyphens.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: 'Enter a valid email address.' })
  if (password.length < 8 || password.length > 128) return response.status(400).json({ error: 'Password must be 8–128 characters.' })
  if (!name || !Number.isInteger(grade) || grade < 1 || grade > 12) return response.status(400).json({ error: 'Provide a learner name and grade from 1 to 12.' })
  try {
    const data = await readData()
    if (data.accounts.some((account) => account.email === email || account.username.toLowerCase() === username.toLowerCase())) return response.status(409).json({ error: 'That email or username is already in use.' })
    const accountId = randomBytes(16).toString('hex')
    const salt = randomBytes(16).toString('hex')
    const passwordHash = scryptSync(password, salt, 64).toString('hex')
    const profile = createProfile({ id: randomBytes(16).toString('hex'), name, grade })
    profile.accountId = accountId
    const account = { id: accountId, username, email, salt, passwordHash }
    const token = randomBytes(32).toString('hex')
    data.accounts.push(account)
    data.profiles.push(profile)
    data.sessions.push({ tokenHash: hashToken(token), accountId })
    await writeData(data)
    response.status(201).json({ token, account: publicAccount(account), profiles: [profileSummary(profile)] })
  } catch {
    response.status(500).json({ error: 'Could not create your account.' })
  }
})
app.post('/api/auth/login', async (request, response) => {
  const identifier = String(request.body?.identifier ?? '').trim().toLowerCase()
  const password = String(request.body?.password ?? '')
  if (!identifier || !password) return response.status(400).json({ error: 'Enter your email or username and password.' })
  try {
    const data = await readData()
    const account = data.accounts.find((item) => item.email === identifier || item.username.toLowerCase() === identifier)
    if (!account) return response.status(401).json({ error: 'The email/username or password is incorrect.' })
    const passwordHash = scryptSync(password, account.salt, 64)
    const storedHash = Buffer.from(account.passwordHash, 'hex')
    if (storedHash.length !== passwordHash.length || !timingSafeEqual(passwordHash, storedHash)) return response.status(401).json({ error: 'The email/username or password is incorrect.' })
    const token = randomBytes(32).toString('hex')
    data.sessions.push({ tokenHash: hashToken(token), accountId: account.id })
    await writeData(data)
    response.json({ token, account: publicAccount(account), profiles: data.profiles.filter((profile) => profile.accountId === account.id).map(profileSummary) })
  } catch {
    response.status(500).json({ error: 'Could not log in.' })
  }
})
app.get('/api/auth/me', async (request, response) => {
  try {
    const data = await readData()
    const account = accountFromRequest(data, request)
    if (!account) return response.status(401).json({ error: 'Please log in again.' })
    response.json({ account: publicAccount(account), profiles: data.profiles.filter((profile) => profile.accountId === account.id).map(profileSummary) })
  } catch {
    response.status(500).json({ error: 'Could not load your account.' })
  }
})
app.post('/api/auth/logout', async (request, response) => {
  try {
    const data = await readData()
    const token = (request.get('authorization') ?? '').replace(/^Bearer /, '')
    data.sessions = data.sessions.filter((session) => session.tokenHash !== hashToken(token))
    await writeData(data)
    response.status(204).end()
  } catch {
    response.status(500).json({ error: 'Could not log out.' })
  }
})
app.post('/api/profiles', async (request, response) => {
  const name = String(request.body?.name ?? '').trim().slice(0, 40)
  const grade = Number(request.body?.grade)
  if (!name || !Number.isInteger(grade) || grade < 1 || grade > 12) return response.status(400).json({ error: 'Provide a name and grade from 1 to 12.' })
  try {
    const data = await readData()
    const authorization = request.get('authorization') ?? ''
    const account = accountFromRequest(data, request)
    if (authorization.startsWith('Bearer ') && !account) return response.status(401).json({ error: 'Please log in again.' })
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'learner'}-${Date.now()}`
    const profile = createProfile({ id, name, grade })
    profile.accountId = account?.id
    data.profiles.push(profile)
    await writeData(data)
    response.status(201).json(profile)
  } catch {
    response.status(500).json({ error: 'Could not create profile.' })
  }
})
app.patch('/api/profiles/:profileId/learning-state', async (request, response) => {
  const { activeActivity, activityId, progress, activityState } = request.body ?? {}
  if (activeActivity !== undefined && !chapterNavigationIds.includes(activeActivity)) return response.status(400).json({ error: 'Invalid active activity.' })
  if (activityId !== undefined && !chapterActivityIds.includes(activityId)) return response.status(400).json({ error: 'Invalid activity progress.' })
  if (progress !== undefined && (!Array.isArray(progress.order) || progress.order.length > 100 || !progress.order.every((index) => Number.isInteger(index) && index >= 0) || !Number.isInteger(progress.index) || progress.index < 0 || progress.index >= Math.max(progress.order.length, 1) || !Array.isArray(progress.seen) || progress.seen.length > 100 || !progress.seen.every((index) => Number.isInteger(index) && index >= 0) || !Number.isInteger(progress.streak) || progress.streak < 0 || progress.streak > 10 || (progress.choice !== null && progress.choice !== undefined && (!Number.isInteger(progress.choice) || progress.choice < 0 || progress.choice > 10)) || (progress.result !== null && progress.result !== undefined && typeof progress.result !== 'boolean') || (progress.answerOrder !== undefined && (!Array.isArray(progress.answerOrder) || progress.answerOrder.length > 10 || !progress.answerOrder.every((index) => Number.isInteger(index) && index >= 0 && index <= 10))))) return response.status(400).json({ error: 'Invalid saved learning progress.' })
  if (activityState !== undefined && (!activityState || typeof activityState !== 'object' || Array.isArray(activityState) || Object.keys(activityState).length > 10 || Object.entries(activityState).some(([key, value]) => key.length > 50 || !(value === null || typeof value === 'string' && value.length <= 2000 || typeof value === 'boolean' || Number.isFinite(value))))) return response.status(400).json({ error: 'Invalid saved activity state.' })
  if (activityId !== undefined && progress === undefined && activityState === undefined) return response.status(400).json({ error: 'Provide activity progress to save.' })
  try {
    const data = await readData()
    const profile = findProfile(data, request.params.profileId)
    if (!profile) return response.status(404).json({ error: 'Profile not found.' })
    profile.learningState ??= { activeActivity: 'welcome', questionProgress: {}, activityProgress: {} }
    if (activeActivity !== undefined) profile.learningState.activeActivity = activeActivity
    profile.learningState.questionProgress ??= {}
    profile.learningState.activityProgress ??= {}
    if (activityId !== undefined && progress !== undefined) profile.learningState.questionProgress[activityId] = {
      order: progress.order,
      index: progress.index,
      seen: progress.seen,
      streak: progress.streak,
      choice: progress.choice ?? null,
      result: progress.result ?? null,
      answerOrder: progress.answerOrder ?? [],
    }
    if (activityId !== undefined && activityState !== undefined) profile.learningState.activityProgress[activityId] = activityState
    await writeData(data)
    response.json(profile)
  } catch {
    response.status(500).json({ error: 'Could not save learning progress.' })
  }
})
app.get('/api/profiles/:profileId', async (request, response) => {
  try {
    const profile = findProfile(await readData(), request.params.profileId)
    if (!profile) return response.status(404).json({ error: 'Profile not found.' })
    response.json(profile)
  } catch {
    response.status(500).json({ error: 'Could not load profile.' })
  }
})
app.patch('/api/profiles/:profileId', async (request, response) => {
  const name = String(request.body?.name ?? '').trim().slice(0, 40)
  const grade = Number(request.body?.grade)
  if (!name || !Number.isInteger(grade) || grade < 1 || grade > 12) return response.status(400).json({ error: 'Provide a name and grade from 1 to 12.' })
  try {
    const data = await readData()
    const profile = findProfile(data, request.params.profileId)
    if (!profile) return response.status(404).json({ error: 'Profile not found.' })
    profile.name = name
    profile.grade = grade
    await writeData(data)
    response.json(profile)
  } catch {
    response.status(500).json({ error: 'Could not update profile.' })
  }
})
app.delete('/api/profiles/:profileId', async (request, response) => {
  try {
    const data = await readData()
    const profileIndex = data.profiles.findIndex((profile) => profile.id === request.params.profileId)
    if (profileIndex === -1) return response.status(404).json({ error: 'Profile not found.' })
    data.profiles.splice(profileIndex, 1)
    await writeData(data)
    response.json({ id: request.params.profileId })
  } catch {
    response.status(500).json({ error: 'Could not delete profile.' })
  }
})
app.post('/api/profiles/:profileId/lessons/:lessonId/complete', async (request, response) => {
  const lessonId = Number(request.params.lessonId)
  if (!Number.isInteger(lessonId) || lessonId < 1 || lessonId > 3) return response.status(400).json({ error: 'Lesson ID must be 1, 2, or 3.' })
  try {
    const data = await readData()
    const profile = findProfile(data, request.params.profileId)
    if (!profile) return response.status(404).json({ error: 'Profile not found.' })
    if (!profile.completedLessons.includes(lessonId)) profile.completedLessons.push(lessonId)
    if (lessonId === 1 && !profile.badges.includes('Lesson Starter')) profile.badges.push('Lesson Starter')
    await writeData(data)
    response.json(profile)
  } catch {
    response.status(500).json({ error: 'Could not save lesson progress.' })
  }
})
app.post('/api/profiles/:profileId/quiz', async (request, response) => {
  const score = Number(request.body?.score)
  if (!Number.isFinite(score) || score < 0 || score > 100) return response.status(400).json({ error: 'Score must be between 0 and 100.' })
  try {
    const data = await readData()
    const profile = findProfile(data, request.params.profileId)
    if (!profile) return response.status(404).json({ error: 'Profile not found.' })
    profile.quizResults.push({ score, passed: score >= 70, completedAt: new Date().toISOString() })
    if (score >= 70 && !profile.badges.includes('Quiz Master')) profile.badges.push('Quiz Master')
    await writeData(data)
    response.json(profile)
  } catch {
    response.status(500).json({ error: 'Could not save quiz result.' })
  }
})
app.post('/api/profiles/:profileId/saved-lessons/:lessonId', async (request, response) => {
  const lessonId = Number(request.params.lessonId)
  if (!Number.isInteger(lessonId) || lessonId < 1 || lessonId > 3) return response.status(400).json({ error: 'Lesson ID must be 1, 2, or 3.' })
  try {
    const data = await readData()
    const profile = findProfile(data, request.params.profileId)
    if (!profile) return response.status(404).json({ error: 'Profile not found.' })
    profile.savedLessons ??= []
    profile.savedLessons = profile.savedLessons.includes(lessonId) ? profile.savedLessons.filter((id) => id !== lessonId) : [...profile.savedLessons, lessonId]
    await writeData(data)
    response.json(profile)
  } catch {
    response.status(500).json({ error: 'Could not save lesson.' })
  }
})
app.post('/api/profiles/:profileId/activities/:activityId/complete', async (request, response) => {
  const activityId = String(request.params.activityId).trim()
  const xp = Number(request.body?.xp ?? 0)
  const coins = Number(request.body?.coins ?? 0)
  if (!chapterActivityIds.includes(activityId) || !Number.isInteger(xp) || !Number.isInteger(coins) || xp < 0 || xp > 100 || coins < 0 || coins > 100) return response.status(400).json({ error: 'Invalid activity reward.' })
  const score = request.body?.score === undefined ? null : Number(request.body.score)
  if (score !== null && (!Number.isFinite(score) || score < 0 || score > 100 || !['chapter-quiz', 'chapter-test'].includes(activityId))) return response.status(400).json({ error: 'Invalid quiz score.' })
  const goal = String(request.body?.goal ?? '').trim()
  const plan = String(request.body?.plan ?? '').trim()
  if (activityId === 'final-project' && (!goal || goal.length > 100 || !plan || plan.length > 500)) return response.status(400).json({ error: 'Provide a savings goal and plan.' })
  try {
    const data = await readData()
    const profile = findProfile(data, request.params.profileId)
    if (!profile) return response.status(404).json({ error: 'Profile not found.' })
    if (!profile.completedActivities.includes(activityId)) {
      profile.completedActivities.push(activityId)
      profile.xp = nonNegativeNumber(profile.xp) + xp
      profile.coins = nonNegativeNumber(profile.coins) + coins
    }
    if (score !== null) {
      profile.quizResults.push({ score, passed: score >= 70, completedAt: new Date().toISOString() })
      if (score >= 70 && !profile.badges.includes('Quiz Master')) profile.badges.push('Quiz Master')
    }
    if (activityId === 'welcome' && !profile.badges.includes('Lesson Starter')) profile.badges.push('Lesson Starter')
    const gameBadge = gameBadges[activityId]
    if (gameBadge && !profile.badges.includes(gameBadge)) profile.badges.push(gameBadge)
    if (activityId === 'final-project') {
      profile.savingsGoal = { goal, plan, updatedAt: new Date().toISOString() }
      if (!profile.badges.includes('Savings Planner')) profile.badges.push('Savings Planner')
    }
    if (chapterActivityIds.every((id) => profile.completedActivities.includes(id)) && !profile.badges.includes('Money Explorer')) profile.badges.push('Money Explorer')
    await writeData(data)
    response.json(profile)
  } catch {
    response.status(500).json({ error: 'Could not save activity progress.' })
  }
})

export default app

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(__dirname, 'index.js')) {
  app.listen(port, () => console.log(`NextGen Finance API listening on http://localhost:${port}`))
}
