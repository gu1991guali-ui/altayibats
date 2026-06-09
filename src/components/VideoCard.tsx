import { Heart, MessageCircle, Play } from "lucide-react";
import { Link } from "react-router-dom";
import type { VideoSummary } from "@/lib/types";

type VideoCardProps = {
  video: VideoSummary;
  canOpen: boolean;
  showStats: boolean;
};

function getCategoryLabel(video: VideoSummary) {
  return video.category?.trim() || (video.video_type === "short" ? "عمودي" : "أفقي");
}

export function VideoCard({ video, canOpen, showStats }: VideoCardProps) {
  const href = `/videos/${video.id}`;
  const isShortVideo = video.video_type === "short";

  return (
    <article className={`video-card transition-all duration-200 ${isShortVideo ? "short" : "long"}`}>
      <Link to={href} className="thumbnail-link" aria-label={`مشاهدة ${video.title}`}>
        <div className={`thumbnail ${isShortVideo ? "short aspect-[9/16]" : "long aspect-video"}`}>
          {video.thumbnail_url ? (
            <img className="w-full h-full object-cover" src={video.thumbnail_url} alt="" loading="lazy" decoding="async" />
          ) : (
            <div className="thumbnail-empty">
              <Play size={34} aria-hidden="true" />
            </div>
          )}
          <span className="play-badge">
            <Play size={16} aria-hidden="true" />
          </span>
          {isShortVideo ? <span className="short-badge">قصير</span> : null}
        </div>
      </Link>

      <div className="video-card-body">
        <Link to={href} className="video-title">
          {video.title}
        </Link>
        <span className={isShortVideo ? "type-badge short" : "type-badge"}>{getCategoryLabel(video)}</span>
        {video.description ? <p>{video.description}</p> : null}

        <div className="video-direct-watch">
          <Play size={14} aria-hidden="true" />
          مشاهدة مباشرة
        </div>

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
    </article>
  );
}
