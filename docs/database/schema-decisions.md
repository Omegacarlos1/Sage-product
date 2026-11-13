# M02 proposed schema decisions

These are implementation proposals for the schema. They preserve shared user/instructor relationships and avoid implementing later milestone behavior early.

| Area | Proposal | Reason / later owner |
| --- | --- | --- |
| Users and roles | One `users` row with shared learner/instructor profile tables and a many-to-many `roles` assignment. | A person may learn and teach; M03 owns authentication and authorization rules. |
| Course owner | `courses.instructorId` references `instructor_profiles.userId`. | Avoid duplicate user/instructor identities. M04/M05 own profile and course workflows. |
| Course organization | Categories may have one parent; course sections and lessons have unique ordering within their parent. | Supports catalog and curriculum without hard-coded category depth. |
| Money | `DECIMAL(10,2)` and a three-character currency code. No gateway or payout behavior is included. | Keeps amounts exact; provider and fee policy remain for M09/M14. |
| Enrollment | Unique `(learnerId, courseId)` and restrictive deletion of referenced learners/courses. | Prevents duplicate enrollments and accidental loss of payment/learning history. |
| Assessment | Quiz questions/options, attempts, answers, assignments, and submissions are modeled. | M11 owns scoring and answer-visibility rules; M02 establishes storage only. |
| Certificate and review | One certificate per enrollment; one review per user/course; rating range is enforced by the API in M13. | Establishes natural uniqueness while later milestones implement eligibility and revocation. |
| Newsletter | `subscribers.email` is unique. M06 must normalize email before writes and handle unique conflicts safely. | The database unique constraint handles concurrent duplicates; API behavior is later scope. |
| Contact messages | Optional sender reference with `SET NULL`; message content is never written to application logs. | Allows guest contact and later account removal without exposing message data. |
| Notifications/progress | Storage tables exist; no REST, Socket.IO, or progress behavior is implemented here. | M10 and M16 own those workflows. |

Before applying the initial migration to a database that already has user tables or data, stop and review compatibility. M02's local databases are expected to be empty. No destructive reset is part of this plan.
