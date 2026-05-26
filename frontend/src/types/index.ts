export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  body?: string;
  category?: Category;
  tags?: Tag[];
  featuredImage?: string | null;
  status?: string;
  publishedAt?: string | null;
  readingTime?: number;
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImage?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  postCount?: number;
  _count?: { posts: number };
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  postCount?: number;
  _count?: { posts: number };
}

export interface Project {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  thumbnail?: string | null;
  liveUrl?: string | null;
  githubUrl?: string | null;
  featured: boolean;
  order?: number;
}

export interface SkillGroup {
  category: string;
  skills: {
    name: string;
    level: "expert" | "proficient" | "familiar";
  }[];
}

export interface SiteConfig {
  title: string;
  tagline: string;
  description: string;
  authorName: string;
  socialLinks: {
    github?: string;
    linkedin?: string;
    twitter?: string;
    email?: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
