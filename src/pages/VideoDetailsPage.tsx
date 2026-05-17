import { Heart, MessageCircle, Pencil, Send, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { StatusMessage } from "@/components/StatusMessage";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type {
  CommentRecord,
  CommentWithAuthor,
  PublicProfile,
  VideoRecord
} from "@/lib/types";
import { countRows } from "@/lib/video-utils";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function VideoDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const videoId = id ?? "";

  const [video, setVideo] = useState<VideoRecord | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isActionBusy, setIsActionBusy] = useState(false);
  const [error, setError] = useState("");

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
      const { data: profileRows } = await supabase
        .from("user_public_profiles")
        .select("*")
        .in("id", userIds);

      ((profileRows ?? []) as PublicProfile[]).forEach((profile) => {
        profiles.set(profile.id, profile);
      });
    }

    setComments(
      rows.map((comment) => ({
        ...comment,
        author: profiles.get(comment.user_id) ?? null
      }))
    );
  }, [videoId]);

  const loadEngagement = useCallback(async () => {
    const [likes, commentTotal] = await Promise.all([
      countRows("likes", videoId),
      countRows("comments", videoId)
    ]);

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

    const { data, error: videoError } = await supabase
      .from("videos")
      .select("*")
      .eq("id", videoId)
      .maybeSingle<VideoRecord>();

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
    await Promise.all([loadComments(), loadEngagement()]);
    setIsLoading(false);
  }, [loadComments, loadEngagement, user, videoId]);

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
      setError("تعذر تحديث الإعجاب. لا يمكن تسجيل أكثر من إعجاب واحد لنفس الفيديو.");
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
      setError("اكتب تعليقاً قبل الإرسال.");
      return;
    }

    setIsActionBusy(true);
    setError("");

    const { error: insertError } = await supabase
      .from("comments")
      .insert({ video_id: videoId, user_id: user.id, content });

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

    const { error: updateError } = await supabase
      .from("comments")
      .update({ content })
      .eq("id", commentId);

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
    const confirmed = window.confirm("هل تريد حذف هذا التعليق؟");

    if (!confirmed) {
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
      <section className="video-detail-page max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <StatusMessage title="إعداد Supabase مطلوب" tone="error">
          أضف القيم في ملف .env.local لتشغيل صفحة الفيديو.
        </StatusMessage>
      </section>
    );
  }

  if (authLoading || isLoading) {
    return (
      <section className="video-detail-page max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="empty-state">جار تحميل الفيديو...</div>
      </section>
    );
  }

  if (!video) {
    return (
      <section className="video-detail-page max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <StatusMessage tone="error">{error || "لم يتم العثور على الفيديو."}</StatusMessage>
      </section>
    );
  }

  const isShortVideo = video.video_type === "short";

  return (
    <section className="video-detail-page max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
      <div className="video-detail-layout">
        {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}

        <div className="video-player-area">
          <div
            className={`video-player-shell bg-black rounded-2xl overflow-hidden shadow-xl ${
              isShortVideo ? "video-player-shell-short aspect-[9/16]" : "video-player-shell-wide aspect-video"
            }`}
          >
            <video
              className="w-full h-full max-h-[80vh] object-contain"
              src={videoUrl}
              controls
              preload="metadata"
            />
          </div>
        </div>

        <div className="content-panel video-info-card">
          <div className="video-info-main">
            <span className={isShortVideo ? "type-badge short" : "type-badge"}>
              {isShortVideo ? "فيديو عمودي" : "فيديو أفقي"}
            </span>
            <h1>{video.title}</h1>
            {video.description ? <p>{video.description}</p> : null}
          </div>

          <div className="video-actions-row">
            <div className="video-meta video-meta-pills" aria-label="إحصاءات الفيديو">
              <span>
                <Heart size={16} aria-hidden="true" />
                {likeCount} إعجاب
              </span>
              <span>
                <MessageCircle size={16} aria-hidden="true" />
                {commentCount} تعليق
              </span>
            </div>

            <div className="video-action-buttons">
              <button className="button secondary" type="button" onClick={handleLike} disabled={isActionBusy}>
                <Heart size={17} fill={liked ? "currentColor" : "none"} aria-hidden="true" />
                {liked ? "إلغاء الإعجاب" : "إعجاب"}
              </button>
            </div>
          </div>
        </div>

        <section className="content-panel video-comments-card">
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
            <div className="form-actions">
              <button className="button" type="submit" disabled={isActionBusy}>
                <Send size={17} aria-hidden="true" />
                إرسال
              </button>
            </div>
          </form>

          <div className="comment-list">
            {comments.length === 0 ? <div className="empty-state">لا توجد تعليقات بعد.</div> : null}

            {comments.map((comment) => {
              const canManage = comment.user_id === user?.id || isAdmin;
              const authorName =
                comment.user_id === user?.id
                  ? "أنت"
                  : comment.author?.display_name || "مستخدم";

              return (
                <article className="comment-item" key={comment.id}>
                  <div className="comment-head">
                    <strong>{authorName}</strong>
                    <span>{formatDate(comment.created_at)}</span>
                  </div>

                  {editingId === comment.id ? (
                    <div className="form-stack">
                      <div className="field">
                        <textarea
                          value={editingContent}
                          onChange={(event) => setEditingContent(event.target.value)}
                          maxLength={2000}
                        />
                      </div>
                      <div className="row-actions">
                        <button
                          className="button button-small"
                          type="button"
                          onClick={() => handleUpdateComment(comment.id)}
                          disabled={isActionBusy}
                        >
                          حفظ
                        </button>
                        <button
                          className="button ghost button-small"
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditingContent("");
                          }}
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="comment-body">{comment.content}</p>
                  )}

                  {canManage && editingId !== comment.id ? (
                    <div className="row-actions">
                      {comment.user_id === user?.id ? (
                        <button
                          className="button ghost button-small"
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

                      <button
                        className="button danger button-small"
                        type="button"
                        onClick={() => handleDeleteComment(comment.id)}
                      >
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
    </section>
  );
}
