import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import OldVoicemail from './pages/OldVoicemail'
import VoicemailPage from './pages/VoicemailPage'

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/old" element={<OldVoicemail />} />
        <Route path="/" element={<VoicemailPage />} />
      </Routes>
    </Router>
  )
}

export default App
