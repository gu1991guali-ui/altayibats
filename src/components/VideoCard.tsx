import { Heart, MessageCircle, Play } from "lucide-react";
import { Link } from "react-router-dom";
import type { VideoSummary } from "@/lib/types";

type VideoCardProps = {
  video: VideoSummary;
  canOpen: boolean;
  showStats: boolean;
};

export function VideoCard({ video, canOpen, showStats }: VideoCardProps) {
  const href = canOpen ? `/videos/${video.id}` : `/login?redirect=/videos/${video.id}`;
  const isShortVideo = video.video_type === "short";

  return (
    <article className={`video-card ${isShortVideo ? "short" : "long"}`}>
      <Link to={href} className="thumbnail-link" aria-label={`مشاهدة ${video.title}`}>
        <div className={`thumbnail ${isShortVideo ? "short" : "long"}`}>
          {video.thumbnail_url ? (
            <img src={video.thumbnail_url} alt="" />
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
        {video.description ? <p>{video.description}</p> : null}

        {showStats ? (
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
