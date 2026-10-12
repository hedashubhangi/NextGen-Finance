# NextGen Finance

NextGen Finance is a full-stack financial literacy learning platform for students and parents.

First-time visitors get a skippable spotlight tour of the sidebar, chapter map, saved learning path, question streaks, final test, games, and rewards. It includes try-it questions for a practice check and a game move, then is shown only once per browser.

Chapter 1 includes three replayable runner games: Barter Market, Goods Dash, and Needs & Wants Catcher. Learners answer topic questions to earn jump charges, then use the Jump button (or Space) to time jumps over obstacles. The scene tracks distance to the next obstacle, while a five-slot meter shows charges; questions at running checkpoints replenish them. There are no collectible energy power-ups. Each game has three-minute rounds, five hearts, a score, saved progress, and a completion reward with a topic badge. Runner questions are shuffled without repeats for each run, and the order is saved when a game is in progress.

## Project structure

```text
frontend/
  src/              React pages and reusable learning components
  public/           Static browser assets
  index.html        Vite entry document
  vite.config.ts    Vite config and API proxy
backend/
  index.js          Express API
  data.json         Local progress store
package.json        Root scripts and shared dependencies
```

## Run locally

Install dependencies once:

```bash
npm install
```

Start the frontend and API together from the project root:

```bash
npm run dev
```

The frontend runs at `http://localhost:5173` and the API runs at `http://localhost:3001`. Development API requests use the Vite proxy, so a `VITE_API_URL` setting will not send local account requests to an unavailable or stale server. The Vite startup output also shows a Network URL; devices on the same Wi-Fi can use it to reach the same API and account data.

You can also start both services from inside `frontend/`:

```bash
npm run dev
```

For API-only work, start the backend separately (do not also run `npm run dev`):

```bash
cd backend
npm start
```

For access over the public internet, deploy the frontend and API rather than exposing the Vite development server. Set `VITE_API_URL` to the deployed API base URL when building the frontend. The API must be reachable from every device that needs to sign in, and it must use persistent storage. `DATA_FILE` can set the JSON data file path for a single API instance; multiple API instances need a shared database before being used together. Set `API_PORT` to change the development API port used by both the server and Vite proxy.

For backend development with automatic restart:

```bash
npm run dev:server
```

## API routes

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/progress`
- `POST /api/progress/lessons/:lessonId/complete`
- `POST /api/progress/quiz`
- `GET /api/profiles`
- `PATCH /api/profiles/:profileId/learning-state`

Accounts use an email, username, and password. Passwords are stored as salted scrypt hashes, and signed-in learning profiles and lesson progress are stored by the API in `backend/data.json`. Learners can log in from another device when it can reach the same running API server. Keep this file on persistent storage when hosting the API; multiple API instances need a shared database before being used together.

## Build

```bash
npm run build
```
