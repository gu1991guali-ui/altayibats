import { Heart, MessageCircle, Pencil, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { StatusMessage } from "@/components/StatusMessage";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { VideoRecord, VideoSummary, VideoType } from "@/lib/types";
import { enrichVideos, safeFileExtension } from "@/lib/video-utils";

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "حدث خطأ غير متوقع.";
}

async function uploadObject(bucket: "videos" | "thumbnails", path: string, file: File) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false
  });

  if (error) {
    throw new Error(error.message);
  }
}

export function AdminPage() {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoType, setVideoType] = useState<VideoType>("long");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<VideoSummary | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVideoType, setEditVideoType] = useState<VideoType>("long");
  const [editThumbnailFile, setEditThumbnailFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadVideos = useCallback(async () => {
    if (!isSupabaseConfigured || !isAdmin) {
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
      setError("تعذر تحميل قائمة الفيديوهات.");
      setVideos([]);
      setIsLoading(false);
      return;
    }

    setVideos(await enrichVideos((data ?? []) as VideoRecord[]));
    setIsLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    if (isSupabaseConfigured && !authLoading && !user) {
      navigate("/login?redirect=/admin", { replace: true });
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (!authLoading) {
      void loadVideos();
    }
  }, [authLoading, loadVideos]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || !isAdmin) {
      setError("هذه العملية متاحة للمدير فقط.");
      return;
    }

    if (!title.trim() || !videoFile) {
      setError("العنوان وملف الفيديو مطلوبان.");
      return;
    }

    if (!videoFile.type.startsWith("video/")) {
      setError("اختر ملف فيديو صالحًا.");
      return;
    }

    if (thumbnailFile && !thumbnailFile.type.startsWith("image/")) {
      setError("الصورة المصغرة يجب أن تكون ملف صورة.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    let videoPath = "";
    let thumbnailPath: string | null = null;

    try {
      videoPath = `${user.id}/${randomId()}.${safeFileExtension(videoFile.name, "mp4")}`;
      await uploadObject("videos", videoPath, videoFile);

      if (thumbnailFile) {
        thumbnailPath = `${user.id}/${randomId()}.${safeFileExtension(thumbnailFile.name, "jpg")}`;
        await uploadObject("thumbnails", thumbnailPath, thumbnailFile);
      }

      const { error: insertError } = await supabase.from("videos").insert({
        title: title.trim(),
        description: description.trim() || null,
        video_type: videoType,
        video_path: videoPath,
        thumbnail_path: thumbnailPath,
        created_by: user.id
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      setTitle("");
      setDescription("");
      setVideoType("long");
      setVideoFile(null);
      setThumbnailFile(null);
      setFormKey((value) => value + 1);
      setMessage("تم رفع الفيديو بنجاح.");
      await loadVideos();
    } catch (uploadError) {
      if (videoPath) {
        await supabase.storage.from("videos").remove([videoPath]);
      }

      if (thumbnailPath) {
        await supabase.storage.from("thumbnails").remove([thumbnailPath]);
      }

      setError(errorMessage(uploadError));
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(video: VideoSummary) {
    setEditing(video);
    setEditTitle(video.title);
    setEditDescription(video.description ?? "");
    setEditVideoType(video.video_type);
    setEditThumbnailFile(null);
    setError("");
    setMessage("");
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editing) {
      return;
    }

    if (!editTitle.trim()) {
      setError("عنوان الفيديو مطلوب.");
      return;
    }

    if (editThumbnailFile && !editThumbnailFile.type.startsWith("image/")) {
      setError("الصورة المصغرة يجب أن تكون ملف صورة.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    let nextThumbnailPath = editing.thumbnail_path;

    try {
      if (editThumbnailFile && user) {
        nextThumbnailPath = `${user.id}/${randomId()}.${safeFileExtension(editThumbnailFile.name, "jpg")}`;
        await uploadObject("thumbnails", nextThumbnailPath, editThumbnailFile);
      }

      const { error: updateError } = await supabase
        .from("videos")
        .update({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          video_type: editVideoType,
          thumbnail_path: nextThumbnailPath
        })
        .eq("id", editing.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      if (editThumbnailFile && editing.thumbnail_path && nextThumbnailPath !== editing.thumbnail_path) {
        await supabase.storage.from("thumbnails").remove([editing.thumbnail_path]);
      }

      setEditing(null);
      setEditThumbnailFile(null);
      setMessage("تم تحديث بيانات الفيديو.");
      await loadVideos();
    } catch (updateError) {
      if (editThumbnailFile && nextThumbnailPath && nextThumbnailPath !== editing.thumbnail_path) {
        await supabase.storage.from("thumbnails").remove([nextThumbnailPath]);
      }

      setError(errorMessage(updateError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(video: VideoSummary) {
    const confirmed = window.confirm("هل تريد حذف الفيديو وكل تعليقاته وإعجاباته؟");

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    const { error: deleteError } = await supabase.from("videos").delete().eq("id", video.id);

    if (deleteError) {
      setError("تعذر حذف الفيديو.");
      setIsSaving(false);
      return;
    }

    await supabase.storage.from("videos").remove([video.video_path]);

    if (video.thumbnail_path) {
      await supabase.storage.from("thumbnails").remove([video.thumbnail_path]);
    }

    setMessage("تم حذف الفيديو.");
    await loadVideos();
    setIsSaving(false);
  }

  if (!isSupabaseConfigured) {
    return (
      <StatusMessage title="إعداد Supabase مطلوب" tone="error">
        أضف القيم في ملف .env.local قبل استخدام لوحة التحكم.
      </StatusMessage>
    );
  }

  if (authLoading || isLoading) {
    return <div className="empty-state">جار تحميل لوحة التحكم...</div>;
  }

  if (!isAdmin) {
    return <StatusMessage tone="error">لا تملك صلاحية الوصول إلى لوحة التحكم.</StatusMessage>;
  }

  return (
    <section>
      <div className="page-heading">
        <h1>لوحة التحكم</h1>
        <p>إدارة الفيديوهات المنشورة وبياناتها وعدد التعليقات والإعجابات.</p>
      </div>

      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
      {message ? <StatusMessage tone="success">{message}</StatusMessage> : null}

      <div className="admin-grid">
        <aside className="form-panel">
          <h2>رفع فيديو جديد</h2>
          <form className="form-stack" onSubmit={handleUpload} key={formKey}>
            <div className="field">
              <label htmlFor="title">العنوان</label>
              <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required />
            </div>

            <div className="field">
              <label htmlFor="description">الوصف</label>
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="videoType">نوع الفيديو</label>
              <select
                id="videoType"
                value={videoType}
                onChange={(event) => setVideoType(event.target.value as VideoType)}
              >
                <option value="long">فيديو طويل 16:9</option>
                <option value="short">فيديو قصير 9:16</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="videoFile">ملف الفيديو</label>
              <input
                id="videoFile"
                type="file"
                accept="video/*"
                onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="thumbnailFile">الصورة المصغرة</label>
              <input
                id="thumbnailFile"
                type="file"
                accept="image/*"
                onChange={(event) => setThumbnailFile(event.target.files?.[0] ?? null)}
              />
            </div>

            <button className="button" type="submit" disabled={isSaving}>
              <UploadCloud size={17} aria-hidden="true" />
              {isSaving ? "جار الرفع..." : "رفع الفيديو"}
            </button>
          </form>

          {editing ? (
            <form className="form-stack" onSubmit={handleUpdate} style={{ marginTop: 24 }}>
              <h2>تعديل الفيديو</h2>
              <div className="field">
                <label htmlFor="editTitle">العنوان</label>
                <input
                  id="editTitle"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="editDescription">الوصف</label>
                <textarea
                  id="editDescription"
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="editVideoType">نوع الفيديو</label>
                <select
                  id="editVideoType"
                  value={editVideoType}
                  onChange={(event) => setEditVideoType(event.target.value as VideoType)}
                >
                  <option value="long">فيديو طويل 16:9</option>
                  <option value="short">فيديو قصير 9:16</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="editThumbnail">صورة مصغرة جديدة</label>
                <input
                  id="editThumbnail"
                  type="file"
                  accept="image/*"
                  onChange={(event) => setEditThumbnailFile(event.target.files?.[0] ?? null)}
                />
              </div>

              <div className="row-actions">
                <button className="button" type="submit" disabled={isSaving}>
                  حفظ التعديل
                </button>
                <button className="button ghost" type="button" onClick={() => setEditing(null)}>
                  إلغاء
                </button>
              </div>
            </form>
          ) : null}
        </aside>

        <section className="content-panel">
          <div className="engagement-bar" style={{ marginBottom: 16 }}>
            <h2>الفيديوهات</h2>
            <button className="button secondary button-small" type="button" onClick={loadVideos}>
              <RefreshCw size={16} aria-hidden="true" />
              تحديث
            </button>
          </div>

          <div className="admin-list">
            {videos.length === 0 ? <div className="empty-state">لا توجد فيديوهات.</div> : null}

            {videos.map((video) => (
              <article className="admin-video-row" key={video.id}>
                <div className={`admin-thumb ${video.video_type === "short" ? "short" : "long"}`}>
                  {video.thumbnail_url ? <img src={video.thumbnail_url} alt="" /> : null}
                </div>

                <div className="admin-row-body">
                  <h3>{video.title}</h3>
                  {video.description ? <p>{video.description}</p> : null}

                  <div className="stats-line">
                    <span className={video.video_type === "short" ? "type-badge short" : "type-badge"}>
                      {video.video_type === "short" ? "قصير" : "طويل"}
                    </span>
                    <span>
                      <Heart size={15} aria-hidden="true" /> {video.likes_count} إعجاب
                    </span>
                    <span>
                      <MessageCircle size={15} aria-hidden="true" /> {video.comments_count} تعليق
                    </span>
                  </div>

                  <div className="row-actions">
                    <button className="button ghost button-small" type="button" onClick={() => startEdit(video)}>
                      <Pencil size={15} aria-hidden="true" />
                      تعديل
                    </button>
                    <button
                      className="button danger button-small"
                      type="button"
                      onClick={() => handleDelete(video)}
                      disabled={isSaving}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      حذف
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
