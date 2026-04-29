import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { Upload } from './pages/Upload'
import { Library } from './pages/Library'
import { VideoDetail } from './pages/VideoDetail'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { Profile } from './pages/Profile'
import { PlayerDemo } from './pages/PlayerDemo'
import { TrackingStudio } from './pages/TrackingStudio'
import { CommentaryDemo } from './pages/CommentaryDemo'
import { ExportDemo } from './pages/ExportDemo'
import { StatsDemo } from './pages/StatsDemo'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/library" element={<Library />} />
          <Route path="/videos/:videoId" element={<VideoDetail />} />
          <Route path="/videos/:videoId/track" element={<TrackingStudio />} />
          <Route path="/player-demo" element={<PlayerDemo />} />
          <Route path="/commentary-demo" element={<CommentaryDemo />} />
          <Route path="/export-demo" element={<ExportDemo />} />
          <Route path="/stats-demo" element={<StatsDemo />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
