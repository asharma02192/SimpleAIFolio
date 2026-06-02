const REQUIRED_BACKEND_ENV_VARS = [
  "DATABASE_URL",
  "JWT_SECRET",
  "PORT",
  "FRONTEND_URL",
] as const;

const INSECURE_JWT_SECRETS = new Set([
  "change-this-to-a-strong-random-string",
  "changeme",
  "secret",
]);

export function getRequiredEnv(name: (typeof REQUIRED_BACKEND_ENV_VARS)[number]) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function validateBackendEnv() {
  const missing = REQUIRED_BACKEND_ENV_VARS.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const jwtSecret = process.env.JWT_SECRET?.trim() || "";
  const isProduction = process.env.NODE_ENV === "production";
  const allowInsecureJwtSecret = process.env.ALLOW_INSECURE_JWT_SECRET === "true";
  if (isProduction && !allowInsecureJwtSecret && INSECURE_JWT_SECRETS.has(jwtSecret)) {
    throw new Error("JWT_SECRET must be changed before starting the backend in production.");
  }

  return {
    databaseUrl: getRequiredEnv("DATABASE_URL"),
    frontendUrl: getRequiredEnv("FRONTEND_URL"),
    jwtSecret,
    port: Number(getRequiredEnv("PORT")),
    installSecret: process.env.INSTALL_SECRET?.trim() || null,
  };
}
