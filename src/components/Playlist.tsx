import type { PlaylistWithVideos } from "@/lib/types";
import { PlaylistCard } from "@/components/PlaylistCard";

type PlaylistProps = {
  playlist: PlaylistWithVideos;
  canOpen?: boolean;
};

function formatVideoCount(count: number) {
  if (count === 1) {
    return "فيديو واحد";
  }

  if (count === 2) {
    return "فيديوهان";
  }

  if (count <= 10) {
    return `${count} فيديوهات`;
  }

  return `${count} فيديو`;
}

export function Playlist({ playlist, canOpen = true }: PlaylistProps) {
  if (playlist.videos.length === 0) {
    return null;
  }

  return (
    <section className="playlist-section overflow-x-hidden" dir="rtl">
      <div className="section-head compact playlist-section-head">
        <div>
          <h2>{playlist.title}</h2>
          {playlist.description ? <p>{playlist.description}</p> : null}
        </div>

        <span className="playlist-count-badge">{formatVideoCount(playlist.videos.length)}</span>
      </div>

      <div className="playlist-slider flex gap-4 overflow-x-auto flex-shrink-0">
        {playlist.videos.map((video) => (
          <PlaylistCard key={`${playlist.id}-${video.id}`} video={video} canOpen={canOpen} />
        ))}
      </div>
    </section>
  );
}
