require("dotenv/config");
const assert = require("node:assert/strict");
const { createHmac, randomUUID } = require("node:crypto");
const request = require("supertest");
const { createApp } = require("../../dist/app");
const { createDatabaseClient } = require("../../dist/services/database");
const { issueSession } = require("../../dist/services/auth");
const { PaystackInvalidEmailError } = require("../../dist/services/paystack");

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/sage_lms_test" || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("M09 requires local sage_lms_test.");
const db = createDatabaseClient(url);
const signingSecret = "whsec_local_test_secret";
const gateway = {
  verifyResult: null,
  async initialize({ reference }) { return { reference, authorizationUrl: `https://checkout.paystack.com/${reference}` }; },
  async verify() { return this.verifyResult; },
};
const app = createApp({ nodeEnv: "test", port: 3000, corsOrigins: [], databaseUrl: url, paystackSecretKey: "sk_test_localonly", paystackWebhookSecret: signingSecret }, async () => {}, db, gateway);
let instructor, learner, other, category, course, lesson, token, otherToken;
const route = () => `/api/v1/courses/${course.id}/checkout`;
const signed = (body) => {
  const raw = JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac("sha512", signingSecret).update(`${timestamp}.${raw}`).digest("hex");
  return { raw, header: `t=${timestamp},v1=whk_local:${digest}` };
};

describe("M09 Paystack payments", function () {
  before(async function () {
    for (const code of ["INSTRUCTOR", "LEARNER"]) await db.role.upsert({ where: { code }, create: { code, name: code }, update: {} });
    instructor = await db.user.create({ data: { email: `m09-instructor-${randomUUID()}@example.test`, instructorProfile: { create: { displayName: "Teacher" } }, roleAssignments: { create: { role: { connect: { code: "INSTRUCTOR" } } } } } });
    learner = await db.user.create({ data: { email: `m09-learner-${randomUUID()}@example.test`, learnerProfile: { create: {} }, roleAssignments: { create: { role: { connect: { code: "LEARNER" } } } } } });
    other = await db.user.create({ data: { email: `m09-other-${randomUUID()}@example.test`, learnerProfile: { create: {} }, roleAssignments: { create: { role: { connect: { code: "LEARNER" } } } } } });
    token = (await issueSession(db, learner.id)).accessToken;
    otherToken = (await issueSession(db, other.id)).accessToken;
    category = await db.category.create({ data: { name: `M09 ${randomUUID()}`, slug: `m09-${randomUUID()}` } });
    course = await db.course.create({ data: { instructorId: instructor.id, categoryId: category.id, title: "Paid NGN", slug: `paid-${randomUUID()}`, description: "Test", status: "PUBLISHED", price: 2500, currency: "NGN" } });
    const section = await db.courseSection.create({ data: { courseId: course.id, title: "One", orderIndex: 0 } });
    lesson = await db.lesson.create({ data: { sectionId: section.id, title: "Private", orderIndex: 0 } });
  });
  after(async function () {
    if (course) { await db.payment.deleteMany({ where: { courseId: course.id } }); await db.enrollment.deleteMany({ where: { courseId: course.id } }); await db.course.delete({ where: { id: course.id } }); }
    if (category) await db.category.delete({ where: { id: category.id } });
    for (const user of [instructor, learner, other]) if (user) await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  });
  it("requires a learner, validates input and initializes one NGN checkout", async function () {
    await request(app).post(route()).set("Idempotency-Key", "m09-test-key").send({}).expect(401);
    await request(app).post(route()).set("Authorization", `Bearer ${token}`).send({ amount: 1 }).expect(400);
    const first = await request(app).post(route()).set("Authorization", `Bearer ${token}`).set("Idempotency-Key", "m09-test-key").send({}).expect(201);
    assert.equal(first.body.payment.amount, "2500");
    assert.equal(first.body.payment.currency, "NGN");
    assert.equal(first.body.payment.status, "PENDING");
    assert.match(first.body.payment.checkoutUrl, /^https:\/\/checkout.paystack.com\//);
    const second = await request(app).post(route()).set("Authorization", `Bearer ${token}`).set("Idempotency-Key", "m09-test-key").send({}).expect(200);
    assert.equal(second.body.payment.id, first.body.payment.id);
    await request(app).post(route()).set("Authorization", `Bearer ${otherToken}`).set("Idempotency-Key", "m09-test-key").send({}).expect(409);
  });
  it("returns a useful error when Paystack rejects the learner email", async function () {
    const initialize = gateway.initialize;
    gateway.initialize = async () => { throw new PaystackInvalidEmailError(); };
    try {
      const response = await request(app).post(route()).set("Authorization", `Bearer ${otherToken}`).set("Idempotency-Key", "m09-invalid-email-key").send({}).expect(422);
      assert.equal(response.body.error.code, "PAYMENT_EMAIL_INVALID");
      const payment = await db.payment.findUniqueOrThrow({ where: { idempotencyKey: "m09-invalid-email-key" } });
      assert.equal(payment.status, "FAILED");
      assert.equal(await db.enrollment.count({ where: { learnerId: other.id, courseId: course.id } }), 0);
    } finally { gateway.initialize = initialize; }
  });
  it("rejects tampering and cannot grant access on an unsuccessful verification", async function () {
    const payment = await db.payment.findUniqueOrThrow({ where: { idempotencyKey: "m09-test-key" } });
    const event = { event: "charge.success", data: { reference: payment.providerReference } };
    const { raw, header } = signed(event);
    await request(app).post("/api/v1/payments/paystack/webhook").set("Content-Type", "application/json").set("Paystack-Signature", header).send(raw.replace("charge.success", "charge.failure")).expect(401);
    gateway.verifyResult = { status: "failed", reference: payment.providerReference, amount: 250000, currency: "NGN", customer: { email: learner.email } };
    await request(app).post("/api/v1/payments/paystack/webhook").set("Content-Type", "application/json").set("Paystack-Signature", header).send(raw).expect(409);
    gateway.verifyResult = { status: "success", reference: payment.providerReference, amount: 1, currency: "NGN", customer: { email: learner.email } };
    await request(app).post("/api/v1/payments/paystack/webhook").set("Content-Type", "application/json").set("Paystack-Signature", header).send(raw).expect(409);
    assert.equal(await db.enrollment.count({ where: { learnerId: learner.id, courseId: course.id } }), 0);
    await request(app).get(`/api/v1/lessons/${lesson.id}/access`).set("Authorization", `Bearer ${token}`).expect(403);
  });
  it("settles a verified success exactly once and keeps history private", async function () {
    const payment = await db.payment.findUniqueOrThrow({ where: { idempotencyKey: "m09-test-key" } });
    const { raw, header } = signed({ event: "charge.success", data: { reference: payment.providerReference } });
    gateway.verifyResult = { status: "success", reference: payment.providerReference, amount: 250000, currency: "NGN", customer: { email: learner.email } };
    for (let i = 0; i < 2; i++) await request(app).post("/api/v1/payments/paystack/webhook").set("Content-Type", "application/json").set("Paystack-Signature", header).send(raw).expect(200);
    assert.equal(await db.enrollment.count({ where: { learnerId: learner.id, courseId: course.id } }), 1);
    assert.equal(await db.payment.count({ where: { providerReference: payment.providerReference, status: "SUCCEEDED" } }), 1);
    const mine = await request(app).get("/api/v1/learners/me/transactions").set("Authorization", `Bearer ${token}`).expect(200);
    assert.equal(mine.body.transactions[0].status, "SUCCEEDED");
    assert.equal(mine.body.transactions[0].reference, payment.providerReference);
    const theirs = await request(app).get("/api/v1/learners/me/transactions").set("Authorization", `Bearer ${otherToken}`).expect(200);
    assert.equal(theirs.body.transactions.length, 1);
    assert.equal(theirs.body.transactions[0].status, "FAILED");
    assert.notEqual(theirs.body.transactions[0].reference, payment.providerReference);
    await request(app).get(`/api/v1/lessons/${lesson.id}/access`).set("Authorization", `Bearer ${otherToken}`).expect(403);
  });
});
