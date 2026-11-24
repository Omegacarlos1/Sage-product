// Prints a signed, fixed test-mode webhook request for manual Postman entry.
// Never prints the Paystack secret key or sends a request.
require("dotenv/config");
const { createHmac } = require("node:crypto");

const reference = process.argv[2];
const key = process.env.PAYSTACK_SECRET_KEY;
if (!/^sage-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference ?? "")) {
  console.error("Pass the SAGE payment reference from checkout.");
  process.exitCode = 1;
} else if (!key || !/^sk_test_[A-Za-z0-9]+$/.test(key)) {
  console.error("Set a Paystack test secret key in .env first.");
  process.exitCode = 1;
} else {
  const body = JSON.stringify({ event: "charge.success", data: { reference } });
  const signature = createHmac("sha512", key).update(body).digest("hex");
  console.log(`Body: ${body}`);
  console.log(`x-paystack-signature: ${signature}`);
}
