# Gemini Project: EchoLearn

## Project Overview

This is a Next.js application built with TypeScript. It uses Tailwind CSS for styling and Supabase (PostgreSQL) as the database. Authentication is handled by NextAuth.js. The project is named "EchoLearn" and appears to be a platform for language learning, possibly through speech and audio recordings.

## Building and Running

### Development

To run the development server:

```bash
npm run dev
```

### Build

To build the application for production:

```bash
npm run build
```

### Start

To start a production server:

```bash
npm run start
```

### Lint

To run the linter:

```bash
npm run lint
```

### Database Migrations

To run database migrations, use the following command:

```bash
node scripts/run-migration.js <migration_file_name>
```

For example:

```bash
node scripts/run-migration.js add_course_id_to_recordings.sql
```

## Development Conventions

*   **Framework:** Next.js with TypeScript
*   **Styling:** Tailwind CSS
*   **Database:** Supabase (PostgreSQL)
*   **Authentication:** NextAuth.js
*   **Linting:** ESLint
*   **Package Manager:** The `package-lock.json` file indicates that `npm` is used for package management.
*   **Code Formatting:** The project uses Prettier for code formatting, which is integrated with ESLint.
*   **Database Migrations:** Database migrations are located in the `migrations` directory and are written in SQL. A custom script `scripts/run-migration.js` is used to run them.
