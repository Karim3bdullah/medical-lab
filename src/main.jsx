import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/fonts.css'
import './index.css'
import App from './App.jsx'

const THEME_STORAGE_KEY = 'labnet.ui.theme'
const SUPPORTED_THEME_PREFERENCES = ['light', 'dark', 'system']

const getInitialThemePreference = () => {
  try {
    const storedPreference = localStorage.getItem(THEME_STORAGE_KEY)
    return SUPPORTED_THEME_PREFERENCES.includes(storedPreference)
      ? storedPreference
      : 'system'
  } catch {
    return 'system'
  }
}

const resolveTheme = (preference) => {
  if (preference !== 'system') return preference

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

const themePreference = getInitialThemePreference()
const resolvedTheme = resolveTheme(themePreference)
const rootElement = document.documentElement

rootElement.classList.toggle('dark', resolvedTheme === 'dark')
rootElement.dataset.theme = resolvedTheme
rootElement.dataset.themePreference = themePreference
rootElement.style.colorScheme = resolvedTheme

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
