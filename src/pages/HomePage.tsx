import { Lock, RefreshCw, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatusMessage } from "@/components/StatusMessage";
import { useAuth } from "@/components/AuthProvider";
import { VideoCard } from "@/components/VideoCard";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { VideoRecord, VideoSummary } from "@/lib/types";
import { enrichVideos } from "@/lib/video-utils";

export function HomePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadVideos = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    const { data, error: videosError } = await supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false });

    if (videosError) {
      setError("تعذر تحميل الفيديوهات. تحقق من إعدادات Supabase وقواعد الوصول.");
      setVideos([]);
      setIsLoading(false);
      return;
    }

    const enriched = await enrichVideos((data ?? []) as VideoRecord[], Boolean(user));
    setVideos(enriched);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      void loadVideos();
    }
  }, [authLoading, loadVideos]);

  const stats = useMemo(
    () => [
      { label: "فيديو منشور", value: videos.length },
      { label: "إعجاب", value: videos.reduce((total, video) => total + video.likes_count, 0) },
      { label: "تعليق", value: videos.reduce((total, video) => total + video.comments_count, 0) }
    ],
    [videos]
  );

  return (
    <section className="home-layout">
      <div className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles size={16} aria-hidden="true" />
            منصة عربية منظمة للفيديوهات
          </span>
          <h1>شاهد، أدر، وتفاعل مع محتوى الفيديو في تجربة واحدة.</h1>
          <p>
            واجهة RTL حديثة تعرض الفيديوهات الطويلة والقصيرة بوضوح، مع تسجيل دخول للتفاعل
            ولوحة إدارة للرفع والتحرير والمتابعة.
          </p>
          <div className="hero-actions">
            {user ? (
              <Link className="button" to="/account">
                <ShieldCheck size={17} aria-hidden="true" />
                عرض الحساب
              </Link>
            ) : (
              <Link className="button" to="/login">
                <Lock size={17} aria-hidden="true" />
                تسجيل الدخول
              </Link>
            )}
            <button className="button secondary" type="button" onClick={loadVideos}>
              <RefreshCw size={16} aria-hidden="true" />
              تحديث القائمة
            </button>
          </div>
        </div>

        <div className="hero-panel" aria-label="ملخص المنصة">
          <div className="hero-visual">
            <div className="hero-play">
              <UploadCloud size={26} aria-hidden="true" />
            </div>
          </div>
          <div className="stat-grid">
            {stats.map((item) => (
              <div className="stat-card" key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {!isSupabaseConfigured ? (
        <StatusMessage title="إعداد Supabase مطلوب" tone="error">
          أضف القيم في ملف .env.local ثم شغل التطبيق مرة أخرى.
        </StatusMessage>
      ) : null}

      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}

      <div className="section-head">
        <div>
          <h2>أحدث الفيديوهات</h2>
          <p>المحتوى المنشور يظهر هنا حسب الأحدث أولاً.</p>
        </div>
      </div>

      {isLoading ? <div className="empty-state">جار تحميل الفيديوهات...</div> : null}

      {!isLoading && videos.length === 0 ? (
        <div className="empty-state">لا توجد فيديوهات منشورة حالياً.</div>
      ) : null}

      {!isLoading && videos.length > 0 ? (
        <div className="video-grid">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} canOpen={Boolean(user)} showStats={Boolean(user)} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
