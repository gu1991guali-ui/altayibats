import { lazy, Suspense, useEffect } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { trackPageVisit } from "@/lib/analytics";

const HomePage = lazy(() => import("@/pages/HomePage").then((module) => ({ default: module.HomePage })));
const RegisterPage = lazy(() => import("@/pages/RegisterPage").then((module) => ({ default: module.RegisterPage })));
const LoginPage = lazy(() => import("@/pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const VideoDetailsPage = lazy(() => import("@/pages/VideoDetailsPage").then((module) => ({ default: module.VideoDetailsPage })));
const AdminPage = lazy(() => import("@/pages/AdminPage").then((module) => ({ default: module.AdminPage })));
const AccountPage = lazy(() => import("@/pages/AccountPage").then((module) => ({ default: module.AccountPage })));
const LegalPage = lazy(() => import("@/pages/LegalPage").then((module) => ({ default: module.LegalPage })));

function PageVisitTracker() {
  const location = useLocation();

  useEffect(() => {
    void trackPageVisit(location.pathname);
  }, [location.pathname]);

  return null;
}

function PageFallback() {
  return <div className="empty-state">جار تحميل الصفحة...</div>;
}

export function App() {
  return (
    <>
      <PageVisitTracker />
      <AppHeader />
      <main className="page-shell">
        <Suspense fallback={<PageFallback />}>
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
        </Suspense>
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
