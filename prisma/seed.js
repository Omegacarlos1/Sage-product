require("dotenv/config");
const { createDatabaseClient } = require("../dist/services/database");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set before seeding the development database.");
}

const seedDatabaseUrl = new URL(connectionString);
if (
  seedDatabaseUrl.pathname !== "/sage_lms_dev"
  || !["localhost", "127.0.0.1"].includes(seedDatabaseUrl.hostname)
  || !["postgres:", "postgresql:"].includes(seedDatabaseUrl.protocol)
) {
  throw new Error("The seed command is limited to the local sage_lms_dev database.");
}

const database = createDatabaseClient(connectionString);
const roles = [
  { code: "LEARNER", name: "Learner" },
  { code: "INSTRUCTOR", name: "Instructor" },
  { code: "ADMIN", name: "Administrator" },
];
const categories = [
  { name: "Technology", slug: "technology", description: "Software and technology skills." },
  { name: "Business", slug: "business", description: "Business, leadership, and entrepreneurship." },
  { name: "Creative Skills", slug: "creative-skills", description: "Design and other creative disciplines." },
];

async function seed() {
  for (const role of roles) {
    await database.role.upsert({
      where: { code: role.code },
      update: { name: role.name },
      create: role,
    });
  }
  for (const category of categories) {
    await database.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description },
      create: category,
    });
  }
  process.stdout.write(`${roles.length} roles and ${categories.length} categories seeded in sage_lms_dev.\n`);
}

seed()
  .catch(() => {
    process.stderr.write("Development seed failed; check the local database connection.\n");
    process.exitCode = 1;
  })
  .finally(() => database.$disconnect());
