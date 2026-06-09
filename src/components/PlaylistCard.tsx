import { Heart, MessageCircle, Play } from "lucide-react";
import { Link } from "react-router-dom";
import type { VideoSummary } from "@/lib/types";

type PlaylistCardProps = {
  video: VideoSummary;
  canOpen?: boolean;
  showStats?: boolean;
};

function getCategoryLabel(video: VideoSummary) {
  return video.category?.trim() || (video.video_type === "short" ? "عمودي" : "أفقي");
}

export function PlaylistCard({ video, canOpen = true, showStats = false }: PlaylistCardProps) {
  const href = `/videos/${video.id}`;
  const isShortVideo = video.video_type === "short";

  return (
    <article className="playlist-card flex-shrink-0 transition-all duration-200">
      <Link to={href} className="playlist-card-link" aria-label={`مشاهدة ${video.title}`}>
        <div className={`playlist-card-thumb ${isShortVideo ? "short aspect-[9/16]" : "long aspect-video"}`}>
          {video.thumbnail_url ? (
            <img className="w-full h-full object-cover" src={video.thumbnail_url} alt="" loading="lazy" decoding="async" />
          ) : (
            <div className="thumbnail-empty">
              <Play size={30} aria-hidden="true" />
            </div>
          )}
          <span className="play-badge">
            <Play size={16} aria-hidden="true" />
          </span>
        </div>
        <div className="playlist-card-body">
          <span className={isShortVideo ? "type-badge short" : "type-badge"}>{getCategoryLabel(video)}</span>
          <h3>{video.title}</h3>
          {video.description ? <p>{video.description}</p> : null}
          {showStats && (video.likes_count > 0 || video.comments_count > 0) ? (
            <div className="video-meta">
              <span>
                <Heart size={15} aria-hidden="true" />
                {video.likes_count}
              </span>
              <span>
                <MessageCircle size={15} aria-hidden="true" />
                {video.comments_count}
              </span>
            </div>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
