# MD Business Flow - Next.js Starter

This is a comprehensive starter project for building modern web applications using Next.js, managed within Firebase Studio. It comes pre-configured with a professional tech stack to accelerate your development.

## Features

- **Framework**: [Next.js](https://nextjs.org/) with App Router
- **UI**: [React](https://react.dev/) with [ShadCN UI](https://ui.shadcn.com/) components
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **AI Integration**: [Genkit](https://firebase.google.com/docs/genkit) for generative AI features
- **Database**: [Dexie.js](https://dexie.org/) for powerful client-side IndexedDB storage
- **PWA Support**: Offline capabilities for a robust user experience

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)

## Getting Started

Follow these steps to get your development environment up and running.

### 1. Installation

First, install the necessary project dependencies by running the following command in your terminal:

```bash
npm install
```

### 2. Running the Development Server

You have two ways to start the application:

#### Option A: One-Click (for Windows users)

Simply double-click the `start-dev.bat` file in the project's root directory. This will automatically open two terminal windows: one for the Next.js application and one for the Genkit AI server.

#### Option B: Manual Terminal Commands

If you are not on Windows or prefer using the terminal, you will need to open **two separate terminals** and run the following commands:

**In the first terminal**, start the Next.js web application:
```bash
npm run dev
```
This will start the main application, typically on `http://localhost:9004`.

**In the second terminal**, start the Genkit development server for AI features:
```bash
npm run genkit:watch
```
This server handles AI-related tasks and flows.

## Available Scripts

This project includes several useful scripts defined in `package.json`:

- `npm run dev`: Starts the Next.js development server.
- `npm run genkit:dev`: Starts the Genkit AI server.
- `npm run genkit:watch`: Starts the Genkit AI server with auto-reload on file changes.
- `npm run build`: Creates a production-ready build of your application.
- `npm run start`: Starts the production server (requires a build to be run first).
- `npm run lint`: Lints the code to check for errors and style issues.
- `npm run typecheck`: Runs the TypeScript compiler to check for type errors.
