# M13 reviews and ratings API

Base URL: `http://localhost:3000/api/v1`. Send `Content-Type: application/json` for writes and `Authorization: Bearer <learner-access-token>` for learner writes. Admin moderation requires an admin token. Replace UUID placeholders with actual IDs.

Only active or completed learners enrolled in a published course can create a review. Paid courses require the enrollment's successful payment. A learner has one review per course and may edit it. Cancelled learners cannot edit. A hidden review cannot be edited or shown publicly; only an admin can restore it. The rating is an integer from 1 to 5. Comments are optional, at most 2,000 characters. These policies are proposed M13 contracts pending team confirmation.

| Scenario | Method and URL | JSON body | Expected response |
| --- | --- | --- | --- |
| Create | `POST /courses/{courseId}/reviews` | `{"rating":4,"comment":"Clear lessons"}` | `201 {"review":{"id":"<uuid>","rating":4,"comment":"Clear lessons","createdAt":"<ISO date>","updatedAt":"<ISO date>"}}` |
| Edit | `PATCH /courses/{courseId}/reviews/mine` | `{"rating":5,"comment":"Excellent"}` | `200` with the updated review shape |
| Invalid rating | `POST /courses/{courseId}/reviews` | `{"rating":6}` | `400 {"error":{"code":"VALIDATION_ERROR","message":"validation error."}}` |
| Duplicate | `POST /courses/{courseId}/reviews` | `{"rating":4}` | `409 {"error":{"code":"REVIEW_EXISTS","message":"review exists."}}` |
| Ineligible | `POST /courses/{courseId}/reviews` | `{"rating":4}` | `403 {"error":{"code":"FORBIDDEN","message":"forbidden."}}` |
| List | `GET /courses/{courseId}/reviews?page=1&limit=20` | None | `200 {"reviews":[{"id":"<uuid>","rating":5,"comment":"Excellent","createdAt":"<ISO date>","updatedAt":"<ISO date>","reviewerName":"Ada"}],"rating":{"average":5,"count":1},"page":1,"limit":20}` |
| Hide | `PATCH /reviews/{reviewId}/moderation` | `{"hidden":true,"reason":"Spam"}` | `200 {"reviewId":"<uuid>","hidden":true}` |
| Restore | `PATCH /reviews/{reviewId}/moderation` | `{"hidden":false}` | `200 {"reviewId":"<uuid>","hidden":false}` |

Public listing never includes email, user ID, moderation reason, or hidden reviews. `average` is `null` when `count` is zero. Aggregate values are computed by PostgreSQL from visible review rows, so edits and moderation immediately affect the next request. Listing and aggregate share a repeatable-read transaction for a consistent snapshot. These are contract examples, not manually observed Postman results.
