import { NextFunction, Response, Router } from "express";
import multer from "multer";
import sharp from "sharp";
import path from "path";
import { v4 as uuid } from "uuid";
import fs from "fs";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { param } from "../utils/express";
import { getRequestLogMeta, logError, logWarn } from "../utils/logging";

const router = Router();

// Ensure uploads directory exists
const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only images are allowed"));
  },
});

function removeIfExists(filePath: string) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function uploadSingleImage(req: AuthRequest, res: Response, next: NextFunction) {
  upload.single("image")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      logWarn("Media upload rejected by multer", {
        ...getRequestLogMeta(req),
        error: error.message,
      });
      res.status(400).json({ error: error.message });
      return;
    }

    if (error instanceof Error) {
      logWarn("Media upload rejected", {
        ...getRequestLogMeta(req),
        error: error.message,
      });
      res.status(400).json({ error: error.message });
      return;
    }

    logWarn("Media upload failed with unknown error", getRequestLogMeta(req));
    res.status(400).json({ error: "Upload failed" });
  });
}

// POST /api/media/upload â€” admin, upload and optimize image
router.post("/upload", authMiddleware, uploadSingleImage, async (req: AuthRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file provided" });
    return;
  }

  const filePath = req.file.path;
  const ext = path.extname(filePath);
  const webpPath = filePath.replace(ext, ".webp");
  const thumbPath = filePath.replace(ext, "-thumb.webp");

  try {
    await sharp(filePath)
      .resize(1920, 1080, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(webpPath);

    await sharp(filePath)
      .resize(400, 300, { fit: "cover" })
      .webp({ quality: 70 })
      .toFile(thumbPath);

    if (ext !== ".webp") {
      removeIfExists(filePath);
    }

    const baseName = path.basename(webpPath);
    res.status(201).json({
      url: `/uploads/${baseName}`,
      thumbnail: `/uploads/${path.basename(thumbPath)}`,
      originalName: req.file.originalname,
    });
  } catch (err) {
    removeIfExists(filePath);
    removeIfExists(webpPath);
    removeIfExists(thumbPath);
    logError("Image processing failed", {
      ...getRequestLogMeta(req),
      file: req.file?.originalname,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: "Image processing failed" });
  }
});

// GET /api/media â€” admin, list uploaded files
router.get("/", authMiddleware, async (_req: AuthRequest, res) => {
  const files = fs.readdirSync(uploadDir)
    .filter((file) => file.endsWith(".webp") && !file.includes("-thumb."))
    .map((file) => ({
      url: `/uploads/${file}`,
      thumbnail: `/uploads/${file.replace(/\.webp$/, "-thumb.webp")}`,
      name: file,
    }))
    .sort()
    .reverse();

  res.json(files);
});

// DELETE /api/media/:filename â€” admin
router.delete("/:filename", authMiddleware, async (req: AuthRequest, res) => {
  const filename = param(req, "filename");
  const filePath = path.join(uploadDir, filename);
  const thumbPath = path.join(uploadDir, filename.replace(/\.webp$/, "-thumb.webp"));

  removeIfExists(filePath);
  removeIfExists(thumbPath);

  res.status(204).send();
});

export default router;
