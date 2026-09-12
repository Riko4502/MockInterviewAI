import path from "node:path";
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join(__dirname, "prisma/schema.prisma"),
  datasource: {
    url:
      process.env.API_DATABASE_URL ??
      "postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public",
  },
  migrations: {
    path: path.join(__dirname, "prisma/migrations"),
  },
});
