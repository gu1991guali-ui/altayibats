import { Heart, MessageCircle, Pencil, Play, Send, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { StatusMessage } from "@/components/StatusMessage";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type {
  CaptionTrack,
  CommentRecord,
  CommentWithAuthor,
  PublicProfile,
  TranslationMap,
  VideoRecord,
  VideoSummary
} from "@/lib/types";
import { countRows, enrichVideos } from "@/lib/video-utils";

type NormalizedCaption = {
  src: string;
  label: string;
  srcLang: string;
  isDefault: boolean;
};

const LANGUAGE_OPTIONS = [
  { value: "ar", label: "العربية" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" }
] as const;

type SupportedLanguage = (typeof LANGUAGE_OPTIONS)[number]["value"];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function getVideoCategory(video: Pick<VideoRecord, "category" | "video_type">) {
  return video.category?.trim() || (video.video_type === "short" ? "فيديو عمودي" : "فيديو أفقي");
}

function normalizeCaptions(video: VideoRecord): NormalizedCaption[] {
  const captions = Array.isArray(video.captions)
    ? video.captions
    : typeof video.captions === "string"
      ? parseJson<CaptionTrack[]>(video.captions) ?? [{ src: video.captions, label: "ترجمة", srclang: "ar" }]
      : [];

  const tracks = captions
    .map((caption, index) => {
      const src = caption.src || caption.url;

      if (!src) {
        return null;
      }

      const srcLang = caption.srclang || caption.lang || caption.language || "ar";

      return {
        src,
        label: caption.label || srcLang.toUpperCase(),
        srcLang,
        isDefault: Boolean(caption.default) || index === 0
      };
    })
    .filter((caption): caption is NormalizedCaption => Boolean(caption));

  if (tracks.length > 0) {
    return tracks;
  }

  return video.subtitle_url
    ? [{ src: video.subtitle_url, label: "العربية", srcLang: "ar", isDefault: true }]
    : [];
}

function normalizeTranslations(video: VideoRecord): TranslationMap {
  const translations =
    typeof video.translations === "string"
      ? parseJson<TranslationMap>(video.translations)
      : video.translations;

  return {
    ar: video.description ?? "",
    ...(translations ?? {})
  };
}

function SuggestedVideoCard({ video }: { video: VideoSummary }) {
  const isShortVideo = video.video_type === "short";

  return (
    <Link className="suggested-video-card transition-all duration-200" to={`/videos/${video.id}`}>
      <div className={`suggested-video-thumb ${isShortVideo ? "short" : "long"}`}>
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt="" />
        ) : (
          <div className="suggested-video-empty">
            <Play size={24} aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="suggested-video-body">
        <span className={isShortVideo ? "type-badge short" : "type-badge"}>{getVideoCategory(video)}</span>
        <h3>{video.title}</h3>
        <div className="video-meta suggested-video-meta">
          <span>
            <Heart size={14} aria-hidden="true" />
            {video.likes_count}
          </span>
          <span>
            <MessageCircle size={14} aria-hidden="true" />
            {video.comments_count}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function VideoDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const videoId = id ?? "";

  const [video, setVideo] = useState<VideoRecord | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [relatedVideos, setRelatedVideos] = useState<VideoSummary[]>([]);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>("ar");
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isActionBusy, setIsActionBusy] = useState(false);
  const [error, setError] = useState("");

  const captionTracks = useMemo(() => (video ? normalizeCaptions(video) : []), [video]);
  const translations = useMemo(() => (video ? normalizeTranslations(video) : {}), [video]);
  const selectedDescription = translations[selectedLanguage] || translations.ar || video?.description || "";

  const loadRelatedVideos = useCallback(async (currentVideo: VideoRecord) => {
    const { data, error: relatedError } = await supabase
      .from("videos")
      .select("*")
      .neq("id", currentVideo.id)
      .order("created_at", { ascending: false })
      .limit(12);

    if (relatedError) {
      setRelatedVideos([]);
      return;
    }

    const enriched = await enrichVideos((data ?? []) as VideoRecord[]);
    const currentCategory = getVideoCategory(currentVideo);
    const sameCategory = enriched.filter((item) => getVideoCategory(item) === currentCategory);
    const fallback = enriched.filter((item) => getVideoCategory(item) !== currentCategory);
    setRelatedVideos((sameCategory.length > 0 ? [...sameCategory, ...fallback] : enriched).slice(0, 8));
  }, []);

  const loadComments = useCallback(async () => {
    const { data, error: commentsError } = await supabase
      .from("comments")
      .select("*")
      .eq("video_id", videoId)
      .order("created_at", { ascending: false });

    if (commentsError) {
      setError("تعذر تحميل التعليقات.");
      return;
    }

    const rows = (data ?? []) as CommentRecord[];
    const userIds = Array.from(new Set(rows.map((comment) => comment.user_id)));
    const profiles = new Map<string, PublicProfile>();

    if (userIds.length > 0) {
      const { data: profileRows } = await supabase.from("user_public_profiles").select("*").in("id", userIds);
      ((profileRows ?? []) as PublicProfile[]).forEach((profile) => profiles.set(profile.id, profile));
    }

    setComments(rows.map((comment) => ({ ...comment, author: profiles.get(comment.user_id) ?? null })));
  }, [videoId]);

  const loadEngagement = useCallback(async () => {
    const [likes, commentTotal] = await Promise.all([countRows("likes", videoId), countRows("comments", videoId)]);
    setLikeCount(likes);
    setCommentCount(commentTotal);

    if (user) {
      const { data } = await supabase
        .from("likes")
        .select("id")
        .eq("video_id", videoId)
        .eq("user_id", user.id)
        .maybeSingle();
      setLiked(Boolean(data));
    }
  }, [user, videoId]);

  const loadVideo = useCallback(async () => {
    if (!videoId || !user) {
      return;
    }

    setIsLoading(true);
    setError("");

    const { data, error: videoError } = await supabase.from("videos").select("*").eq("id", videoId).maybeSingle<VideoRecord>();

    if (videoError || !data) {
      setError("الفيديو غير موجود أو لا يمكن الوصول إليه.");
      setIsLoading(false);
      return;
    }

    const { data: signedVideo, error: signedUrlError } = await supabase.storage
      .from("videos")
      .createSignedUrl(data.video_path, 60 * 60);

    if (signedUrlError || !signedVideo?.signedUrl) {
      setError("تعذر تجهيز رابط تشغيل الفيديو.");
      setIsLoading(false);
      return;
    }

    setVideo(data);
    setVideoUrl(signedVideo.signedUrl);
    await Promise.all([loadComments(), loadEngagement(), loadRelatedVideos(data)]);
    setIsLoading(false);
  }, [loadComments, loadEngagement, loadRelatedVideos, user, videoId]);

  useEffect(() => {
    if (isSupabaseConfigured && !authLoading && !user) {
      navigate(`/login?redirect=/videos/${videoId}`, { replace: true });
    }
  }, [authLoading, navigate, user, videoId]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    if (!authLoading && user) {
      void loadVideo();
    }
  }, [authLoading, loadVideo, user]);

  async function handleLike() {
    if (!user) {
      navigate(`/login?redirect=/videos/${videoId}`);
      return;
    }

    setIsActionBusy(true);
    setError("");

    const result = liked
      ? await supabase.from("likes").delete().eq("video_id", videoId).eq("user_id", user.id)
      : await supabase.from("likes").insert({ video_id: videoId, user_id: user.id });

    setIsActionBusy(false);

    if (result.error) {
      setError("تعذر تحديث الإعجاب.");
      return;
    }

    await loadEngagement();
  }

  async function handleAddComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      navigate(`/login?redirect=/videos/${videoId}`);
      return;
    }

    const content = newComment.trim();

    if (!content) {
      setError("اكتب تعليقا قبل الإرسال.");
      return;
    }

    setIsActionBusy(true);
    setError("");

    const { error: insertError } = await supabase.from("comments").insert({ video_id: videoId, user_id: user.id, content });
    setIsActionBusy(false);

    if (insertError) {
      setError("تعذر إضافة التعليق.");
      return;
    }

    setNewComment("");
    await Promise.all([loadComments(), loadEngagement()]);
  }

  async function handleUpdateComment(commentId: string) {
    const content = editingContent.trim();

    if (!content) {
      setError("لا يمكن حفظ تعليق فارغ.");
      return;
    }

    setIsActionBusy(true);
    setError("");

    const { error: updateError } = await supabase.from("comments").update({ content }).eq("id", commentId);
    setIsActionBusy(false);

    if (updateError) {
      setError("تعذر تعديل التعليق.");
      return;
    }

    setEditingId(null);
    setEditingContent("");
    await loadComments();
  }

  async function handleDeleteComment(commentId: string) {
    if (!window.confirm("هل تريد حذف هذا التعليق؟")) {
      return;
    }

    setIsActionBusy(true);
    setError("");

    const { error: deleteError } = await supabase.from("comments").delete().eq("id", commentId);
    setIsActionBusy(false);

    if (deleteError) {
      setError("تعذر حذف التعليق.");
      return;
    }

    await Promise.all([loadComments(), loadEngagement()]);
  }

  if (!isSupabaseConfigured) {
    return (
      <section className="video-detail-page max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 overflow-x-hidden" dir="rtl">
        <StatusMessage title="إعداد Supabase مطلوب" tone="error">
          أضف القيم في ملف .env.local لتشغيل صفحة الفيديو.
        </StatusMessage>
      </section>
    );
  }

  if (authLoading || isLoading) {
    return (
      <section className="video-detail-page max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 overflow-x-hidden" dir="rtl">
        <div className="empty-state">جار تحميل الفيديو...</div>
      </section>
    );
  }

  if (!video) {
    return (
      <section className="video-detail-page max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 overflow-x-hidden" dir="rtl">
        <StatusMessage tone="error">{error || "لم يتم العثور على الفيديو."}</StatusMessage>
      </section>
    );
  }

  const isShortVideo = video.video_type === "short";

  return (
    <section className="video-detail-page max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 overflow-x-hidden text-right" dir="rtl">
      <div className="video-watch-layout overflow-x-hidden">
        <main className="video-primary-column overflow-x-hidden">
          <div className="video-detail-layout overflow-x-hidden">
            {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}

            <div className="video-player-area overflow-x-hidden">
              <div
                className={`video-player-shell bg-black rounded-2xl overflow-hidden shadow-xl transition-all duration-200 ${
                  isShortVideo ? "video-player-shell-short max-w-[430px] aspect-[9/16]" : "video-player-shell-wide aspect-video"
                }`}
              >
                <video className="w-full h-full max-h-[80vh] object-contain" src={videoUrl} controls preload="metadata">
                  {captionTracks.map((track) => (
                    <track
                      key={`${track.srcLang}-${track.src}`}
                      kind="subtitles"
                      src={track.src}
                      srcLang={track.srcLang}
                      label={track.label}
                      default={track.isDefault}
                    />
                  ))}
                </video>
              </div>
              {/* TODO: Automatic multilingual subtitles require backend speech-to-text, translation, and VTT generation. */}
              {captionTracks.length === 0 ? <p className="caption-fallback-note">لا توجد ترجمة متاحة لهذا الفيديو حاليا.</p> : null}
            </div>

            <div className="content-panel video-info-card overflow-x-hidden">
              <div className="video-info-main">
                <span className={isShortVideo ? "type-badge short" : "type-badge"}>{getVideoCategory(video)}</span>
                <h1>{video.title}</h1>
                <div className="description-toolbar flex-wrap gap-3">
                  <label htmlFor="descriptionLanguage">لغة الوصف</label>
                  <select
                    id="descriptionLanguage"
                    value={selectedLanguage}
                    onChange={(event) => setSelectedLanguage(event.target.value as SupportedLanguage)}
                  >
                    {LANGUAGE_OPTIONS.map((language) => (
                      <option key={language.value} value={language.value}>
                        {language.label}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedDescription ? <p>{selectedDescription}</p> : null}
              </div>

              <div className="video-actions-row flex-wrap gap-3">
                <div className="video-meta video-meta-pills">
                  <span>
                    <Heart size={16} aria-hidden="true" />
                    {likeCount} إعجاب
                  </span>
                  <span>
                    <MessageCircle size={16} aria-hidden="true" />
                    {commentCount} تعليق
                  </span>
                </div>

                <div className="video-action-buttons flex-wrap gap-3">
                  <button className="button secondary transition-all duration-200" type="button" onClick={handleLike} disabled={isActionBusy}>
                    <Heart size={17} fill={liked ? "currentColor" : "none"} aria-hidden="true" />
                    {liked ? "إلغاء الإعجاب" : "إعجاب"}
                  </button>
                </div>
              </div>
            </div>

            <section className="content-panel video-comments-card overflow-x-hidden">
              <div className="section-head compact">
                <div>
                  <h2>التعليقات</h2>
                  <p>شارك رأيك أو تابع آراء المستخدمين.</p>
                </div>
              </div>

              <form className="form-stack" onSubmit={handleAddComment}>
                <div className="field">
                  <label htmlFor="comment">تعليق جديد</label>
                  <textarea
                    id="comment"
                    value={newComment}
                    onChange={(event) => setNewComment(event.target.value)}
                    maxLength={2000}
                    placeholder="اكتب تعليقك هنا"
                    required
                  />
                </div>
                <div className="form-actions flex-wrap gap-3">
                  <button className="button transition-all duration-200" type="submit" disabled={isActionBusy}>
                    <Send size={17} aria-hidden="true" />
                    إرسال
                  </button>
                </div>
              </form>

              <div className="comment-list">
                {comments.length === 0 ? <div className="empty-state">لا توجد تعليقات بعد.</div> : null}

                {comments.map((comment) => {
                  const canManage = comment.user_id === user?.id || isAdmin;
                  const authorName = comment.user_id === user?.id ? "أنت" : comment.author?.display_name || "مستخدم";

                  return (
                    <article className="comment-item" key={comment.id}>
                      <div className="comment-head">
                        <strong>{authorName}</strong>
                        <span>{formatDate(comment.created_at)}</span>
                      </div>

                      {editingId === comment.id ? (
                        <div className="form-stack">
                          <div className="field">
                            <textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} maxLength={2000} />
                          </div>
                          <div className="row-actions flex-wrap gap-3">
                            <button className="button button-small transition-all duration-200" type="button" onClick={() => handleUpdateComment(comment.id)} disabled={isActionBusy}>
                              حفظ
                            </button>
                            <button className="button ghost button-small transition-all duration-200" type="button" onClick={() => setEditingId(null)}>
                              إلغاء
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="comment-body">{comment.content}</p>
                      )}

                      {canManage && editingId !== comment.id ? (
                        <div className="row-actions flex-wrap gap-3">
                          {comment.user_id === user?.id ? (
                            <button
                              className="button ghost button-small transition-all duration-200"
                              type="button"
                              onClick={() => {
                                setEditingId(comment.id);
                                setEditingContent(comment.content);
                              }}
                            >
                              <Pencil size={15} aria-hidden="true" />
                              تعديل
                            </button>
                          ) : null}
                          <button className="button danger button-small transition-all duration-200" type="button" onClick={() => handleDeleteComment(comment.id)}>
                            <Trash2 size={15} aria-hidden="true" />
                            حذف
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        </main>

        <aside className="related-videos-panel overflow-x-hidden xl:sticky xl:top-20">
          <div className="related-videos-head">
            <h2>فيديوهات مقترحة</h2>
          </div>
          {relatedVideos.length > 0 ? (
            <div className="related-videos-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              {relatedVideos.map((item) => (
                <SuggestedVideoCard key={item.id} video={item} />
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty">لا توجد فيديوهات مقترحة حاليا.</div>
          )}
        </aside>
      </div>
    </section>
  );
}
