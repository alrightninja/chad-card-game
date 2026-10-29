import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AudioProvider } from "./audio/AudioProvider";
import Layout from "./components/Layout";
import { SocialInboxProvider } from "./context/SocialInbox";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import CollectionPage from "./pages/CollectionPage";
import ShopPage from "./pages/ShopPage";
import PlayPage from "./pages/PlayPage";
import FriendsPage from "./pages/FriendsPage";
import BattlePage from "./pages/BattlePage";
import TutorialPage from "./pages/TutorialPage";
import DeckBuilderPage from "./pages/DeckBuilderPage";

function Guard({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="shell">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user, ready } = useAuth();
  if (!ready) return <p className="shell">Loading…</p>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route
        path="/"
        element={
          <Guard>
            <SocialInboxProvider>
              <Layout />
            </SocialInboxProvider>
          </Guard>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="tutorial" element={<TutorialPage />} />
        <Route path="play" element={<PlayPage />} />
        <Route path="collection" element={<CollectionPage />} />
        <Route path="decks" element={<DeckBuilderPage />} />
        <Route path="shop" element={<ShopPage />} />
        <Route path="friends" element={<FriendsPage />} />
        <Route path="battle/:matchId" element={<BattlePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AudioProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AudioProvider>
    </AuthProvider>
  );
}
