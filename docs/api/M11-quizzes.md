# M11 quizzes and assessments API

These are proposed `/api/v1` contracts. Use `Authorization: Bearer <accessToken>` and `Content-Type: application/json` for every request. IDs below are placeholders to replace with IDs returned by your local API. Responses are expected examples, not live Postman results.

## Author a quiz in a draft course

`POST /api/v1/courses/{courseId}/quizzes` requires the owning instructor. The course must be `DRAFT`; authored questions and answers are frozen once it is published. `lessonId`, `attemptLimit`, `timeLimitSeconds`, `opensAt`, and `closesAt` are optional. `passingScore` defaults to 70. A question has 2 to 10 options and 1 to 100 whole-number points; supported types are `SINGLE_CHOICE`, `MULTIPLE_CHOICE`, and `TRUE_FALSE`. Single-choice and true/false need exactly one correct option; multiple-choice needs at least one. Submit all questions together.

```json
{"title":"Lesson check","passingScore":70,"attemptLimit":1,"timeLimitSeconds":300,"questions":[{"prompt":"Which value is even?","type":"SINGLE_CHOICE","points":2,"options":[{"text":"2","isCorrect":true},{"text":"3","isCorrect":false}]}]}
```

Expected `201`: `{"quiz":{"id":"{quizId}","courseId":"{courseId}","title":"Lesson check","passingScore":"70","attemptLimit":1,"timeLimitSeconds":300,"opensAt":null,"closesAt":null,"questions":[{"id":"{questionId}","prompt":"Which value is even?","type":"SINGLE_CHOICE","points":"2","orderIndex":0,"options":[{"id":"{optionId}","text":"2","orderIndex":0},{"id":"{otherOptionId}","text":"3","orderIndex":1}]}]}}`. No answer key is returned. Expected errors: `400 VALIDATION_ERROR` for malformed input, `403 FORBIDDEN` for another instructor, `409 INVALID_STATUS` after publication.

## Read and start

`GET /api/v1/quizzes/{quizId}` requires an active enrolled learner with course entitlement. Expected `200` contains the same safe `quiz` shape above. It never includes `isCorrect` or correct option IDs. Expected `401 UNAUTHORIZED` without a token and `403 FORBIDDEN` without entitlement.

`POST /api/v1/quizzes/{quizId}/attempts` with body `{}` starts a quiz. Expected `201`: `{"attempt":{"id":"{attemptId}","quizId":"{quizId}","learnerId":"{yourUserId}","status":"IN_PROGRESS","score":null,"passed":null,"startedAt":"2026-11-24T12:00:00.000Z","submittedAt":null},"quiz":{...safe quiz...}}`. Start checks the open and close instants; the close instant is exclusive. Expected `409 QUIZ_NOT_OPEN`, `QUIZ_CLOSED`, `ATTEMPT_IN_PROGRESS`, or `ATTEMPT_LIMIT_REACHED`. Every started attempt counts toward the limit, including an expired attempt. Starts for the same learner and quiz are serialized in PostgreSQL.

## Submit and view result

`POST /api/v1/quiz-attempts/{attemptId}/submit` requires the attempt owner and active entitlement. Submit exactly one answer for every question, with distinct option IDs from that question. An incomplete or invalid set returns `400 VALIDATION_ERROR` and leaves the attempt open.

```json
{"answers":[{"questionId":"{questionId}","optionIds":["{optionId}"]}]}
```

Expected `200`: `{"result":{"attemptId":"{attemptId}","score":100,"passed":true,"earnedPoints":2,"possiblePoints":2,"submittedAt":"2026-11-24T12:01:00.000Z","answers":[{"questionId":"{questionId}","correctOptionIds":["{optionId}"],"selectedOptionIds":["{optionId}"]}]}}`. Only an exact match to the full correct option set earns a question's points. Score is `earned / possible * 100`, rounded to two decimals; passing uses that score and the configured threshold. No partial credit. A late submission returns `409 ATTEMPT_EXPIRED`; a repeat returns `409 ATTEMPT_CLOSED`.

`GET /api/v1/quiz-attempts/{attemptId}/result` returns the saved score, pass flag, and answer IDs after submission. Expected `200` has the `result` shape above without the two points fields. Before submission it returns `409 RESULT_NOT_AVAILABLE`; another learner receives `403 FORBIDDEN`.

Postman scenario order: create on draft course, publish the course using the existing admin flow, enroll the learner, read quiz, start, submit, view result, then try a second start to see `409 ATTEMPT_LIMIT_REACHED`. The Postman collection contains the learner portion and uses variables `baseUrl`, `learnerToken`, `quizId`, `attemptId`, `questionId`, and `optionId`. No manual Postman run is claimed.
