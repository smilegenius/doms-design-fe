import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import GoApp from './app/go/GoApp'
import './styles/index.css'

// The app lives under /go/* (same URLs as the design prototype).
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/go/*" element={<GoApp />} />
        <Route path="*" element={<Navigate to="/go/home" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
