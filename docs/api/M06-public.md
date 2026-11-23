# M06 public API contract (proposed for frontend confirmation)

Base URL: `http://localhost:3000/api/v1`. Public routes require no Authorization header. JSON POST requests use `Content-Type: application/json`. Error shape: `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }`.

| Method | URL | Example | Expected result |
| --- | --- | --- | --- |
| GET | `/courses?page=1&limit=20` | no body | 200 `{ "courses": [], "page": 1, "limit": 20, "total": 0 }` when empty |
| GET | `/courses?search=web&category=technology&level=BEGINNER&page=1&limit=10` | no body | 200, matching published courses only; total is the unpaged match count |
| GET | `/courses/sample-web-development` | no body | 200 `{ "course": { "slug": "sample-web-development", "status": "PUBLISHED", "category": {...}, "instructor": {...}, "sections": [...] } }`; lesson resource URLs omitted |
| GET | `/categories` | no body | 200 `{ "categories": [...] }` |
| GET | `/instructors/<verified-instructor-uuid>` | no body | 200 `{ "instructor": { "userId": "...", "displayName": "..." } }` |
| POST | `/contact` | `{ "name": "Ada", "email": "ada@example.com", "subject": "Course question", "message": "Please contact me." }` | 201 `{ "status": "received" }` |
| POST | `/newsletter/subscribe` | `{ "email": " Ada@Example.com " }` | first 201, repeated or concurrent duplicate 200; both `{ "status": "subscribed" }` |

`search` matches course title and description, category name, and instructor display name without case sensitivity. `category` is a slug. `level` is one of `BEGINNER`, `INTERMEDIATE`, `ADVANCED`, `ALL_LEVELS`. Page starts at 1; limit defaults to 20 and has a maximum of 50. Invalid filters or body fields return 400 `VALIDATION_ERROR`. Unpublished or unknown course detail returns 404 `NOT_FOUND`. Contact allows five submissions and newsletter allows twenty attempts per IP per hour in each server process; excess returns 429 `RATE_LIMITED`. These response examples are contract expectations, not live Postman outcomes.

Contact messages contain personal data. The `npm run contact:prune` job removes messages older than 90 days when scheduled by operations. It was not run against production. The per-process limiter needs a shared store before multiple replicas are used. Frontend should confirm slug versus ID links and the response fields before integrating.
