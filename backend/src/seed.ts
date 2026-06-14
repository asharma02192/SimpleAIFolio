import prisma from "./utils/db";
import bcrypt from "bcryptjs";

async function seed() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log("Seed: Already seeded, skipping.");
    return;
  }

  console.log("Seed: Starting fresh setup...");

  // Create admin user
  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL;
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
  const seedAdminName = process.env.SEED_ADMIN_NAME || "Admin";

  if (!seedAdminEmail || !seedAdminPassword) {
    console.log("Seed: No SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD provided. Skipping admin creation.");
    console.log("Seed: Complete (no admin).");
    return;
  }

  console.log(`Seed: Creating admin account for ${seedAdminEmail}...`);
  const hashed = await bcrypt.hash(seedAdminPassword, 12);
  await prisma.user.create({
    data: { email: seedAdminEmail, password: hashed, name: seedAdminName },
  });
  console.log(`Seed: Admin created for ${seedAdminEmail}`);

  // Seed minimal neutral site settings
  const defaultSettings: Record<string, string> = {
    site_title: seedAdminName,
    tagline: "Welcome to my portfolio",
    description: "A personal portfolio and blog.",
    author_name: seedAdminName,
    theme: "light-minimal",
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.siteSetting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }
  console.log("Seed: Created default site settings");

  console.log("Seed: Complete. Use the admin panel or MCP setup-portfolio prompt to customize your site.");
}

seed()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
