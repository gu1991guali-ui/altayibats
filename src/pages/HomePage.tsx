import { Lock, RefreshCw, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatusMessage } from "@/components/StatusMessage";
import { useAuth } from "@/components/AuthProvider";
import { Playlist } from "@/components/Playlist";
import { VideoCard } from "@/components/VideoCard";
import { fetchPlaylistsWithVideos, isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { PlaylistWithVideos, VideoRecord, VideoSummary } from "@/lib/types";
import { enrichVideos } from "@/lib/video-utils";

export function HomePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistWithVideos[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadVideos = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    const [videoResult, playlistResult] = await Promise.allSettled([
      supabase.from("videos").select("*").order("created_at", { ascending: false }),
      fetchPlaylistsWithVideos(Boolean(user))
    ]);

    if (videoResult.status === "rejected" || videoResult.value.error) {
      setError("تعذر تحميل الفيديوهات. تحقق من إعدادات Supabase وقواعد الوصول.");
      setVideos([]);
      setPlaylists([]);
      setIsLoading(false);
      return;
    }

    if (playlistResult.status === "fulfilled") {
      setPlaylists(playlistResult.value);
    } else {
      setPlaylists([]);
    }

    const enriched = await enrichVideos((videoResult.value.data ?? []) as VideoRecord[], Boolean(user));
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
    <section className="home-layout overflow-x-hidden" dir="rtl">
      <div className="hero-section overflow-x-hidden">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles size={16} aria-hidden="true" />
            منصة عربية منظمة للفيديوهات
          </span>
          <h1>شاهد، أدر، وتفاعل مع محتوى الفيديو في تجربة واحدة.</h1>
          <p>
            واجهة RTL حديثة تعرض الفيديوهات الطويلة والقصيرة بوضوح، مع قوائم تشغيل أفقية وتسجيل دخول
            للتفاعل ولوحة إدارة للرفع والتحرير والمتابعة.
          </p>
          <div className="hero-actions flex-wrap gap-3">
            {user ? (
              <Link className="button transition-all duration-200" to="/account">
                <ShieldCheck size={17} aria-hidden="true" />
                عرض الحساب
              </Link>
            ) : (
              <Link className="button transition-all duration-200" to="/login">
                <Lock size={17} aria-hidden="true" />
                تسجيل الدخول
              </Link>
            )}
            <button className="button secondary transition-all duration-200" type="button" onClick={loadVideos}>
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
      {isLoading ? <div className="empty-state">جار تحميل الفيديوهات...</div> : null}

      {!isLoading && playlists.length > 0 ? (
        <div className="playlist-stack overflow-x-hidden">
          {playlists.map((playlist) => (
            <Playlist key={playlist.id} playlist={playlist} canOpen={Boolean(user)} />
          ))}
        </div>
      ) : null}

      {!isLoading && videos.length === 0 ? (
        <div className="empty-state">لا توجد فيديوهات منشورة حاليا.</div>
      ) : null}

      {!isLoading && videos.length > 0 ? (
        <section className="overflow-x-hidden">
          <div className="section-head">
            <div>
              <h2>أحدث الفيديوهات</h2>
              <p>المحتوى المنشور يظهر هنا حسب الأحدث أولا.</p>
            </div>
          </div>

          <div className="video-grid">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} canOpen={Boolean(user)} showStats={Boolean(user)} />
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
