export type UserRole = "user" | "admin";
export type VideoType = "long" | "short";

export type AppUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type PublicProfile = {
  id: string;
  display_name: string | null;
  role: UserRole;
};

export type VideoRecord = {
  id: string;
  title: string;
  description: string | null;
  video_type: VideoType;
  video_path: string;
  thumbnail_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VideoSummary = VideoRecord & {
  thumbnail_url: string | null;
  likes_count: number;
  comments_count: number;
};

export type CommentRecord = {
  id: string;
  video_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type CommentWithAuthor = CommentRecord & {
  author?: PublicProfile | null;
};
