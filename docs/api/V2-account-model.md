# V2 separate account model

Learners and instructors have different `users` rows, email addresses, passwords and login sessions. A person may link one learner account to one instructor account after both account holders authenticate and consent. Linking is a convenience association only: it does not combine roles, tokens, enrollments, courses or payment records. Instructor permission is granted only after an admin verifies the pending instructor profile. Existing multi-role accounts remain in place until a separately reviewed migration plan; this release does not split existing data.

Base URL: `http://localhost:3000/api/v1`. JSON requests: `Content-Type: application/json`. Protected requests: `Authorization: Bearer <that account's access token>`. Never send one account's access token to the other account.

| Method | Path | Body | Success | Error example |
| --- | --- | --- | --- | --- |
| POST | `/auth/instructor/signup` | `{"email":"teacher@example.test","password":"a secure password of 12+ characters","displayName":"Ada Teacher"}` | 201 `{"user":{"id":"<uuid>","email":"teacher@example.test","roles":[],"instructorStatus":"PENDING"}}` | 409 `EMAIL_IN_USE` |
| POST | `/auth/login` | `{"email":"teacher@example.test","password":"a secure password of 12+ characters"}` | 200 with separate instructor account tokens; `roles:[]` until approved | 401 `INVALID_CREDENTIALS` |
| PATCH | `/instructors/me` | `{"headline":"Data instructor"}` | 200 own instructor profile, including pending applications | 404 if account has no instructor profile |
| PATCH | `/admin/instructors/<instructor-uuid>/verification` | `{"status":"VERIFIED"}` | 200; creates instructor role in same transaction | 409 when no longer pending; admin bearer required |
| POST | `/account-links/requests` | `{"instructorEmail":"teacher@example.test"}` | 202 `{"status":"pending_if_eligible"}` for eligible and unknown addresses alike; learner bearer required | 409 `SEPARATE_ACCOUNT_REQUIRED` for a legacy combined account |
| GET | `/account-links` | none | 200 `{"links":[{"id":"<uuid>","status":"PENDING","accountId":"<uuid>","accountType":"LEARNER","createdAt":"<ISO>","expiresAt":"<ISO>","confirmedAt":null}]}`; own bearer required | 401 `UNAUTHORIZED` |
| POST | `/account-links/<link-uuid>/confirm` | `{}` | 200 `{"link":{"id":"<uuid>","status":"ACTIVE"}}`; instructor account bearer required | 404 for another account, 409 for expired or already confirmed request |
| DELETE | `/account-links/<link-uuid>` | none | 204 empty; either linked account may revoke | 404 if link is not owned by caller |

Manual Postman sequence: create learner via existing `/auth/signup`; create instructor via `/auth/instructor/signup` with a **different email/password**; login to both and store tokens separately. Try instructor course creation before approval (403). The learner requests the link, the instructor calls `GET /account-links` to get its id, and confirms using the instructor token. Call `/auth/me` with each token to verify roles stay separate. Either account can revoke the link. The request expires after 15 minutes. Rejections have no appeal workflow here. These are expected contract examples, not manual results.

Frontend must use two separate authenticated sessions if a person switches between accounts; the link endpoint is not single sign-on. Linking supplies no authority to read the other account's data. The generic 202 response prevents email discovery. Application and verification evidence policy remains a separate feature decision.
