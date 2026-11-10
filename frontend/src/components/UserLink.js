import { Link } from "react-router-dom";
import VerifiedBadge from "./VerifiedBadge";

export function avatarSrc(user) {
  if (user?.avatarArt) return `/cards/${user.avatarArt}`;
  return "";
}

export default function UserLink({ user, className = "" }) {
  if (!user?.username) return null;
  const src = avatarSrc(user);
  return (
    <Link className={`user-link ${className}`} to={`/u/${encodeURIComponent(user.username)}`}>
      {src ? <img className="avatar-sm" src={src} alt="" /> : <span className="avatar-sm avatar-empty" />}
      <span>{user.username}</span>
      {user.level ? <span className="muted">Lv {user.level}</span> : null}
      <VerifiedBadge verified={user.verified} />
    </Link>
  );
}
