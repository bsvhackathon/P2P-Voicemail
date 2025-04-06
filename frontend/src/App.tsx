import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Voicemail from './pages/Voicemail'

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Voicemail />}>
        </Route>
      </Routes>
    </Router>
  )
}

export default App
