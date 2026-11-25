require("dotenv/config");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const request = require("supertest");
const { createApp } = require("../../dist/app");
const { createDatabaseClient } = require("../../dist/services/database");
const { issueSession } = require("../../dist/services/auth");

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/sage_lms_test" || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("M12 requires local sage_lms_test.");
const db = createDatabaseClient(url);
const app = createApp({ nodeEnv: "test", port: 3000, corsOrigins: [], databaseUrl: url }, async () => {}, db);
let instructor, learner, other, category, course, section, lesson, quiz, certificate;
const token = {};
const auth = (name) => ({ Authorization: `Bearer ${token[name]}` });

describe("M12 certificates", function () {
  before(async function () {
    for (const code of ["INSTRUCTOR", "LEARNER"]) await db.role.upsert({ where: { code }, create: { code, name: code }, update: {} });
    for (const name of ["instructor", "learner", "other"]) {
      const user = await db.user.create({ data: { email: `${name}-${randomUUID()}@example.test`, ...(name === "instructor" ? { instructorProfile: { create: { displayName: "Teacher" } } } : { learnerProfile: { create: {} } }), roleAssignments: { create: { role: { connect: { code: name === "instructor" ? "INSTRUCTOR" : "LEARNER" } } } } } });
      if (name === "instructor") instructor = user;
      if (name === "learner") learner = user;
      if (name === "other") other = user;
      token[name] = (await issueSession(db, user.id)).accessToken;
    }
    category = await db.category.create({ data: { name: `M12 ${randomUUID()}`, slug: `m12-${randomUUID()}` } });
    course = await db.course.create({ data: { instructorId: instructor.id, categoryId: category.id, title: "Certificate Course", slug: `certificate-${randomUUID()}`, description: "Test", status: "PUBLISHED" } });
    section = await db.courseSection.create({ data: { courseId: course.id, title: "Section", orderIndex: 0 } });
    lesson = await db.lesson.create({ data: { sectionId: section.id, title: "Required", orderIndex: 0 } });
    quiz = await db.quiz.create({ data: { courseId: course.id, title: "Final" } });
    await db.enrollment.create({ data: { courseId: course.id, learnerId: learner.id } });
  });
  after(async function () {
    if (course) {
      await db.certificate.deleteMany({ where: { enrollment: { courseId: course.id } } });
      await db.quizAttempt.deleteMany({ where: { quizId: quiz.id } });
      await db.quiz.delete({ where: { id: quiz.id } });
      await db.lessonProgress.deleteMany({ where: { lessonId: lesson.id } });
      await db.enrollment.deleteMany({ where: { courseId: course.id } });
      await db.course.delete({ where: { id: course.id } });
    }
    if (category) await db.category.delete({ where: { id: category.id } });
    for (const user of [instructor, learner, other]) if (user) await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  });
  it("rejects unauthorized and premature issuance", async function () {
    await request(app).post(`/api/v1/courses/${course.id}/certificate`).send({}).expect(401);
    await request(app).post(`/api/v1/courses/${course.id}/certificate`).set(auth("other")).send({}).expect(403);
    await request(app).post(`/api/v1/courses/${course.id}/certificate`).set(auth("learner")).send({ learnerId: other.id }).expect(400);
    const early = await request(app).post(`/api/v1/courses/${course.id}/certificate`).set(auth("learner")).send({}).expect(409);
    assert.equal(early.body.error.code, "COMPLETION_NOT_MET");
    await db.lessonProgress.create({ data: { learnerId: learner.id, lessonId: lesson.id, completedAt: new Date() } });
    await request(app).post(`/api/v1/courses/${course.id}/certificate`).set(auth("learner")).send({}).expect(409);
    await db.quizAttempt.create({ data: { quizId: quiz.id, learnerId: learner.id, status: "SUBMITTED", passed: true, score: 100, submittedAt: new Date() } });
  });
  it("issues once, verifies publicly without learner data, and restricts own copy", async function () {
    const issued = await request(app).post(`/api/v1/courses/${course.id}/certificate`).set(auth("learner")).send({}).expect(201);
    certificate = issued.body.certificate;
    assert.match(certificate.id, /^[0-9a-f-]{36}$/i);
    assert.match(certificate.verificationCode, /^[0-9a-f-]{36}$/i);
    const [duplicate, verified] = await Promise.all([
      request(app).post(`/api/v1/courses/${course.id}/certificate`).set(auth("learner")).send({}),
      request(app).get(certificate.verificationPath),
    ]);
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, "CERTIFICATE_ALREADY_ISSUED");
    assert.equal(verified.status, 200);
    assert.equal(verified.body.certificate.valid, true);
    assert.equal(JSON.stringify(verified.body).includes(learner.email), false);
    assert.equal(JSON.stringify(verified.body).includes(learner.id), false);
    await request(app).get(`/api/v1/certificates/${certificate.id}`).set(auth("other")).expect(403);
    await request(app).get(`/api/v1/certificates/${certificate.id}`).set(auth("learner")).expect(200);
    await request(app).get(`/api/v1/courses/${course.id}/progress`).set(auth("learner")).expect(200);
    await request(app).get(`/api/v1/certificates/verify/${randomUUID()}`).expect(404);
    assert.equal(await db.certificate.count({ where: { enrollment: { courseId: course.id } } }), 1);
  });
  it("reports revocation without deleting the verification record", async function () {
    await db.certificate.update({ where: { id: certificate.id }, data: { revokedAt: new Date() } });
    const result = await request(app).get(certificate.verificationPath).expect(200);
    assert.equal(result.body.certificate.valid, false);
  });
});
