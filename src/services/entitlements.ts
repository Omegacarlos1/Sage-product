import type { PrismaClient } from "../generated/prisma/client";

export const isFreeCourse = (course: { price: { toString(): string }; discountPrice: { toString(): string } | null }) =>
  Number(course.discountPrice ?? course.price) === 0;

export async function hasLessonEntitlement(db: PrismaClient, course: { id: string; status: string; price: { toString(): string }; discountPrice: { toString(): string } | null }, userId: string) {
  if (course.status !== "PUBLISHED") return false;
  return await db.enrollment.count({ where: {
    courseId: course.id, learnerId: userId, status: { in: ["ACTIVE", "COMPLETED"] },
    ...(isFreeCourse(course) ? {} : { payment: { is: { status: "SUCCEEDED", userId, courseId: course.id } } }),
  } }) > 0;
}
