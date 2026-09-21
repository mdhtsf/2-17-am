import React from 'react'
import { createRoot } from 'react-dom/client'
import MovementHarness from './MovementHarness.jsx'
import '../src/styles.css'
import './movement.css'

if (import.meta.env.DEV) {
  createRoot(document.getElementById('movement-root')).render(<React.StrictMode><MovementHarness /></React.StrictMode>)
}
