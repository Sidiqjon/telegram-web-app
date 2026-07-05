# Chat Backend — Telegram-like Realtime Chat API

NestJS + TypeScript + PostgreSQL (Prisma) + Socket.IO + ImageKit + JWT auth.

## 1. Install

```bash
npm install
```

## 2. Configure environment

```bash
cp .env.example .env
```

Fill in:
- `DATABASE_URL` — your Neon PostgreSQL connection string
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — any long random strings (different from each other)
- `IMAGEKIT_PUBLIC_KEY` / `IMAGEKIT_PRIVATE_KEY` / `IMAGEKIT_URL_ENDPOINT` — from your ImageKit dashboard

## 3. Generate the Prisma client & run migrations

```bash
npx prisma generate
npx prisma migrate dev --name init
```

This creates all tables (`users`, `refresh_tokens`, `conversations`, `conversation_participants`, `messages`, `message_status_entries`) in your database.

## 4. Run the server

```bash
npm run start:dev
```

- API base: `http://localhost:3000/api`
- Swagger docs: `http://localhost:3000/api/docs`
- Socket.IO connects to the same port (no `/api` prefix on the socket handshake)

## Auth flow

1. `POST /api/auth/register` — phoneNumber, username, fullName, password → returns `{ user, accessToken, refreshToken }`
2. `POST /api/auth/login` — phoneNumber, password → same response shape
3. Send `accessToken` as `Authorization: Bearer <token>` on every request
4. When the access token expires (15 min default), call `POST /api/auth/refresh` with the `refreshToken` to get a new pair
5. `POST /api/auth/logout` with the `refreshToken` to revoke it

## Socket.IO connection (frontend example)

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: accessToken },
});

socket.emit('joinConversation', { conversationId });
socket.emit('sendMessage', { conversationId, text: 'hello' });
socket.on('newMessage', (message) => { /* ... */ });
socket.on('typing', ({ conversationId, userId }) => { /* ... */ });
socket.on('userStatus', ({ userId, isOnline, lastSeen }) => { /* ... */ });
```

## REST endpoints overview

| Method | Route | Purpose |
|---|---|---|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Log in |
| POST | /api/auth/refresh | Rotate access/refresh tokens |
| POST | /api/auth/logout | Revoke a refresh token |
| GET | /api/auth/me | Current user |
| GET | /api/users/search?username= | Search users |
| PATCH | /api/users/me | Update profile |
| POST | /api/users/me/avatar | Upload avatar (multipart, field `avatar`) |
| DELETE | /api/users/me/avatar | Remove avatar |
| POST | /api/conversations | Find-or-create a private chat, body `{ participantId }` |
| GET | /api/conversations | List my conversations |
| POST | /api/messages | Send a text message |
| POST | /api/messages/file | Send an image/file (multipart, field `file`, body `conversationId`, `type`) |
| GET | /api/messages/conversation/:id?cursor=&limit=20 | Paginated history |
| PATCH | /api/messages/:id | Edit a text message |
| DELETE | /api/messages/:id | Soft-delete a message |
| PATCH | /api/messages/conversation/:id/read | Mark conversation read |

## Deploying to Northflank

1. Push this repo to GitHub.
2. Create a Northflank service from the repo, build command `npm install && npx prisma generate && npm run build`, start command `npm run start:prod`.
3. Add all the `.env` variables as Northflank environment variables/secrets.
4. Run `npx prisma migrate deploy` against the Neon database once (via a Northflank job or locally pointed at the remote `DATABASE_URL`).

## Note on this sandbox build

Everything here was type-checked end-to-end (`tsc --noEmit`) with zero errors. The one thing I could **not** verify inside this sandbox is `npx prisma generate` completing fully — this container's network doesn't have access to `binaries.prisma.sh`, which Prisma needs to download its query engine binary. This is purely a sandbox restriction; your machine will download it normally. Just make sure step 3 above succeeds before you run migrations.
