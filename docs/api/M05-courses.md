# M05 course authoring API

Base URL: `http://localhost:3000/api/v1`. The requests below are contract examples, not live Postman results. Authenticated calls use `Authorization: Bearer <accessToken>` from M03 login. JSON calls use `Content-Type: application/json`. An instructor must have the `INSTRUCTOR` role and a verified instructor profile to create a course. Category writes require `INSTRUCTOR` or `ADMIN`; instructor edits/deletes are limited to categories they created. Admin can edit all categories. Course edits, deletion and curriculum replacement require ownership and `DRAFT` status. Approval requires `ADMIN`.

| Method | Path | Purpose | Success |
| --- | --- | --- | --- |
| GET | `/categories` | List categories | 200 |
| POST | `/categories` | Create category | 201 |
| PATCH | `/categories/:id` | Edit owned category | 200 |
| DELETE | `/categories/:id` | Delete unused category | 204 |
| GET | `/courses` | List published courses, max 50 | 200 |
| GET | `/courses/:id` | Published course detail without lesson resource URLs | 200 |
| GET | `/courses/mine/list` | Instructor's courses | 200 |
| GET | `/courses/:id/manage` | Owner/admin detail | 200 |
| POST | `/courses` | Create draft | 201 |
| PATCH | `/courses/:id` | Edit owned draft | 200 |
| DELETE | `/courses/:id` | Delete owned draft | 204 |
| PUT | `/courses/:id/curriculum` | Replace draft sections and lessons | 200 |
| POST | `/courses/:id/submit` | Send draft with a lesson for review | 200 |
| POST | `/courses/:id/approve` | Admin publishes reviewed course | 200 |

Prices are decimal numbers in major currency units with at most two digits after the decimal point. `price: 0` is free; positive `price` is paid; optional `discountPrice` must be nonnegative and strictly below positive `price`. `currency` is a three-letter uppercase code, default `USD`. Slugs use lowercase letters, digits and hyphens; database uniqueness returns 409 for duplicate slugs.

## Exact Postman examples

1. Create category: `POST /categories`, instructor bearer and JSON headers, body `{"name":"Digital Skills","slug":"digital-skills"}`. Expected `201`: `{"category":{"id":"<category-uuid>","name":"Digital Skills","slug":"digital-skills","ownerId":"<instructor-uuid>","description":null,"parentId":null,"createdAt":"<timestamp>","updatedAt":"<timestamp>"}}`.
2. Create draft: `POST /courses`, same headers, body `{"categoryId":"<category-uuid>","title":"Digital Skills 101","slug":"digital-skills-101","description":"A fictional beginner course","price":50,"discountPrice":40,"currency":"USD"}`. Expected `201`: `{"course":{"id":"<course-uuid>","status":"DRAFT","title":"Digital Skills 101","slug":"digital-skills-101","price":"50","discountPrice":"40","...":"other persisted fields"}}`.
3. Update curriculum: `PUT /courses/<course-uuid>/curriculum`, same headers, body `{"sections":[{"title":"Basics","lessons":[{"title":"Welcome","type":"ARTICLE","isPreview":true}]}]}`. Expected `200` with `course.sections[0].lessons[0].title` equal to `Welcome`.
4. Submit: `POST /courses/<course-uuid>/submit`, instructor bearer header, empty body. Expected `200` with `course.status` equal to `IN_REVIEW`. Public `GET /courses/<course-uuid>` remains `404` until admin approval.
5. Unauthorized update: `PATCH /courses/<course-uuid>`, another instructor bearer and JSON headers, body `{"title":"Changed by another user"}`. Expected `403`: `{"error":{"code":"FORBIDDEN","message":"forbidden."}}`.
6. Admin approval: `POST /courses/<course-uuid>/approve`, admin bearer header. Expected `200` with `course.status` equal to `PUBLISHED`.

Other errors: missing/invalid bearer `401 UNAUTHORIZED`; learner role `403 FORBIDDEN`; invalid input or price `400 VALIDATION_ERROR`; duplicate slug `409 DUPLICATE_VALUE`; non-draft edit or missing lessons on submission `409 INVALID_STATUS`; missing resource `404 NOT_FOUND`. Curriculum PUT replaces all sections and lessons, so clients must send the complete structure.
