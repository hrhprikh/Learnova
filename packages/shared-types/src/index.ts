export type UserRole = "ADMIN" | "INSTRUCTOR" | "LEARNER";

export type HealthResponse = {
  status: "ok";
  service?: string;
  database?: "reachable";
};
