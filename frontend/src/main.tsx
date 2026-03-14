import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 立即设置默认主题为深色（在 React 加载前）
const savedTheme = localStorage.getItem('app-storage')
if (savedTheme) {
  try {
    const parsed = JSON.parse(savedTheme)
    if (parsed.state?.theme) {
      document.body.setAttribute('data-theme', parsed.state.theme)
    } else {
      document.body.setAttribute('data-theme', 'dark')
    }
  } catch {
    document.body.setAttribute('data-theme', 'dark')
  }
} else {
  document.body.setAttribute('data-theme', 'dark')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)