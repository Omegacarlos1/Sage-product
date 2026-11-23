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
  const instructor = await database.user.upsert({ where: { email: "amara.okafor@example.invalid" }, update: {}, create: { email: "amara.okafor@example.invalid", instructorProfile: { create: { displayName: "Amara Okafor", headline: "Fictional software educator", verificationStatus: "VERIFIED" } } } });
  await database.instructorProfile.upsert({ where: { userId: instructor.id }, update: { displayName: "Amara Okafor", verificationStatus: "VERIFIED" }, create: { userId: instructor.id, displayName: "Amara Okafor", verificationStatus: "VERIFIED" } });
  const samples = [
    { title: "Introduction to Web Development", slug: "sample-web-development", category: "technology", level: "BEGINNER", description: "A fictional beginner course covering HTML, CSS and JavaScript." },
    { title: "Practical Business Planning", slug: "sample-business-planning", category: "business", level: "INTERMEDIATE", description: "A fictional course about business plans and market research." },
    { title: "Design Fundamentals", slug: "sample-design-fundamentals", category: "creative-skills", level: "ALL_LEVELS", description: "A fictional introduction to visual design principles." },
  ];
  for (const sample of samples) {
    const category = await database.category.findUniqueOrThrow({ where: { slug: sample.category } });
    const data = { title: sample.title, description: sample.description, level: sample.level, categoryId: category.id, instructorId: instructor.id, status: "PUBLISHED", publishedAt: new Date("2026-11-22T00:00:00.000Z") };
    await database.course.upsert({ where: { slug: sample.slug }, update: data, create: { ...data, slug: sample.slug } });
  }
  process.stdout.write(`${roles.length} roles, ${categories.length} categories and ${samples.length} fictional courses seeded in sage_lms_dev.\n`);
}

seed()
  .catch(() => {
    process.stderr.write("Development seed failed; check the local database connection.\n");
    process.exitCode = 1;
  })
  .finally(() => database.$disconnect());
