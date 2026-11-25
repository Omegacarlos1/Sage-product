require("dotenv/config");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const request = require("supertest");
const { createApp } = require("../../dist/app");
const { createDatabaseClient } = require("../../dist/services/database");
const { issueSession } = require("../../dist/services/auth");

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/sage_lms_test" || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("M11 requires local sage_lms_test.");
const db = createDatabaseClient(url);
const app = createApp({ nodeEnv: "test", port: 3000, corsOrigins: [], databaseUrl: url }, async () => {}, db);
let instructor, learner, other, category, course, quiz, correct;
const token = {};
const auth = (name) => ({ Authorization: `Bearer ${token[name]}` });

describe("M11 quizzes", function () {
  before(async function () {
    for (const code of ["INSTRUCTOR", "LEARNER"]) await db.role.upsert({ where: { code }, create: { code, name: code }, update: {} });
    for (const name of ["instructor", "learner", "other"]) {
      const user = await db.user.create({ data: { email: `${name}-${randomUUID()}@example.test`, ...(name === "instructor" ? { instructorProfile: { create: { displayName: "Teacher" } } } : { learnerProfile: { create: {} } }), roleAssignments: { create: { role: { connect: { code: name === "instructor" ? "INSTRUCTOR" : "LEARNER" } } } } } });
      if (name === "instructor") instructor = user;
      if (name === "learner") learner = user;
      if (name === "other") other = user;
      token[name] = (await issueSession(db, user.id)).accessToken;
    }
    category = await db.category.create({ data: { name: `M11 ${randomUUID()}`, slug: `m11-${randomUUID()}` } });
    course = await db.course.create({ data: { instructorId: instructor.id, categoryId: category.id, title: "Quiz", slug: `quiz-${randomUUID()}`, description: "Test" } });
    const created = await request(app).post(`/api/v1/courses/${course.id}/quizzes`).set(auth("instructor")).send({ title: "Check", passingScore: 70, attemptLimit: 1, timeLimitSeconds: 300, questions: [{ prompt: "Choose one", type: "SINGLE_CHOICE", points: 2, options: [{ text: "Yes", isCorrect: true }, { text: "No", isCorrect: false }] }, { prompt: "Choose both", type: "MULTIPLE_CHOICE", points: 1, options: [{ text: "A", isCorrect: true }, { text: "B", isCorrect: true }, { text: "C", isCorrect: false }] }] });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(JSON.stringify(created.body).includes("isCorrect"), false);
    quiz = await db.quiz.findUniqueOrThrow({ where: { id: created.body.quiz.id }, include: { questions: { include: { options: true }, orderBy: { orderIndex: "asc" } } } });
    correct = quiz.questions[0].options.find((o) => o.isCorrect);
    await db.course.update({ where: { id: course.id }, data: { status: "PUBLISHED" } });
    await db.enrollment.create({ data: { learnerId: learner.id, courseId: course.id } });
  });
  after(async function () {
    if (course) { await db.quizAttempt.deleteMany({ where: { quizId: quiz.id } }); await db.enrollment.deleteMany({ where: { courseId: course.id } }); await db.course.delete({ where: { id: course.id } }); }
    if (category) await db.category.delete({ where: { id: category.id } });
    for (const user of [instructor, learner, other]) if (user) await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  });
  it("keeps answer keys private and denies unauthorized access", async function () {
    await request(app).get(`/api/v1/quizzes/${quiz.id}`).expect(401);
    await request(app).get(`/api/v1/quizzes/${quiz.id}`).set(auth("other")).expect(403);
    await request(app).post(`/api/v1/quizzes/${quiz.id}/attempts`).set(auth("other")).send({}).expect(403);
    const response = await request(app).get(`/api/v1/quizzes/${quiz.id}`).set(auth("learner")).expect(200);
    assert.equal(JSON.stringify(response.body).includes("isCorrect"), false);
    assert.equal(JSON.stringify(response.body).includes("correctOptionIds"), false);
  });
  it("enforces one active attempt, scores exact option sets, and enforces limit", async function () {
    const start = await request(app).post(`/api/v1/quizzes/${quiz.id}/attempts`).set(auth("learner")).send({}).expect(201);
    const attemptId = start.body.attempt.id;
    assert.equal(JSON.stringify(start.body).includes("isCorrect"), false);
    await request(app).post(`/api/v1/quizzes/${quiz.id}/attempts`).set(auth("learner")).send({}).expect(409);
    await request(app).get(`/api/v1/quiz-attempts/${attemptId}/result`).set(auth("learner")).expect(409);
    const second = quiz.questions[1];
    const answers = [{ questionId: quiz.questions[0].id, optionIds: [correct.id] }, { questionId: second.id, optionIds: [second.options.find((o) => o.isCorrect).id] }];
    await request(app).post(`/api/v1/quiz-attempts/${attemptId}/submit`).set(auth("learner")).send({ answers: [{ questionId: quiz.questions[0].id, optionIds: [randomUUID()] }, answers[1]] }).expect(400);
    await request(app).post(`/api/v1/quiz-attempts/${attemptId}/submit`).set(auth("other")).send({ answers }).expect(403);
    const result = await request(app).post(`/api/v1/quiz-attempts/${attemptId}/submit`).set(auth("learner")).send({ answers }).expect(200);
    assert.equal(result.body.result.score, 66.67);
    assert.equal(result.body.result.passed, false);
    assert.deepEqual(result.body.result.answers[0].correctOptionIds, [correct.id]);
    const saved = await request(app).get(`/api/v1/quiz-attempts/${attemptId}/result`).set(auth("learner")).expect(200);
    assert.equal(Number(saved.body.result.score), 66.67);
    await request(app).post(`/api/v1/quiz-attempts/${attemptId}/submit`).set(auth("learner")).send({ answers }).expect(409);
    const limit = await request(app).post(`/api/v1/quizzes/${quiz.id}/attempts`).set(auth("learner")).send({}).expect(409);
    assert.equal(limit.body.error.code, "ATTEMPT_LIMIT_REACHED");
  });
  it("enforces open and close windows", async function () {
    const future = new Date(Date.now() + 60000);
    await db.quiz.update({ where: { id: quiz.id }, data: { opensAt: future } });
    const early = await request(app).post(`/api/v1/quizzes/${quiz.id}/attempts`).set(auth("learner")).send({}).expect(409);
    assert.equal(early.body.error.code, "QUIZ_NOT_OPEN");
    await db.quiz.update({ where: { id: quiz.id }, data: { opensAt: null, closesAt: new Date(Date.now() - 1000) } });
    const late = await request(app).post(`/api/v1/quizzes/${quiz.id}/attempts`).set(auth("learner")).send({}).expect(409);
    assert.equal(late.body.error.code, "QUIZ_CLOSED");
  });
});
