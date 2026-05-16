import {
  Home,
  LogIn,
  LogOut,
  Shield,
  UserCircle,
  UserPlus,
  Video
} from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "nav-link active" : "nav-link";

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

        {!isLoading && user ? (
          <>
            <NavLink className={navClass} to="/account">
              <UserCircle size={17} aria-hidden="true" />
              الحساب
            </NavLink>

            {isAdmin ? (
              <NavLink className={navClass} to="/admin">
                <Shield size={17} aria-hidden="true" />
                الإدارة
              </NavLink>
            ) : null}

            <button className="nav-button" type="button" onClick={handleSignOut}>
              <LogOut size={17} aria-hidden="true" />
              خروج
            </button>
          </>
        ) : null}

        {!isLoading && !user ? (
          <>
            <NavLink className={navClass} to="/login">
              <LogIn size={17} aria-hidden="true" />
              دخول
            </NavLink>
            <Link className="button button-small" to="/register">
              <UserPlus size={16} aria-hidden="true" />
              حساب جديد
            </Link>
          </>
        ) : null}
      </nav>
    </header>
  );
}
