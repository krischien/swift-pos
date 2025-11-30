-- Add password column to User table with default hashed value
ALTER TABLE "User" ADD COLUMN "password" TEXT NOT NULL DEFAULT '$2b$10$VwNM8YMo1sKEtKKbZ2tgMOtLdbBL2hjD9VtH003WfLW7C2iU0NICq';

