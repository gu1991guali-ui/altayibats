import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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

  return (
    <section>
      <div className="page-heading">
        <h1>أحدث الفيديوهات</h1>
        <p>استعرض الفيديوهات المنشورة حديثًا. يتطلب تشغيل الفيديو والتفاعل تسجيل الدخول.</p>
      </div>

      {!isSupabaseConfigured ? (
        <StatusMessage title="إعداد Supabase مطلوب" tone="error">
          أضف القيم في ملف .env.local ثم شغل التطبيق مرة أخرى.
        </StatusMessage>
      ) : null}

      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}

      <div className="form-actions" style={{ marginBottom: 18 }}>
        <button className="button secondary button-small" type="button" onClick={loadVideos}>
          <RefreshCw size={16} aria-hidden="true" />
          تحديث
        </button>
      </div>

      {isLoading ? <div className="empty-state">جار تحميل الفيديوهات...</div> : null}

      {!isLoading && videos.length === 0 ? (
        <div className="empty-state">لا توجد فيديوهات منشورة حاليًا.</div>
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
