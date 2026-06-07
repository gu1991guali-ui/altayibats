import { Link, Navigate, Route, Routes } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { AccountPage } from "@/pages/AccountPage";
import { AdminPage } from "@/pages/AdminPage";
import { HomePage } from "@/pages/HomePage";
import { LegalPage } from "@/pages/LegalPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { VideoDetailsPage } from "@/pages/VideoDetailsPage";

export function App() {
  return (
    <>
      <AppHeader />
      <main className="page-shell">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/videos/:id" element={<VideoDetailsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/legal" element={<LegalPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <div>
          <strong>الطيبات</strong>
          <span>منصة فيديوهات تعليمية عن نظام الطيبات للدكتور ضياء العوضي رحمه الله.</span>
        </div>
        <nav aria-label="روابط الفوتر">
          <Link to="/legal">الخصوصية والشروط</Link>
          <Link to="/login">دخول الإدارة</Link>
        </nav>
      </footer>
    </>
  );
}
