require("dotenv/config");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const request = require("supertest");
const { io: connect } = require("socket.io-client");
const { createSageServer, closeSageServer } = require("../../dist/server");
const { issueSession } = require("../../dist/services/auth");

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/sage_lms_test" || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("M16 tests require local sage_lms_test.");
const config = { nodeEnv: "test", port: 3000, corsOrigins: [], databaseUrl: url };
let server, io, db, base, a, b, instructor, category, course, tokenA, tokenB;
const sockets = [];
const dial = (token) => {
  const socket = connect(base, { transports: ["websocket"], reconnection: false, auth: { token } });
  sockets.push(socket);
  return socket;
};
const outcome = (socket) => new Promise((resolve) => {
  const timeout = setTimeout(() => resolve("timeout"), 2000);
  socket.once("connect", () => { clearTimeout(timeout); resolve("connected"); });
  socket.once("connect_error", (error) => { clearTimeout(timeout); resolve(error.message); });
});

describe("M16 notifications", function () {
  before(async function () {
    ({ httpServer: server, io, database: db } = createSageServer(config));
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    await db.role.upsert({ where: { code: "LEARNER" }, create: { code: "LEARNER", name: "Learner" }, update: {} });
    for (const key of ["a", "b"]) {
      const user = await db.user.create({ data: { email: `m16-${key}-${randomUUID()}@example.test`, learnerProfile: { create: {} }, roleAssignments: { create: { role: { connect: { code: "LEARNER" } } } } } });
      if (key === "a") a = user; else b = user;
    }
    tokenA = (await issueSession(db, a.id)).accessToken;
    tokenB = (await issueSession(db, b.id)).accessToken;
    instructor = await db.user.create({ data: { email: `m16-teacher-${randomUUID()}@example.test`, instructorProfile: { create: { displayName: "Teacher" } } } });
    category = await db.category.create({ data: { name: `M16 ${randomUUID()}`, slug: `m16-${randomUUID()}` } });
    course = await db.course.create({ data: { instructorId: instructor.id, categoryId: category.id, title: "M16 Course", slug: `m16-${randomUUID()}`, description: "Test", status: "PUBLISHED" } });
  });
  after(async function () {
    for (const socket of sockets) socket.disconnect();
    if (a && course) await db.enrollment.deleteMany({ where: { learnerId: a.id, courseId: course.id } });
    for (const user of [a, b]) if (user) await db.user.delete({ where: { id: user.id } });
    if (course) await db.course.delete({ where: { id: course.id } });
    if (category) await db.category.delete({ where: { id: category.id } });
    if (instructor) await db.user.delete({ where: { id: instructor.id } });
    if (io) await closeSageServer(io, db);
  });
  it("rejects missing and invalid socket credentials", async function () {
    assert.equal(await outcome(dial(undefined)), "UNAUTHORIZED");
    assert.equal(await outcome(dial("invalid")), "UNAUTHORIZED");
  });
  it("isolates events and REST history, and supports reconnection", async function () {
    const socketA = dial(tokenA), socketB = dial(tokenB);
    assert.equal(await outcome(socketA), "connected");
    assert.equal(await outcome(socketB), "connected");
    const seenA = [], seenB = [];
    socketA.on("notification:new", (value) => seenA.push(value));
    socketB.on("notification:new", (value) => seenB.push(value));
    await request(server).post(`/api/v1/courses/${course.id}/enroll`).set("Authorization", `Bearer ${tokenA}`).send({}).expect(201);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const notification = await db.notification.findFirstOrThrow({ where: { userId: a.id } });
    assert.equal(seenA.length, 1);
    assert.equal(seenB.length, 0);
    assert.equal("payload" in seenA[0], false);
    await request(server).get("/api/v1/notifications").expect(401);
    const listA = await request(server).get("/api/v1/notifications").set("Authorization", `Bearer ${tokenA}`).expect(200);
    const listB = await request(server).get("/api/v1/notifications").set("Authorization", `Bearer ${tokenB}`).expect(200);
    assert.equal(listA.body.notifications[0].id, notification.id);
    assert.equal(listB.body.notifications.length, 0);
    await request(server).patch(`/api/v1/notifications/${notification.id}/read`).set("Authorization", `Bearer ${tokenB}`).send({}).expect(404);
    const read = await request(server).patch(`/api/v1/notifications/${notification.id}/read`).set("Authorization", `Bearer ${tokenA}`).send({}).expect(200);
    assert.ok(read.body.notification.readAt);
    socketA.disconnect();
    const reconnected = dial(tokenA);
    assert.equal(await outcome(reconnected), "connected");
    const history = await request(server).get("/api/v1/notifications").set("Authorization", `Bearer ${tokenA}`).expect(200);
    assert.equal(history.body.notifications[0].id, notification.id);
  });
});
