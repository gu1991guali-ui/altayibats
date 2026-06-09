import { GripVertical, Pencil, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { StatusMessage } from "@/components/StatusMessage";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { PlaylistRecord, PlaylistVideoRecord, VideoRecord, VideoSummary, VideoType } from "@/lib/types";
import { enrichVideos, safeFileExtension } from "@/lib/video-utils";

type AdminPlaylistItem = PlaylistVideoRecord & {
  video: VideoSummary | null;
};

type AdminPlaylist = PlaylistRecord & {
  items: AdminPlaylistItem[];
};

type AdminPageCache = {
  videos: VideoSummary[];
  playlists: AdminPlaylist[];
};

type AnalyticsTopPage = {
  path: string;
  page_views: number;
  visitors: number;
};

type AnalyticsLatestVisit = {
  path: string;
  visitor_id: string;
  created_at: string;
};

type SiteAnalyticsSummary = {
  total_page_views: number;
  total_visitors: number;
  page_views_today: number;
  visitors_today: number;
  page_views_7_days: number;
  visitors_7_days: number;
  page_views_30_days: number;
  visitors_30_days: number;
  top_pages: AnalyticsTopPage[];
  latest_visits: AnalyticsLatestVisit[];
};

let adminPageCache: AdminPageCache | null = null;

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "حدث خطأ غير متوقع.";
}

function databaseSetupMessage(action: string, details?: string) {
  const suffix = details ? ` التفاصيل التقنية: ${details}` : "";
  return `${action} شغّل ملف database/01_REPAIR_PLAYLISTS_SCHEMA_CACHE.sql من Supabase SQL Editor، ثم أعد تحميل صفحة الإدارة واضغط تحديث.${suffix}`;
}

function analyticsSetupMessage(details?: string) {
  const suffix = details ? ` التفاصيل التقنية: ${details}` : "";
  return `عداد الزيارات غير مفعّل بعد. شغّل ملف database/02_ADD_VISIT_ANALYTICS.sql من Supabase SQL Editor، ثم أعد تحميل لوحة الإدارة.${suffix}`;
}

function normalizeAnalytics(value: unknown): SiteAnalyticsSummary {
  const data = (value ?? {}) as Partial<SiteAnalyticsSummary>;
  const pageViewsToday = Number(data.page_views_today ?? 0);
  const visitorsToday = Number(data.visitors_today ?? 0);
  const pageViews7Days = Number(data.page_views_7_days ?? 0);
  const visitors7Days = Number(data.visitors_7_days ?? 0);
  const pageViews30Days = Number(data.page_views_30_days ?? 0);
  const visitors30Days = Number(data.visitors_30_days ?? 0);

  return {
    total_page_views: Math.max(Number(data.total_page_views ?? 0), pageViews30Days),
    total_visitors: Math.max(Number(data.total_visitors ?? 0), visitors30Days),
    page_views_today: pageViewsToday,
    visitors_today: visitorsToday,
    page_views_7_days: pageViews7Days,
    visitors_7_days: visitors7Days,
    page_views_30_days: pageViews30Days,
    visitors_30_days: visitors30Days,
    top_pages: Array.isArray(data.top_pages) ? data.top_pages : [],
    latest_visits: Array.isArray(data.latest_visits) ? data.latest_visits : []
  };
}

function formatAdminNumber(value: number) {
  return value.toLocaleString("ar-EG");
}

function formatAdminDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function readablePath(path: string, videos: VideoSummary[]) {
  if (!path || path === "/") {
    return "الصفحة الرئيسية";
  }

  if (path === "/legal") {
    return "الخصوصية والشروط";
  }

  const videoId = path.match(/^\/videos\/([^/?#]+)/)?.[1];

  if (videoId) {
    const video = videos.find((item) => item.id === videoId);
    return video ? `فيديو: ${video.title}` : "صفحة فيديو";
  }

  return path;
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
  const [videos, setVideos] = useState<VideoSummary[]>(adminPageCache?.videos ?? []);
  const [playlists, setPlaylists] = useState<AdminPlaylist[]>(adminPageCache?.playlists ?? []);
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
  const [playlistTitle, setPlaylistTitle] = useState("");
  const [playlistDescription, setPlaylistDescription] = useState("");
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [editPlaylistTitle, setEditPlaylistTitle] = useState("");
  const [editPlaylistDescription, setEditPlaylistDescription] = useState("");
  const [selectedVideos, setSelectedVideos] = useState<Record<string, string>>({});
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!adminPageCache);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState<SiteAnalyticsSummary | null>(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);

  const loadAnalytics = useCallback(async () => {
    if (!isSupabaseConfigured || !isAdmin) {
      setAnalytics(null);
      return;
    }

    setIsAnalyticsLoading(true);
    setAnalyticsError("");

    const { data, error: analyticsLoadError } = await supabase.rpc("get_site_analytics");

    if (analyticsLoadError) {
      setAnalytics(null);
      setAnalyticsError(analyticsSetupMessage(analyticsLoadError.message));
      setIsAnalyticsLoading(false);
      return;
    }

    setAnalytics(normalizeAnalytics(data));
    setIsAnalyticsLoading(false);
  }, [isAdmin]);

  const loadVideos = useCallback(async (force = false) => {
    if (adminPageCache && !force) {
      setVideos(adminPageCache.videos);
      setIsLoading(false);
      return adminPageCache.videos;
    }

    if (!isSupabaseConfigured || !isAdmin) {
      setIsLoading(false);
      return [];
    }

    setIsLoading(!adminPageCache);
    setError("");

    const { data, error: videosError } = await supabase.from("videos").select("*").order("created_at", { ascending: false });

    if (videosError) {
      setError("تعذر تحميل قائمة الفيديوهات.");
      if (!adminPageCache) {
        setVideos([]);
      }
      setIsLoading(false);
      return [];
    }

    const nextVideos = await enrichVideos((data ?? []) as VideoRecord[], false);
    setVideos(nextVideos);
    adminPageCache = { videos: nextVideos, playlists: adminPageCache?.playlists ?? [] };
    setIsLoading(false);
    return nextVideos;
  }, [isAdmin]);

  const loadPlaylists = useCallback(async (force = false) => {
    if (adminPageCache && !force) {
      setPlaylists(adminPageCache.playlists);
      return adminPageCache.playlists;
    }

    if (!isSupabaseConfigured || !isAdmin) {
      return [];
    }

    const { data: playlistRows, error: playlistsError } = await supabase
      .from("playlists")
      .select("*")
      .order("created_at", { ascending: false });

    if (playlistsError) {
      if (!adminPageCache) {
        setPlaylists([]);
      }
      setError(databaseSetupMessage("تعذر تحميل قوائم التشغيل.", playlistsError.message));
      return [];
    }

    const playlistRecords = (playlistRows ?? []) as PlaylistRecord[];

    if (playlistRecords.length === 0) {
      setPlaylists([]);
      adminPageCache = { videos: adminPageCache?.videos ?? [], playlists: [] };
      return [];
    }

    const { data: joinRows, error: joinsError } = await supabase
      .from("playlist_videos")
      .select("*")
      .in("playlist_id", playlistRecords.map((playlist) => playlist.id))
      .order("position", { ascending: true });

    if (joinsError) {
      const nextPlaylists = playlistRecords.map((playlist) => ({ ...playlist, items: [] }));
      setPlaylists(nextPlaylists);
      adminPageCache = { videos: adminPageCache?.videos ?? [], playlists: nextPlaylists };
      setError(databaseSetupMessage("تعذر تحميل عناصر قوائم التشغيل.", joinsError.message));
      return nextPlaylists;
    }

    const joins = (joinRows ?? []) as PlaylistVideoRecord[];
    const videoIds = Array.from(new Set(joins.map((join) => join.video_id)));
    const videoMap = new Map<string, VideoSummary>();

    if (videoIds.length > 0) {
      const { data: videoRows } = await supabase.from("videos").select("*").in("id", videoIds);
      (await enrichVideos((videoRows ?? []) as VideoRecord[], false)).forEach((video) => videoMap.set(video.id, video));
    }

    const nextPlaylists = playlistRecords.map((playlist) => ({
      ...playlist,
      items: joins
        .filter((join) => join.playlist_id === playlist.id)
        .sort((first, second) => first.position - second.position)
        .map((join) => ({ ...join, video: videoMap.get(join.video_id) ?? null }))
    }));

    setPlaylists(nextPlaylists);
    adminPageCache = { videos: adminPageCache?.videos ?? [], playlists: nextPlaylists };
    return nextPlaylists;
  }, [isAdmin]);

  const reloadAll = useCallback(async (force = false) => {
    const [nextVideos, nextPlaylists] = await Promise.all([loadVideos(force), loadPlaylists(force)]);
    await loadAnalytics();

    if (isSupabaseConfigured && isAdmin) {
      adminPageCache = { videos: nextVideos, playlists: nextPlaylists };
    }
  }, [isAdmin, loadAnalytics, loadPlaylists, loadVideos]);

  useEffect(() => {
    if (isSupabaseConfigured && !authLoading && !user) {
      navigate("/login?redirect=/admin", { replace: true });
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (!authLoading) {
      void reloadAll();
    }
  }, [authLoading, reloadAll]);

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
      setError("اختر ملف فيديو صالحا.");
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
      await reloadAll(true);
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
      setMessage("تم تحديث بيانات الفيديو.");
      await reloadAll(true);
    } catch (updateError) {
      setError(errorMessage(updateError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(video: VideoSummary) {
    if (!window.confirm("هل تريد حذف الفيديو وكل تعليقاته وإعجاباته؟")) {
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
    await reloadAll(true);
    setIsSaving(false);
  }

  async function handleCreatePlaylist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || !isAdmin || !playlistTitle.trim()) {
      setError("عنوان قائمة التشغيل مطلوب.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    const { error: insertError } = await supabase.from("playlists").insert({
      title: playlistTitle.trim(),
      description: playlistDescription.trim() || null
    });

    setIsSaving(false);

    if (insertError) {
      setError(databaseSetupMessage("تعذر إنشاء قائمة التشغيل.", insertError.message));
      return;
    }

    setPlaylistTitle("");
    setPlaylistDescription("");
    setMessage("تم إنشاء قائمة التشغيل. أضف إليها فيديو واحداً على الأقل حتى تظهر في الصفحة الرئيسية.");
    await loadPlaylists(true);
  }

  async function handleDeletePlaylist(playlistId: string) {
    if (!window.confirm("هل تريد حذف قائمة التشغيل؟")) {
      return;
    }

    setIsSaving(true);
    const { error: deleteError } = await supabase.from("playlists").delete().eq("id", playlistId);
    setIsSaving(false);

    if (deleteError) {
      setError(databaseSetupMessage("تعذر حذف قائمة التشغيل.", deleteError.message));
      return;
    }

    setMessage("تم حذف قائمة التشغيل.");
    await loadPlaylists(true);
  }

  function startPlaylistEdit(playlist: AdminPlaylist) {
    setEditingPlaylistId(playlist.id);
    setEditPlaylistTitle(playlist.title);
    setEditPlaylistDescription(playlist.description ?? "");
    setError("");
    setMessage("");
  }

  async function handleUpdatePlaylist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingPlaylistId || !editPlaylistTitle.trim()) {
      setError("عنوان قائمة التشغيل مطلوب.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    const { error: updateError } = await supabase
      .from("playlists")
      .update({
        title: editPlaylistTitle.trim(),
        description: editPlaylistDescription.trim() || null
      })
      .eq("id", editingPlaylistId);

    setIsSaving(false);

    if (updateError) {
      setError(databaseSetupMessage("تعذر تعديل قائمة التشغيل.", updateError.message));
      return;
    }

    setEditingPlaylistId(null);
    setEditPlaylistTitle("");
    setEditPlaylistDescription("");
    setMessage("تم تعديل قائمة التشغيل.");
    await loadPlaylists(true);
  }

  async function handleAddPlaylistVideo(playlist: AdminPlaylist) {
    const videoId = selectedVideos[playlist.id];

    if (!videoId) {
      setError("اختر فيديو لإضافته.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    const nextPosition = playlist.items.length === 0 ? 1 : Math.max(...playlist.items.map((item) => item.position)) + 1;
    const { error: insertError } = await supabase.from("playlist_videos").insert({
      playlist_id: playlist.id,
      video_id: videoId,
      position: nextPosition
    });

    setIsSaving(false);

    if (insertError) {
      const duplicateHint = insertError.code === "23505" ? " هذا الفيديو موجود في القائمة مسبقاً." : "";
      setError(`${databaseSetupMessage("تعذر إضافة الفيديو إلى قائمة التشغيل.", insertError.message)}${duplicateHint}`);
      return;
    }

    setSelectedVideos((value) => ({ ...value, [playlist.id]: "" }));
    setMessage("تمت إضافة الفيديو إلى قائمة التشغيل. ستظهر القائمة في الصفحة الرئيسية بعد تحديثها.");
    await loadPlaylists(true);
  }

  async function handleRemovePlaylistVideo(itemId: string) {
    setIsSaving(true);
    const { error: deleteError } = await supabase.from("playlist_videos").delete().eq("id", itemId);
    setIsSaving(false);

    if (deleteError) {
      setError(databaseSetupMessage("تعذر إزالة الفيديو من القائمة.", deleteError.message));
      return;
    }

    await loadPlaylists(true);
  }

  async function reorderPlaylist(playlist: AdminPlaylist, targetItemId: string) {
    if (!draggedItemId || draggedItemId === targetItemId) {
      return;
    }

    const sourceIndex = playlist.items.findIndex((item) => item.id === draggedItemId);
    const targetIndex = playlist.items.findIndex((item) => item.id === targetItemId);

    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    const nextItems = [...playlist.items];
    const [moved] = nextItems.splice(sourceIndex, 1);
    nextItems.splice(targetIndex, 0, moved);

    setDraggedItemId(null);
    setIsSaving(true);
    const updates = await Promise.all(
      nextItems.map((item, index) => supabase.from("playlist_videos").update({ position: index + 1 }).eq("id", item.id))
    );
    setIsSaving(false);

    if (updates.some((result) => result.error)) {
      setError("تعذر حفظ ترتيب قائمة التشغيل.");
      return;
    }

    await loadPlaylists(true);
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
    <section className="overflow-x-hidden" dir="rtl">
      <div className="page-heading admin-heading">
        <span className="eyebrow">لوحة الإدارة</span>
        <h1>إدارة مكتبة الفيديوهات والزيارات</h1>
        <p>ارفع المحتوى، عدل بياناته، وأنشئ قوائم تشغيل، وتابع عدد زوار الموقع مباشرة.</p>
      </div>

      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
      {message ? <StatusMessage tone="success">{message}</StatusMessage> : null}

      <div className="admin-grid">
        <aside className="form-panel admin-form-panel">
          <h2>رفع فيديو جديد</h2>
          <form className="form-stack" onSubmit={handleUpload} key={formKey}>
            <div className="field">
              <label htmlFor="title">العنوان</label>
              <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required />
            </div>

            <div className="field">
              <label htmlFor="description">الوصف</label>
              <textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="videoType">نوع الفيديو</label>
              <select id="videoType" value={videoType} onChange={(event) => setVideoType(event.target.value as VideoType)}>
                <option value="long">فيديو أفقي 16:9</option>
                <option value="short">فيديو عمودي 9:16</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="videoFile">ملف الفيديو</label>
              <input id="videoFile" type="file" accept="video/*" onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)} required />
            </div>

            <div className="field">
              <label htmlFor="thumbnailFile">الصورة المصغرة</label>
              <input id="thumbnailFile" type="file" accept="image/*" onChange={(event) => setThumbnailFile(event.target.files?.[0] ?? null)} />
            </div>

            <button className="button transition-all duration-200" type="submit" disabled={isSaving}>
              <UploadCloud size={17} aria-hidden="true" />
              {isSaving ? "جار الحفظ..." : "رفع الفيديو"}
            </button>
          </form>

          {editing ? (
            <form className="form-stack edit-stack" onSubmit={handleUpdate}>
              <h2>تعديل الفيديو</h2>
              <div className="field">
                <label htmlFor="editTitle">العنوان</label>
                <input id="editTitle" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="editDescription">الوصف</label>
                <textarea id="editDescription" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="editVideoType">نوع الفيديو</label>
                <select id="editVideoType" value={editVideoType} onChange={(event) => setEditVideoType(event.target.value as VideoType)}>
                  <option value="long">فيديو أفقي 16:9</option>
                  <option value="short">فيديو عمودي 9:16</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="editThumbnail">صورة مصغرة جديدة</label>
                <input id="editThumbnail" type="file" accept="image/*" onChange={(event) => setEditThumbnailFile(event.target.files?.[0] ?? null)} />
              </div>
              <div className="row-actions flex-wrap gap-3">
                <button className="button transition-all duration-200" type="submit" disabled={isSaving}>
                  حفظ التعديل
                </button>
                <button className="button ghost transition-all duration-200" type="button" onClick={() => setEditing(null)}>
                  إلغاء
                </button>
              </div>
            </form>
          ) : null}
        </aside>

        <div className="admin-main-stack overflow-x-hidden">
          <section className="content-panel analytics-panel overflow-x-hidden">
            <div className="section-head compact">
              <div>
                <span className="eyebrow">إحصاءات الزوار</span>
                <h2>عداد زيارات الموقع</h2>
                <p>يعرض الزيارات العامة فقط، ولا يحتسب صفحات الإدارة أو تسجيل الدخول.</p>
              </div>
              <button className="button secondary button-small transition-all duration-200" type="button" onClick={() => loadAnalytics()}>
                <RefreshCw size={16} aria-hidden="true" />
                تحديث العداد
              </button>
            </div>

            {analyticsError ? <StatusMessage tone="error">{analyticsError}</StatusMessage> : null}

            {isAnalyticsLoading && !analytics ? (
              <div className="empty-state compact-empty">جار تحميل إحصاءات الزوار...</div>
            ) : null}

            {analytics ? (
              <>
                <div className="analytics-stat-grid" aria-label="ملخص زيارات الموقع">
                  <article className="analytics-stat-card">
                    <span className="analytics-stat-icon">ز</span>
                    <strong>{formatAdminNumber(analytics.total_visitors)}</strong>
                    <p>إجمالي الزوار</p>
                  </article>
                  <article className="analytics-stat-card">
                    <span className="analytics-stat-icon">ك</span>
                    <strong>{formatAdminNumber(analytics.total_page_views)}</strong>
                    <p>إجمالي الزيارات</p>
                  </article>
                  <article className="analytics-stat-card">
                    <span className="analytics-stat-icon">ي</span>
                    <strong>{formatAdminNumber(analytics.visitors_today)}</strong>
                    <p>زوار اليوم</p>
                  </article>
                  <article className="analytics-stat-card">
                    <span className="analytics-stat-icon">ص</span>
                    <strong>{formatAdminNumber(analytics.page_views_today)}</strong>
                    <p>زيارات اليوم</p>
                  </article>
                  <article className="analytics-stat-card">
                    <span className="analytics-stat-icon">7</span>
                    <strong>{formatAdminNumber(analytics.visitors_7_days)}</strong>
                    <p>زوار آخر 7 أيام</p>
                  </article>
                  <article className="analytics-stat-card">
                    <span className="analytics-stat-icon">↗</span>
                    <strong>{formatAdminNumber(analytics.page_views_7_days)}</strong>
                    <p>زيارات آخر 7 أيام</p>
                  </article>
                  <article className="analytics-stat-card">
                    <span className="analytics-stat-icon">30</span>
                    <strong>{formatAdminNumber(analytics.visitors_30_days)}</strong>
                    <p>زوار آخر 30 يوم</p>
                  </article>
                  <article className="analytics-stat-card">
                    <span className="analytics-stat-icon">م</span>
                    <strong>{formatAdminNumber(analytics.page_views_30_days)}</strong>
                    <p>زيارات آخر 30 يوم</p>
                  </article>
                </div>

                <div className="analytics-details-grid">
                  <div className="analytics-box">
                    <h3>الصفحات الأكثر زيارة</h3>
                    {analytics.top_pages.length === 0 ? (
                      <p className="analytics-muted">لا توجد زيارات مسجلة بعد.</p>
                    ) : (
                      <ol className="analytics-list">
                        {analytics.top_pages.map((page) => (
                          <li key={page.path}>
                            <div>
                              <strong>{readablePath(page.path, videos)}</strong>
                              <span>{page.path}</span>
                            </div>
                            <em>{formatAdminNumber(page.page_views)} زيارة</em>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  <div className="analytics-box">
                    <h3>آخر الزيارات</h3>
                    {analytics.latest_visits.length === 0 ? (
                      <p className="analytics-muted">لا توجد زيارات حديثة.</p>
                    ) : (
                      <div className="analytics-list latest">
                        {analytics.latest_visits.map((visit, index) => (
                          <div className="analytics-latest-row" key={`${visit.created_at}-${visit.visitor_id}-${index}`}>
                            <strong>{readablePath(visit.path, videos)}</strong>
                            <span>{formatAdminDate(visit.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </section>

          <section className="content-panel overflow-x-hidden">
            <div className="section-head compact">
              <div>
                <h2>قوائم التشغيل</h2>
                <p>{playlists.length} قائمة قابلة للترتيب بالسحب والإفلات.</p>
              </div>
              <button className="button secondary button-small transition-all duration-200" type="button" onClick={() => reloadAll(true)}>
                <RefreshCw size={16} aria-hidden="true" />
                تحديث
              </button>
            </div>

            <form className="playlist-create-form" onSubmit={handleCreatePlaylist}>
              <div className="field">
                <label htmlFor="playlistTitle">عنوان القائمة</label>
                <input id="playlistTitle" value={playlistTitle} onChange={(event) => setPlaylistTitle(event.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="playlistDescription">وصف القائمة</label>
                <input id="playlistDescription" value={playlistDescription} onChange={(event) => setPlaylistDescription(event.target.value)} />
              </div>
              <button className="button transition-all duration-200" type="submit" disabled={isSaving}>
                إنشاء
              </button>
            </form>

            <div className="playlist-admin-list">
              {playlists.length === 0 ? <div className="empty-state compact-empty">لا توجد قوائم تشغيل بعد.</div> : null}
              {playlists.map((playlist) => (
                <article className="playlist-admin-card" key={playlist.id}>
                  {editingPlaylistId === playlist.id ? (
                    <form className="playlist-edit-form" onSubmit={handleUpdatePlaylist}>
                      <div className="field">
                        <label htmlFor={`edit-playlist-title-${playlist.id}`}>عنوان القائمة</label>
                        <input
                          id={`edit-playlist-title-${playlist.id}`}
                          value={editPlaylistTitle}
                          onChange={(event) => setEditPlaylistTitle(event.target.value)}
                          required
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`edit-playlist-description-${playlist.id}`}>وصف القائمة</label>
                        <input
                          id={`edit-playlist-description-${playlist.id}`}
                          value={editPlaylistDescription}
                          onChange={(event) => setEditPlaylistDescription(event.target.value)}
                        />
                      </div>
                      <div className="row-actions flex-wrap gap-3">
                        <button className="button button-small transition-all duration-200" type="submit" disabled={isSaving}>
                          حفظ
                        </button>
                        <button
                          className="button ghost button-small transition-all duration-200"
                          type="button"
                          onClick={() => setEditingPlaylistId(null)}
                        >
                          إلغاء
                        </button>
                      </div>
                    </form>
                  ) : null}
                  <div className="playlist-admin-head">
                    <div>
                      <h3>{playlist.title}</h3>
                      {playlist.description ? <p>{playlist.description}</p> : null}
                    </div>
                    <button className="button ghost button-small transition-all duration-200" type="button" onClick={() => startPlaylistEdit(playlist)}>
                      <Pencil size={15} aria-hidden="true" />
                      تعديل
                    </button>
                    <button className="button danger button-small transition-all duration-200" type="button" onClick={() => handleDeletePlaylist(playlist.id)} disabled={isSaving}>
                      <Trash2 size={15} aria-hidden="true" />
                      حذف
                    </button>
                  </div>

                  <div className="playlist-add-row">
                    <select value={selectedVideos[playlist.id] ?? ""} onChange={(event) => setSelectedVideos((value) => ({ ...value, [playlist.id]: event.target.value }))}>
                      <option value="">اختر فيديو</option>
                      {videos.map((video) => (
                        <option key={video.id} value={video.id}>
                          {video.title}
                        </option>
                      ))}
                    </select>
                    <button className="button secondary button-small transition-all duration-200" type="button" onClick={() => handleAddPlaylistVideo(playlist)} disabled={isSaving}>
                      إضافة
                    </button>
                  </div>

                  <div className="playlist-sort-list">
                    {playlist.items.length === 0 ? (
                      <div className="empty-state compact-empty playlist-admin-note">
                        هذه القائمة لن تظهر في الصفحة الرئيسية حتى تضيف إليها فيديو واحداً على الأقل.
                      </div>
                    ) : null}
                    {playlist.items.map((item) => (
                      <div
                        className="playlist-sort-row"
                        key={item.id}
                        draggable
                        onDragStart={() => setDraggedItemId(item.id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => reorderPlaylist(playlist, item.id)}
                      >
                        <GripVertical size={18} aria-hidden="true" />
                        <span>{item.position}</span>
                        <strong>{item.video?.title ?? "فيديو محذوف"}</strong>
                        <button className="button ghost button-small transition-all duration-200" type="button" onClick={() => handleRemovePlaylistVideo(item.id)} disabled={isSaving}>
                          إزالة
                        </button>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="content-panel overflow-x-hidden">
            <div className="section-head compact">
              <div>
                <h2>الفيديوهات</h2>
                <p>{videos.length} عنصر في المكتبة</p>
              </div>
            </div>

            <div className="admin-list">
              {videos.length === 0 ? <div className="empty-state">لا توجد فيديوهات.</div> : null}
              {videos.map((video) => (
                <article className="admin-video-row" key={video.id}>
                  <div className={`admin-thumb ${video.video_type === "short" ? "short aspect-[9/16]" : "long aspect-video"}`}>
                    {video.thumbnail_url ? <img className="w-full h-full object-cover" src={video.thumbnail_url} alt="" loading="lazy" decoding="async" /> : null}
                  </div>
                  <div className="admin-row-body">
                    <h3>{video.title}</h3>
                    {video.description ? <p>{video.description}</p> : null}
                    <div className="stats-line">
                      <span className={video.video_type === "short" ? "type-badge short" : "type-badge"}>{video.video_type === "short" ? "عمودي" : "أفقي"}</span>
                      <span>الإعجابات والتعليقات تظهر داخل صفحة الفيديو</span>
                    </div>
                    <div className="row-actions flex-wrap gap-3">
                      <button className="button ghost button-small transition-all duration-200" type="button" onClick={() => startEdit(video)}>
                        <Pencil size={15} aria-hidden="true" />
                        تعديل
                      </button>
                      <button className="button danger button-small transition-all duration-200" type="button" onClick={() => handleDelete(video)} disabled={isSaving}>
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
      </div>
    </section>
  );
}
