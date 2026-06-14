import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import authRouter from "./routes/auth";
import postRoutes from "./routes/posts";
import categoryRoutes from "./routes/categories";
import tagRoutes from "./routes/tags";
import projectRoutes from "./routes/projects";
import mediaRoutes from "./routes/media";
import analyticsRoutes from "./routes/analytics";
import settingsRoutes from "./routes/settings";
import adminAiRoutes from "./routes/admin-ai";
import snippetRoutes from "./routes/snippets";
import contactRoutes from "./routes/contact";
import commentRoutes from "./routes/comments";
import reactionRoutes from "./routes/reactions";
import newsletterRoutes from "./routes/newsletter";
import schedulerRoutes from "./routes/scheduler";
import adminUserRoutes from "./routes/admin-users";
import { validateBackendEnv } from "./utils/env";

dotenv.config();
const env = validateBackendEnv();

const app = express();
const PORT = env.port;

// Middleware
app.set("trust proxy", 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors({
  origin: env.frontendUrl,
  credentials: true,
}));
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/auth", authRouter);
app.use("/api/posts", postRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/admin/ai", adminAiRoutes);
app.use("/api", snippetRoutes);
app.use("/api", contactRoutes);
app.use("/api", commentRoutes);
app.use("/api", reactionRoutes);
app.use("/api", newsletterRoutes);
app.use("/api/admin", schedulerRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api", settingsRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
