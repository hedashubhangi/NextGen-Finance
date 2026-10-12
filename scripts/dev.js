import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiPort = process.env.API_PORT || process.env.PORT || '3001'
const childEnv = { ...process.env, API_PORT: apiPort }
const children = [
  spawn(process.execPath, ['backend/index.js'], {
    cwd: root,
    env: { ...childEnv, PORT: apiPort },
    stdio: 'inherit',
  }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'frontend', '--config', 'frontend/vite.config.ts'], {
    cwd: root,
    env: childEnv,
    stdio: 'inherit',
  }),
]

let stopping = false
const stopChildren = (exitCode = 0) => {
  if (stopping) return
  stopping = true
  process.exitCode = exitCode
  children.forEach((child) => {
    if (child.exitCode === null) child.kill()
  })
}

children.forEach((child) => {
  child.on('error', (error) => {
    console.error('Could not start the development services:', error)
    stopChildren(1)
  })
  child.on('exit', (code, signal) => {
    if (!stopping) {
      console.error(`A development service stopped${signal ? ` (${signal})` : ` with exit code ${code ?? 1}`}.`)
      stopChildren(code ?? 1)
    }
  })
})

process.on('SIGINT', () => stopChildren())
process.on('SIGTERM', () => stopChildren())
