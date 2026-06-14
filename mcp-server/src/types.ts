export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  featuredImage: string | null;
  status: "DRAFT" | "PUBLISHED" | "SCHEDULED";
  publishedAt: string | null;
  scheduledAt: string | null;
  readingTime: number;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  previewToken: string | null;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string; slug: string } | null;
  tags?: { id: string; name: string; slug: string }[];
  author?: { id: string; name: string } | null;
}

export interface PostListResponse {
  data: Post[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface Reaction {
  emoji: string;
  count: number;
  reacted: boolean;
}

export interface Comment {
  id: string;
  author: string;
  content: string;
  postId: string;
  parentId: string | null;
  createdAt: string;
}
