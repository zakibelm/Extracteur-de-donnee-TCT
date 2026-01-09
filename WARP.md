# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## High-level code architecture

This is a Vite-based React application with a serverless backend deployed on Vercel. The frontend is built with React and Tailwind CSS, and the backend uses Express.js with TypeScript. The database is managed with Drizzle ORM and NeonDB.

- `src/`: Contains the frontend code.
- `api/`: Contains the serverless functions for the backend.
- `drizzle/`: Contains the database schema and migration files.

## Common Commands

- `npm run dev`: Starts the development server.
- `npm run build`: Builds the application for production.
- `npm run preview`: Previews the production build locally.
- `npm run db:generate`: Generates database migration files.
- `npm run db:migrate`: Applies database migrations.

To run the application locally, you need to set the `GEMINI_API_KEY` in a `.env.local` file.
