export type AuthUser = {
  id: string;
  email: string;
  role: "ADMIN" | "INSTRUCTOR" | "LEARNER";
};
