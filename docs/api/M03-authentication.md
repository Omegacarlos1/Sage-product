# M03 authentication API

Base URL: `http://localhost:3000/api/v1/auth`. JSON requests use `Content-Type: application/json`; protected requests use `Authorization: Bearer <accessToken>`. Tokens are opaque and must be stored securely by the client. Access tokens expire after 15 minutes; refresh tokens after 7 days. Refresh replaces both tokens, invalidating the previous pair. Logout revokes the session.

| Method | Path | Body | Success | Typical error |
| --- | --- | --- | --- | --- |
| POST | `/signup` | `{"email":"learner@example.test","password":"correct horse battery staple"}` | `201 {"user":{"id":"<uuid>","email":"learner@example.test","roles":["LEARNER"]}}` | `409 {"error":{"code":"EMAIL_IN_USE","message":"Email is already registered."}}` |
| POST | `/login` | Same email/password | `200 {"user":{"id":"<uuid>","email":"learner@example.test","roles":["LEARNER"]},"tokens":{"accessToken":"<token>","refreshToken":"<token>","tokenType":"Bearer","expiresIn":900}}` | `401 {"error":{"code":"INVALID_CREDENTIALS","message":"Invalid email or password."}}` |
| GET | `/me` | none; Bearer header | `200 {"user":{"id":"<uuid>","roles":["LEARNER"]}}` | `401 {"error":{"code":"UNAUTHORIZED","message":"Authentication required."}}` |
| GET | `/admin-check` | none; Bearer header | `200 {"status":"ok"}` for admin | `403 {"error":{"code":"FORBIDDEN","message":"Insufficient permissions."}}` |
| POST | `/refresh` | `{"refreshToken":"<token>"}` | `200 {"tokens":{"accessToken":"<new>","refreshToken":"<new>","tokenType":"Bearer","expiresIn":900}}` | `401 INVALID_TOKEN` |
| POST | `/logout` | none; Bearer header | `204` empty | `401 UNAUTHORIZED` |
| POST | `/password-reset/request` | `{"email":"learner@example.test"}` | `200 {"message":"If the account exists, a reset token has been issued.","resetToken":"<token>"}` in development/test for existing accounts | `503 RESET_UNAVAILABLE` in production |
| POST | `/password-reset/complete` | `{"token":"<token>","password":"another secure password"}` | `200 {"message":"Password reset complete. Sign in again."}` | `400 INVALID_TOKEN` for expired/used tokens |

`signup` accepts only email and password. All public signups receive LEARNER; no public route assigns INSTRUCTOR or ADMIN. Role assignments must be done through a reviewed administrative workflow. Email addresses are lowercased before storage. Passwords use per-user salted scrypt hashes. Access, refresh, and reset tokens are stored as SHA-256 hashes.

**Decision pending:** no email sender is configured, so development/test returns the reset token directly for local demonstration. Production reset requests return `503`, preventing silent token issuance without delivery. Email verification is deferred until sender, verification policy, and frontend URL are agreed. Social providers require team confirmation. Do not use the development reset behavior for a public deployment.

**Postman demonstration:** run signup, then login and copy `tokens.accessToken` into the Bearer header for `/me` and `/logout`. A bad password returns the invalid credentials example. After logout, `/me` with the same token returns `401`. These are contract examples; the collection has not been executed in Postman. Equivalent HTTP flows passed Mocha/Supertest.
