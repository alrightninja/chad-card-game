import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAudio } from "../audio/AudioProvider";
import { useSocialInbox } from "../context/SocialInbox";
import VerifiedBadge from "./VerifiedBadge";

export default function Layout() {
  const { user, logout } = useAuth();
  const audio = useAudio();
  const { notice, clearNotice } = useSocialInbox();
  const location = useLocation();
  const battle = location.pathname.startsWith("/battle");

  return (
    <div className={`shell ${battle ? "shell-battle" : ""}`}>
      <header className={`topbar ${battle ? "compact" : ""}`}>
        <div className="brand">GIGACHAD TCG</div>
        {!battle ? (
          <nav className="nav">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/tutorial">How to play</NavLink>
            <NavLink to="/play">Play</NavLink>
            <NavLink to="/collection">Collection</NavLink>
            <NavLink to="/decks">Decks</NavLink>
            <NavLink to="/shop">Shop</NavLink>
            <NavLink to="/friends">Friends</NavLink>
          </nav>
        ) : (
          <nav className="nav">
            <Link className="btn secondary leave-battle" to="/">Leave</Link>
          </nav>
        )}
        <div className="row">
          <span className="muted">
            {user?.username}
            <VerifiedBadge verified={user?.verified} />
            {" · "}
            {user?.currency?.reps ?? 0} reps
          </span>
          <button className="btn secondary" type="button" onClick={() => audio?.setEnabled(!audio.enabled)}>
            {audio?.enabled ? "Music on" : "Music off"}
          </button>
          {!battle ? (
            <button className="btn secondary" type="button" onClick={logout}>
              Log out
            </button>
          ) : null}
        </div>
      </header>
      {notice && !battle ? (
        <div className="notice-bar">
          <Link to={notice.href || "/friends"} onClick={clearNotice}>{notice.text}</Link>
          <button className="btn secondary" type="button" onClick={clearNotice}>Dismiss</button>
        </div>
      ) : null}
      <Outlet />
    </div>
  );
}
