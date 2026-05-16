import { LogIn } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { StatusMessage } from "@/components/StatusMessage";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

function safeRedirect(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const redirectTo = useMemo(
    () => safeRedirect(new URLSearchParams(location.search).get("redirect")),
    [location.search]
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      navigate(redirectTo, { replace: true });
    }
  }, [navigate, redirectTo, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!isSupabaseConfigured) {
      setError("أضف مفاتيح Supabase في ملف .env.local أولًا.");
      return;
    }

    setIsSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    setIsSubmitting(false);

    if (signInError) {
      setError("تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور.");
      return;
    }

    navigate(redirectTo, { replace: true });
  }

  return (
    <section className="form-panel">
      <div className="page-heading">
        <h1>تسجيل الدخول</h1>
        <p>ادخل إلى حسابك لمشاهدة الفيديوهات والتعليق والإعجاب.</p>
      </div>

      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}

      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">البريد الإلكتروني</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
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
            autoComplete="current-password"
            required
          />
        </div>

        <div className="form-actions">
          <button className="button" type="submit" disabled={isSubmitting}>
            <LogIn size={17} aria-hidden="true" />
            {isSubmitting ? "جار الدخول..." : "دخول"}
          </button>
          <Link className="button ghost" to="/register">
            حساب جديد
          </Link>
        </div>
      </form>
    </section>
  );
}
