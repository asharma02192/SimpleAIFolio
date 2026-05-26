import { Router } from "express";
import prisma from "../utils/db";
import { isPrismaErrorCode, param, trimmedString } from "../utils/express";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/posts — public, paginated
router.get("/", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const perPage = Math.min(50, Math.max(1, parseInt(req.query.perPage as string) || 10));
  const category = req.query.category as string;
  const tag = req.query.tag as string;

  const statusFilter = req.query.status as string;
  const authHeader = req.headers.authorization;
  const isAdmin = statusFilter === "all" && authHeader;

  const where: Record<string, unknown> = {};
  if (!isAdmin) {
    where.status = "PUBLISHED";
    where.publishedAt = { not: null };
  }

  if (category) {
    where.category = { slug: category };
  }
  if (tag) {
    where.tags = { some: { slug: tag } };
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        featuredImage: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        readingTime: true,
        category: { select: { id: true, name: true, slug: true } },
        tags: { select: { id: true, name: true, slug: true } },
      },
      orderBy: isAdmin ? { createdAt: "desc" } : { publishedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.post.count({ where }),
  ]);

  res.json({
    data: posts,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  });
});

// GET /api/posts/admin/:id — admin, fetch by ID (including drafts)
router.get("/admin/:id", authMiddleware, async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: param(req, "id") },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      tags: { select: { id: true, name: true, slug: true } },
      author: { select: { id: true, name: true } },
    },
  });
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(post);
});

// GET /api/posts/:slug — public single post
router.get("/:slug", async (req, res) => {
  const slug = param(req, "slug");
  const post = await prisma.post.findUnique({
    where: { slug },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      tags: { select: { id: true, name: true, slug: true } },
      author: { select: { id: true, name: true } },
    },
  });

  if (!post || post.status !== "PUBLISHED") {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.json(post);
});

// POST /api/posts — admin, create post
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { excerpt, body, categoryId, tagIds, status, featuredImage, metaTitle, metaDescription, ogImage } = req.body;
    const title = trimmedString(req.body.title);
    const slug = trimmedString(req.body.slug);

    if (!title || !slug) {
      res.status(400).json({ error: "Title and slug are required" });
      return;
    }

    const readingTime = body
      ? Math.max(1, Math.ceil(body.replace(/<[^>]*>/g, "").trim().split(/\s+/).length / 200))
      : 1;

    const post = await prisma.post.create({
      data: {
        title,
        slug,
        excerpt: excerpt || null,
        body: body || "",
        categoryId: categoryId || null,
        featuredImage: featuredImage || null,
        status: status || "DRAFT",
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        readingTime,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        ogImage: ogImage || null,
        authorId: req.userId!,
        tags: tagIds?.length ? { connect: tagIds.map((id: string) => ({ id })) } : undefined,
      },
      include: {
        category: true,
        tags: true,
      },
    });

    res.status(201).json(post);
  } catch (err) {
    console.error("Create post error:", err);
    if (isPrismaErrorCode(err, "P2002")) {
      res.status(409).json({ error: "Post with this slug already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to create post" });
  }
});

// PUT /api/posts/:id — admin, update post
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { title, slug, excerpt, body, categoryId, tagIds, status, featuredImage, metaTitle, metaDescription, ogImage } = req.body;

    const existing = await prisma.post.findUnique({ where: { id: param(req, "id") } });
    if (!existing) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    // If publishing for the first time, set publishedAt
    const publishedAt = existing.publishedAt || (status === "PUBLISHED" ? new Date() : null);

    const readingTime = body
      ? Math.max(1, Math.ceil(body.replace(/<[^>]*>/g, "").trim().split(/\s+/).length / 200))
      : existing.readingTime;

    const post = await prisma.post.update({
      where: { id: param(req, "id") },
      data: {
        ...(title !== undefined && { title }),
        ...(slug !== undefined && { slug }),
        ...(excerpt !== undefined && { excerpt }),
        ...(body !== undefined && { body }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(status !== undefined && { status, publishedAt }),
        ...(featuredImage !== undefined && { featuredImage }),
        ...(readingTime !== undefined && { readingTime }),
        ...(metaTitle !== undefined && { metaTitle }),
        ...(metaDescription !== undefined && { metaDescription }),
        ...(ogImage !== undefined && { ogImage }),
        ...(tagIds !== undefined && {
          tags: { set: tagIds.map((id: string) => ({ id })) },
        }),
      },
      include: { category: true, tags: true },
    });

    res.json(post);
  } catch (err) {
    console.error("Update post error:", err);
    if (isPrismaErrorCode(err, "P2002")) {
      res.status(409).json({ error: "Post with this slug already exists" });
      return;
    }
    if (isPrismaErrorCode(err, "P2025")) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    res.status(500).json({ error: "Failed to update post" });
  }
});

// DELETE /api/posts/:id — admin
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    await prisma.post.delete({ where: { id: param(req, "id") } });
    res.status(204).send();
  } catch (err) {
    console.error("Delete post error:", err);
    if (isPrismaErrorCode(err, "P2025")) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    res.status(500).json({ error: "Failed to delete post" });
  }
});

export default router;
