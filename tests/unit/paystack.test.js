const { PaystackGateway, PaystackInvalidEmailError } = require("../../dist/services/paystack");

describe("Paystack checkout errors", () => {
  afterEach(() => jest.restoreAllMocks());

  test("maps Paystack's invalid email response without exposing its body", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 400, json: async () => ({ status: false, message: '"email" must be a valid email' }) });
    const gateway = new PaystackGateway("sk_test_localonly");
    await expect(gateway.initialize({ email: "learner@example.test", amount: 2400000, reference: "sage-test" })).rejects.toBeInstanceOf(PaystackInvalidEmailError);
  });
});
