import { Home, LogOut, PlayCircle, Shield, Video } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "nav-link active desktop-nav-link" : "nav-link desktop-nav-link";

export function AppHeader() {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <header className="site-header">
      <Link to="/" className="brand" aria-label="الصفحة الرئيسية">
        <span className="brand-mark">
          <Video size={20} aria-hidden="true" />
        </span>
        <span>الطيبات</span>
      </Link>

      <nav className="site-nav" aria-label="التنقل الرئيسي">
        <NavLink className={navClass} to="/" end>
          <Home size={17} aria-hidden="true" />
          الرئيسية
        </NavLink>

        <a className="nav-link nav-cta" href="/#latest-videos">
          <PlayCircle size={17} aria-hidden="true" />
          شاهد الآن
        </a>

        <a className="nav-link desktop-nav-link" href="/#tayyibat-allowed">
          الطيبات المسموحة
        </a>

        {!isLoading && isAdmin ? (
          <NavLink className={navClass} to="/admin">
            <Shield size={17} aria-hidden="true" />
            الإدارة
          </NavLink>
        ) : null}

        {!isLoading && user ? (
          <button className="nav-button desktop-nav-link" type="button" onClick={handleSignOut}>
            <LogOut size={17} aria-hidden="true" />
            خروج
          </button>
        ) : null}
      </nav>
    </header>
  );
}
