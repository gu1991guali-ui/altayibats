import { supabase } from "@/lib/supabase";
import type { VideoRecord, VideoSummary } from "@/lib/types";

export function getThumbnailUrl(path: string | null) {
  if (!path) {
    return null;
  }

  return supabase.storage.from("thumbnails").getPublicUrl(path).data.publicUrl;
}

export async function countRows(table: "comments" | "likes", videoId: string) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("video_id", videoId);

  if (error) {
    return 0;
  }

  return count ?? 0;
}

export async function enrichVideos(videos: VideoRecord[], includeCounts = true): Promise<VideoSummary[]> {
  return Promise.all(
    videos.map(async (video) => {
      const [likes_count, comments_count] = includeCounts
        ? await Promise.all([countRows("likes", video.id), countRows("comments", video.id)])
        : [0, 0];

      return {
        ...video,
        thumbnail_url: getThumbnailUrl(video.thumbnail_path),
        likes_count,
        comments_count
      };
    })
  );
}

export function safeFileExtension(fileName: string, fallback: string) {
  const extension = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return extension || fallback;
}
