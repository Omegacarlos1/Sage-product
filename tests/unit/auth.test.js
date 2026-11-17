const { hashPassword, verifyPassword, hashToken } = require("../../dist/services/auth");

describe("password and token hashing", () => {
  test("salts passwords and rejects a wrong password", async () => {
    const first = await hashPassword("a long test password");
    const second = await hashPassword("a long test password");
    expect(first).not.toBe(second);
    expect(first).not.toContain("a long test password");
    expect(await verifyPassword("a long test password", first)).toBe(true);
    expect(await verifyPassword("wrong password", first)).toBe(false);
  });

  test("hashes opaque tokens before persistence", () => {
    expect(hashToken("secret")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken("secret")).not.toContain("secret");
  });
});
