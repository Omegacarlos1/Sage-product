require("dotenv/config");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const request = require("supertest");
const { createApp } = require("../../dist/app");
const { createDatabaseClient } = require("../../dist/services/database");
const { issueSession } = require("../../dist/services/auth");

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/sage_lms_test" || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("M15 tests require local sage_lms_test.");
const db = createDatabaseClient(url);
const app = createApp({ nodeEnv: "test", port: 3000, corsOrigins: [], databaseUrl: url }, async () => {}, db);
const bearer = (token) => `Bearer ${token}`;
let admin, learner, instructor, category, pending, rejected, adminToken, learnerToken;

describe("M15 admin management", function () {
  before(async function () {
    for (const code of ["ADMIN", "LEARNER", "INSTRUCTOR"]) await db.role.upsert({ where: { code }, create: { code, name: code }, update: {} });
    admin = await db.user.create({ data: { email: `m15-admin-${randomUUID()}@example.test`, roleAssignments: { create: { role: { connect: { code: "ADMIN" } } } } } });
    learner = await db.user.create({ data: { email: `m15-learner-${randomUUID()}@example.test`, roleAssignments: { create: { role: { connect: { code: "LEARNER" } } } } } });
    instructor = await db.user.create({ data: { email: `m15-instructor-${randomUUID()}@example.test`, instructorProfile: { create: { displayName: "M15 Teacher" } }, roleAssignments: { create: { role: { connect: { code: "INSTRUCTOR" } } } } } });
    adminToken = (await issueSession(db, admin.id)).accessToken;
    learnerToken = (await issueSession(db, learner.id)).accessToken;
    category = await db.category.create({ data: { name: `M15 ${randomUUID()}`, slug: `m15-${randomUUID()}` } });
    pending = await db.course.create({ data: { instructorId: instructor.id, categoryId: category.id, title: "M15 Approval", slug: `m15-approval-${randomUUID()}`, description: "Test", status: "IN_REVIEW" } });
    rejected = await db.course.create({ data: { instructorId: instructor.id, categoryId: category.id, title: "M15 Rejection", slug: `m15-rejection-${randomUUID()}`, description: "Test", status: "IN_REVIEW" } });
  });
  after(async function () {
    await db.$executeRawUnsafe('TRUNCATE TABLE "admin_audit"');
    for (const course of [pending, rejected]) if (course) await db.course.delete({ where: { id: course.id } });
    if (category) await db.category.delete({ where: { id: category.id } });
    for (const user of [admin, learner, instructor]) if (user) await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  });
  it("denies learner access to every admin area", async function () {
    for (const path of ["users", "instructors", "courses/review", "transactions", "analytics", "audit"]) await request(app).get(`/api/v1/admin/${path}`).set("Authorization", bearer(learnerToken)).expect(403);
    await request(app).post(`/api/v1/admin/courses/${pending.id}/approve`).set("Authorization", bearer(learnerToken)).send({}).expect(403);
  });
  it("enforces course transitions and records one event", async function () {
    const path = `/api/v1/admin/courses/${pending.id}/approve`;
    await request(app).post(path).set("Authorization", bearer(adminToken)).send({}).expect(200);
    await request(app).post(path).set("Authorization", bearer(adminToken)).send({}).expect(409);
    await request(app).post(`/api/v1/admin/courses/${rejected.id}/reject`).set("Authorization", bearer(adminToken)).send({}).expect(200);
    await request(app).post(`/api/v1/admin/courses/${rejected.id}/approve`).set("Authorization", bearer(adminToken)).send({}).expect(409);
    assert.equal(await db.adminAudit.count({ where: { targetId: pending.id } }), 1);
    assert.equal((await db.course.findUnique({ where: { id: rejected.id } })).status, "REJECTED");
    await assert.rejects(db.adminAudit.deleteMany({ where: { targetId: pending.id } }));
  });
  it("manages user and instructor status and returns bounded overviews", async function () {
    await request(app).patch(`/api/v1/admin/users/${learner.id}/status`).set("Authorization", bearer(adminToken)).send({ status: "SUSPENDED" }).expect(200);
    await request(app).get("/api/v1/admin/users").set("Authorization", bearer(learnerToken)).expect(401);
    await request(app).patch(`/api/v1/admin/users/${admin.id}/status`).set("Authorization", bearer(adminToken)).send({ status: "SUSPENDED" }).expect(409);
    await request(app).patch(`/api/v1/admin/instructors/${instructor.id}/verification`).set("Authorization", bearer(adminToken)).send({ status: "VERIFIED" }).expect(200);
    await request(app).patch(`/api/v1/admin/instructors/${instructor.id}/verification`).set("Authorization", bearer(adminToken)).send({ status: "REJECTED" }).expect(409);
    for (const path of ["users", "instructors", "transactions", "analytics", "audit"]) await request(app).get(`/api/v1/admin/${path}`).set("Authorization", bearer(adminToken)).expect(200);
    assert.equal(await db.adminAudit.count({ where: { targetId: instructor.id } }), 1);
  });
});
