import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import LearningApp from './LearningApp.tsx'
import './polish.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LearningApp />
  </StrictMode>,
)
