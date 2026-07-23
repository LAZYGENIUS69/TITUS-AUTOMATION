import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installAuthenticatedFetch } from './auth.js'

// Apply the default before React mounts so the first paint is dark as well.
const savedTheme = localStorage.getItem('titus-theme')
document.documentElement.classList.toggle('dark', savedTheme !== 'light')

installAuthenticatedFetch()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
