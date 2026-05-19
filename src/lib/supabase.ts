import { createClient } from "@supabase/supabase-js";
import type { PlaylistRecord, PlaylistVideoRecord, PlaylistWithVideos, VideoRecord } from "@/lib/types";
import { enrichVideos } from "@/lib/video-utils";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || "https://example.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

export async function fetchPlaylistsWithVideos(includeCounts = true): Promise<PlaylistWithVideos[]> {
  const { data: playlistRows, error: playlistsError } = await supabase
    .from("playlists")
    .select("*")
    .order("created_at", { ascending: false });

  if (playlistsError) {
    throw playlistsError;
  }

  const playlists = (playlistRows ?? []) as PlaylistRecord[];

  if (playlists.length === 0) {
    return [];
  }

  const playlistIds = playlists.map((playlist) => playlist.id);
  const { data: joinRows, error: joinError } = await supabase
    .from("playlist_videos")
    .select("*")
    .in("playlist_id", playlistIds)
    .order("position", { ascending: true });

  if (joinError) {
    throw joinError;
  }

  const playlistVideos = (joinRows ?? []) as PlaylistVideoRecord[];
  const videoIds = Array.from(new Set(playlistVideos.map((row) => row.video_id)));

  if (videoIds.length === 0) {
    return playlists.map((playlist) => ({ ...playlist, videos: [] }));
  }

  const { data: videoRows, error: videosError } = await supabase.from("videos").select("*").in("id", videoIds);

  if (videosError) {
    throw videosError;
  }

  const enrichedVideos = await enrichVideos((videoRows ?? []) as VideoRecord[], includeCounts);
  const videosById = new Map(enrichedVideos.map((video) => [video.id, video]));
  const joinsByPlaylist = new Map<string, PlaylistVideoRecord[]>();

  playlistVideos.forEach((row) => {
    const rows = joinsByPlaylist.get(row.playlist_id) ?? [];
    rows.push(row);
    joinsByPlaylist.set(row.playlist_id, rows);
  });

  return playlists.map((playlist) => ({
    ...playlist,
    videos: (joinsByPlaylist.get(playlist.id) ?? [])
      .sort((first, second) => first.position - second.position)
      .map((row) => videosById.get(row.video_id))
      .filter((video): video is PlaylistWithVideos["videos"][number] => Boolean(video))
  }));
}
