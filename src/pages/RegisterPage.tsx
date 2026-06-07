import { UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { StatusMessage } from "@/components/StatusMessage";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!isSupabaseConfigured) {
      setError("أضف مفاتيح Supabase في ملف .env.local أولاً.");
      return;
    }

    if (password.length < 6) {
      setError("كلمة المرور يجب ألا تقل عن 6 أحرف.");
      return;
    }

    setIsSubmitting(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName.trim() || email.split("@")[0]
        }
      }
    });

    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setMessage("تم إنشاء الحساب. إذا كان تأكيد البريد مفعلاً في Supabase، افتح رابط التأكيد قبل تسجيل الدخول.");
    setDisplayName("");
    setEmail("");
    setPassword("");
  }

  return (
    <section className="auth-layout">
      <div className="auth-copy">
        <span className="eyebrow">حساب جديد</span>
        <h1>إنشاء حساب للتفاعل فقط.</h1>
        <p>المشاهدة مفتوحة للجميع بدون تسجيل. الحساب مخصص للتعليقات أو الإعجاب أو صلاحيات الإدارة عند الحاجة.</p>
      </div>

      <div className="form-panel">
        {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
        {message ? <StatusMessage tone="success">{message}</StatusMessage> : null}

        <form className="form-stack" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="displayName">الاسم</label>
            <input
              id="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
              placeholder="اسم العرض"
            />
          </div>

          <div className="field">
            <label htmlFor="email">البريد الإلكتروني</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="name@example.com"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">كلمة المرور</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="6 أحرف أو أكثر"
              required
            />
          </div>

          <div className="form-actions">
            <button className="button" type="submit" disabled={isSubmitting}>
              <UserPlus size={17} aria-hidden="true" />
              {isSubmitting ? "جار إنشاء الحساب..." : "إنشاء الحساب"}
            </button>
            <Link className="button ghost" to="/login">
              لدي حساب
            </Link>
          </div>
        </form>
      </div>
    </section>
  );
}
