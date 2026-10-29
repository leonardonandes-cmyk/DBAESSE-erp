import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles.css'
import { instalarGuardaModal } from './lib/guardaModal.js'

// cadastros abertos não fecham por engano (clique fora) e perguntam antes de descartar alterações
instalarGuardaModal()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
