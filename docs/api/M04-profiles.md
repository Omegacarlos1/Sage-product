# M04 profile API contract

Base URL: `http://localhost:3000`. JSON requests use `Content-Type: application/json`. Private routes use `Authorization: Bearer <accessToken>` from M03 login. Examples below are expected responses, not Postman run results.

| Method | URL | Access | Body | Success |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/profile/me` | Signed in | None | `200 {"user":{"id":"<user UUID>","email":"learner@example.test","phoneNumber":null,"learnerProfile":{"userId":"<user UUID>","displayName":null,"avatarUrl":null,"biography":null,"location":null,"occupation":null,"education":null,"skills":[],"interests":[]},"instructorProfile":null}}` |
| PATCH | `/api/v1/profile/me` | Signed in | `{"displayName":"Ada Learner","location":"Lagos"}` | `200 {"profile":{"userId":"<user UUID>","displayName":"Ada Learner","avatarUrl":null,"biography":null,"location":"Lagos","occupation":null,"education":null,"skills":[],"interests":[]}}` |
| GET | `/api/v1/instructors/:id` | Public | None | `200 {"instructor":{"userId":"<instructor UUID>","displayName":"Ada Teacher","headline":"Teacher","biography":null,"websiteUrl":null}}` |
| GET | `/api/v1/instructors?page=1&limit=20` | Public | None | `200 {"instructors":[],"page":1,"limit":20,"total":0}` when no verified instructors exist |
| PATCH | `/api/v1/instructors/me` | INSTRUCTOR | `{"headline":"Teacher","websiteUrl":"https://example.test"}` | `200 {"instructor":{"userId":"<own UUID>","displayName":"Ada Teacher","headline":"Teacher","biography":null,"websiteUrl":"https://example.test"}}` |

Only verified instructors linked to active users appear publicly. The public selector omits email, phone, password, status, roles and verification state. Instructor editing uses the bearer token owner; the caller cannot choose a target ID. An INSTRUCTOR role and existing instructor profile must be provisioned by a trusted operator because self-service instructor onboarding is outside M04.

Profile edits accept only named fields. Learner: `displayName`, `avatarUrl`, `biography`, `location`, `occupation`, `education`. Instructor: `displayName`, `headline`, `biography`, `websiteUrl`. Strings are trimmed, must be nonempty, and obey schema length limits; nullable fields can be cleared with `null`. URLs must use HTTP or HTTPS. Unknown fields, including `userId`, `email`, `verificationStatus`, and `role`, return `400`.

## Postman cases

1. Login using `POST /api/v1/auth/login`, `Content-Type: application/json`, `{"email":"learner@example.test","password":"correct horse battery staple"}`. Copy `tokens.accessToken` to `Authorization: Bearer <accessToken>`.
2. Send `GET /api/v1/profile/me` with that header. Expect `200` and the private user/profile object.
3. Send `PATCH /api/v1/profile/me` with both headers and `{"displayName":"Ada Learner","location":"Lagos"}`. Expect `200` and the trimmed profile. Sending `{"userId":"<other UUID>","displayName":"Wrong owner"}` returns `400 {"error":{"code":"VALIDATION_ERROR","message":"Invalid profile fields."}}`.
4. Send `GET /api/v1/instructors/<verified instructor UUID>` without credentials. Expect `200` and only the five public fields listed above. An unverified or missing ID returns `404 {"error":{"code":"NOT_FOUND","message":"Instructor not found."}}`.
5. Send `PATCH /api/v1/instructors/me` with a LEARNER bearer token, `Content-Type: application/json`, and `{"headline":"Wrong owner"}`. Expect `403 {"error":{"code":"FORBIDDEN","message":"Insufficient permissions."}}`. Without bearer credentials, private routes return `401 {"error":{"code":"UNAUTHORIZED","message":"Authentication required."}}`.
