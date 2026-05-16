import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { StatusMessage } from "@/components/StatusMessage";
import { isSupabaseConfigured } from "@/lib/supabase";

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function AccountPage() {
  const navigate = useNavigate();
  const { user, profile, isAdmin, isLoading } = useAuth();

  useEffect(() => {
    if (isSupabaseConfigured && !isLoading && !user) {
      navigate("/login?redirect=/account", { replace: true });
    }
  }, [isLoading, navigate, user]);

  if (!isSupabaseConfigured) {
    return (
      <StatusMessage title="إعداد Supabase مطلوب" tone="error">
        أضف القيم في ملف .env.local لعرض الحساب.
      </StatusMessage>
    );
  }

  if (isLoading) {
    return <div className="empty-state">جار تحميل الحساب...</div>;
  }

  if (!user) {
    return <div className="empty-state">جار تحويلك إلى تسجيل الدخول...</div>;
  }

  return (
    <section className="content-panel">
      <div className="page-heading">
        <h1>حساب المستخدم</h1>
        <p>بيانات الحساب والصلاحية الحالية.</p>
      </div>

      <div className="account-grid">
        <div className="metric">
          <span>البريد الإلكتروني</span>
          <strong>{user.email}</strong>
        </div>
        <div className="metric">
          <span>الاسم</span>
          <strong>{profile?.display_name || "غير محدد"}</strong>
        </div>
        <div className="metric">
          <span>الصلاحية</span>
          <strong>{isAdmin ? "مدير" : "مستخدم"}</strong>
        </div>
        <div className="metric">
          <span>تاريخ إنشاء الحساب</span>
          <strong>{formatDate(profile?.created_at)}</strong>
        </div>
        <div className="metric">
          <span>معرف الحساب</span>
          <strong>{user.id}</strong>
        </div>
      </div>
    </section>
  );
}
