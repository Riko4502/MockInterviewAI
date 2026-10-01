"use client";

import type { Specialization } from "@packages/dto";
import { useMemo } from "react";

export const POPULAR_SKILLS_BY_SPECIALIZATION: Record<
  Specialization,
  string[]
> = {
  FRONTEND: [
    "React",
    "TypeScript",
    "Next.js",
    "Redux Toolkit",
    "TailwindCSS",
    "Vue.js",
    "JavaScript",
    "HTML/CSS",
    "Vite",
  ],
  BACKEND: [
    "Node.js",
    "NestJS",
    "Go",
    "PostgreSQL",
    "Redis",
    "Docker",
    "Kafka",
    "Python",
    "REST API",
  ],
  FULLSTACK: [
    "React",
    "TypeScript",
    "Node.js",
    "Next.js",
    "PostgreSQL",
    "Docker",
    "TailwindCSS",
    "REST API",
  ],
  DEVOPS: [
    "Docker",
    "Kubernetes",
    "CI/CD",
    "Linux",
    "Terraform",
    "Ansible",
    "Prometheus",
    "Grafana",
    "GitLab CI",
  ],
  QA: [
    "Manual Testing",
    "Playwright",
    "Postman",
    "Cypress",
    "Jest",
    "API Testing",
    "Test Cases",
    "Regression",
  ],
  MOBILE: [
    "React Native",
    "Flutter",
    "Swift",
    "Kotlin",
    "iOS",
    "Android",
    "TypeScript",
    "Mobile UI",
  ],
  DATA_ML: [
    "Python",
    "PyTorch",
    "Pandas",
    "NumPy",
    "SQL",
    "Machine Learning",
    "Deep Learning",
    "NLP",
  ],
  SYSTEM_DESIGN: [
    "Highload",
    "Microservices",
    "Sharding",
    "Caching (Redis)",
    "Kafka / RabbitMQ",
    "PostgreSQL",
    "API Gateway",
  ],
};

export function useSkillSuggestions(specialization?: Specialization) {
  return useMemo(() => {
    if (!specialization) return [];
    return POPULAR_SKILLS_BY_SPECIALIZATION[specialization] ?? [];
  }, [specialization]);
}
