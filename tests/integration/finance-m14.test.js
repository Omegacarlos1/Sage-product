require("dotenv/config");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const request = require("supertest");
const { createApp } = require("../../dist/app");
const { createDatabaseClient } = require("../../dist/services/database");
const { issueSession } = require("../../dist/services/auth");

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/sage_lms_test" || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("M14 requires local sage_lms_test.");
const db = createDatabaseClient(url);
const app = createApp({ nodeEnv: "test", port: 3000, corsOrigins: [], databaseUrl: url }, async () => {}, db);
let instructor, learner, admin, category, course, payment, instructorToken, learnerToken, adminToken;
const bearer = (token) => `Bearer ${token}`;

describe("M14 finance requests", function () {
  before(async function () {
    for (const code of ["INSTRUCTOR", "LEARNER", "ADMIN"]) await db.role.upsert({ where: { code }, create: { code, name: code }, update: {} });
    instructor = await db.user.create({ data: { email: `m14-instructor-${randomUUID()}@example.test`, instructorProfile: { create: { displayName: "M14 Teacher" } }, roleAssignments: { create: { role: { connect: { code: "INSTRUCTOR" } } } } } });
    learner = await db.user.create({ data: { email: `m14-learner-${randomUUID()}@example.test`, learnerProfile: { create: {} }, roleAssignments: { create: { role: { connect: { code: "LEARNER" } } } } } });
    admin = await db.user.create({ data: { email: `m14-admin-${randomUUID()}@example.test`, roleAssignments: { create: { role: { connect: { code: "ADMIN" } } } } } });
    instructorToken = (await issueSession(db, instructor.id)).accessToken;
    learnerToken = (await issueSession(db, learner.id)).accessToken;
    adminToken = (await issueSession(db, admin.id)).accessToken;
    category = await db.category.create({ data: { name: `M14 ${randomUUID()}`, slug: `m14-${randomUUID()}` } });
    course = await db.course.create({ data: { instructorId: instructor.id, categoryId: category.id, title: "M14 Course", slug: `m14-course-${randomUUID()}`, description: "Test", status: "PUBLISHED", price: 2500, currency: "NGN" } });
    payment = await db.payment.create({ data: { userId: learner.id, courseId: course.id, amount: 2500, currency: "NGN", status: "SUCCEEDED", provider: "PAYSTACK", providerReference: `m14-${randomUUID()}`, settledAt: new Date() } });
  });
  after(async function () {
    if (payment) { await db.financeAudit.deleteMany({ where: { OR: [{ refundRequest: { paymentId: payment.id } }, { payoutRequest: { instructorId: instructor.id } }] } }); await db.refundRequest.deleteMany({ where: { paymentId: payment.id } }); await db.payoutRequest.deleteMany({ where: { instructorId: instructor.id } }); await db.payment.delete({ where: { id: payment.id } }); }
    if (course) await db.course.delete({ where: { id: course.id } });
    if (category) await db.category.delete({ where: { id: category.id } });
    for (const user of [instructor, learner, admin]) if (user) await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  });

  it("isolates instructor sales and rejects learner finance actions", async function () {
    await request(app).get("/api/v1/instructors/me/sales").expect(401);
    await request(app).get("/api/v1/instructors/me/sales").set("Authorization", bearer(learnerToken)).expect(403);
    const sales = await request(app).get("/api/v1/instructors/me/sales").set("Authorization", bearer(instructorToken)).expect(200);
    assert.equal(sales.body.summary.grossSales, "2500.00");
    assert.equal(sales.body.summary.provisionalAvailable, "2500.00");
    assert.equal(sales.body.sales[0].paymentId, payment.id);
    await request(app).post(`/api/v1/payments/${payment.id}/refund-requests`).set("Authorization", bearer(instructorToken)).set("Idempotency-Key", "m14-forbidden-refund").send({ reason: "Please refund this purchase" }).expect(403);
    await request(app).post("/api/v1/admin/payout-requests/00000000-0000-0000-0000-000000000000/reject").set("Authorization", bearer(learnerToken)).send({}).expect(403);
  });

  it("records one refund request and holds the sale once", async function () {
    const path = `/api/v1/payments/${payment.id}/refund-requests`;
    const first = await request(app).post(path).set("Authorization", bearer(learnerToken)).set("Idempotency-Key", "m14-refund-key-one").send({ reason: "I cannot take this course" }).expect(201);
    const second = await request(app).post(path).set("Authorization", bearer(learnerToken)).set("Idempotency-Key", "m14-refund-key-one").send({ reason: "I cannot take this course" }).expect(200);
    assert.equal(second.body.refundRequest.id, first.body.refundRequest.id);
    await request(app).post(path).set("Authorization", bearer(learnerToken)).set("Idempotency-Key", "m14-refund-key-two").send({ reason: "I cannot take this course" }).expect(409);
    assert.equal(await db.refundRequest.count({ where: { paymentId: payment.id } }), 1);
    assert.equal(await db.financeAudit.count({ where: { refundRequestId: first.body.refundRequest.id } }), 1);
    const sales = await request(app).get("/api/v1/instructors/me/sales").set("Authorization", bearer(instructorToken)).expect(200);
    assert.equal(sales.body.summary.refundHolds, "2500.00");
    assert.equal(sales.body.summary.provisionalAvailable, "0.00");
    await request(app).post("/api/v1/instructors/me/payout-requests").set("Authorization", bearer(instructorToken)).set("Idempotency-Key", "m14-payout-too-soon").send({ amount: "100.00" }).expect(409);
    await request(app).post(`/api/v1/admin/refund-requests/${first.body.refundRequest.id}/reject`).set("Authorization", bearer(adminToken)).send({}).expect(200);
    await request(app).post(`/api/v1/admin/refund-requests/${first.body.refundRequest.id}/reject`).set("Authorization", bearer(adminToken)).send({}).expect(409);
  });

  it("holds concurrent payout requests and keeps status private", async function () {
    const endpoint = "/api/v1/instructors/me/payout-requests";
    const responses = await Promise.all(["m14-payout-key-one", "m14-payout-key-two"].map((key) => request(app).post(endpoint).set("Authorization", bearer(instructorToken)).set("Idempotency-Key", key).send({ amount: "2000.00" })));
    assert.deepEqual(responses.map((item) => item.status).sort(), [201, 409]);
    const payout = responses.find((item) => item.status === 201).body.payoutRequest;
    const same = await request(app).post(endpoint).set("Authorization", bearer(instructorToken)).set("Idempotency-Key", responses[0].status === 201 ? "m14-payout-key-one" : "m14-payout-key-two").send({ amount: "2000.00" }).expect(200);
    assert.equal(same.body.payoutRequest.id, payout.id);
    const status = await request(app).get(endpoint).set("Authorization", bearer(instructorToken)).expect(200);
    assert.equal(status.body.payoutRequests[0].status, "PENDING_REVIEW");
    const sales = await request(app).get("/api/v1/instructors/me/sales").set("Authorization", bearer(instructorToken)).expect(200);
    assert.equal(sales.body.summary.payoutHolds, "2000.00");
    assert.equal(sales.body.summary.provisionalAvailable, "500.00");
    await request(app).get(endpoint).set("Authorization", bearer(learnerToken)).expect(403);
    await request(app).post(`/api/v1/admin/payout-requests/${payout.id}/reject`).set("Authorization", bearer(adminToken)).send({}).expect(200);
    assert.equal(await db.financeAudit.count({ where: { payoutRequestId: payout.id } }), 2);
  });
});
