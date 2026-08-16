import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url:
      env("API_DATABASE_URL") ??
      "postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public",
  },
  migrations: {
    path: "prisma/migrations",
  },
});
