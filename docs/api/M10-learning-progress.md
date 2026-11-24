# M10 learning progress API

Base URL: `http://localhost:3000/api/v1`. All routes require `Authorization: Bearer {{learnerToken}}`; writes also require `Content-Type: application/json`. Only the caller's active, entitled enrollment can read or change progress. Paid courses require a succeeded matching payment. The client cannot choose a learner ID.

## Mark complete, bookmark, note and position

`PUT /lessons/{{lessonId}}/progress`

```json
{"completed":true,"bookmarked":true,"note":"Review this example","lastPositionSeconds":30}
```

Expected `200` (IDs and timestamp vary):

```json
{"progress":{"id":"<uuid>","learnerId":"<caller-uuid>","lessonId":"<lesson-uuid>","completedAt":"2026-11-24T12:00:00.000Z","lastPositionSeconds":30,"bookmarked":true,"note":"Review this example","updatedAt":"2026-11-24T12:00:00.000Z"}}
```

Send `{"completed":true}` again to keep the original `completedAt`. `bookmarked` may be `false`, `note` may be `null`, and position must be a nonnegative integer no greater than the lesson duration when one exists. Completion cannot be reversed in M10.

## Aggregate progress

`GET /courses/{{courseId}}/progress`

Expected `200` for a course with one completed required lesson and one optional lesson:

```json
{"courseId":"<course-uuid>","requiredLessons":1,"completedRequiredLessons":1,"completionPercent":100,"complete":true,"resumeLessonId":null,"lessons":[{"id":"<lesson-uuid>","title":"First","isRequired":true,"completedAt":"2026-11-24T12:00:00.000Z","bookmarked":true,"note":"Review this example","lastPositionSeconds":30},{"id":"<optional-uuid>","title":"Optional","isRequired":false,"completedAt":null,"bookmarked":false,"note":null,"lastPositionSeconds":0}]}
```

Instructors set `isRequired` on lessons in the draft curriculum. It defaults to `true`. Percentage is computed from required lessons on each read, rounded to a whole number. A course with no required lessons reports `0` and `complete: false`.

## Resume point

`PUT /courses/{{courseId}}/resume`

```json
{"lessonId":"<lesson-uuid-in-course>"}
```

Expected `200`:

```json
{"courseId":"<course-uuid>","resumeLessonId":"<lesson-uuid-in-course>"}
```

## Error examples

Missing or invalid bearer token: `401` with `{"error":{"code":"UNAUTHORIZED","message":"Authentication required."}}`. Wrong role or no entitled enrollment: `403` with `{"error":{"code":"FORBIDDEN","message":"forbidden."}}`. Invalid body, UUID, position, or resume lesson outside the course: `400` with `{"error":{"code":"VALIDATION_ERROR","message":"validation error."}}`. Unknown course or lesson: `404` with `{"error":{"code":"NOT_FOUND","message":"not found."}}`.

These are contract examples, not Postman execution results. Confirm the endpoint shapes with the frontend team before treating them as final.
