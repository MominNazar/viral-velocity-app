import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth';
import { Layout } from './components/Layout';
import { Toaster } from './ui';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ImagesMatched } from './pages/ImagesMatched';
import { ImagesMatchedDetail } from './pages/ImagesMatchedDetail';
import { Subscribers } from './pages/Subscribers';
import { Profile } from './pages/Profile';

function Protected({ children }: { children: JSX.Element }) {
  const { admin, loading } = useAuth();
  if (loading) return <div className="auth-wrap"><div className="muted">Loading…</div></div>;
  if (!admin) return <Navigate to="/login" replace />;
  return children;
}

export function App() {
  return (
    <HashRouter>
      <Toaster />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <Protected>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/images-matched" element={<ImagesMatched />} />
                  <Route path="/images-matched/:userId" element={<ImagesMatchedDetail />} />
                  <Route path="/subscribers" element={<Subscribers />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </Protected>
          }
        />
      </Routes>
    </HashRouter>
  );
}
