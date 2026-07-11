# Chatly — Backend

Realtime chat API built with NestJS, Prisma, PostgreSQL, Socket.IO, and ImageKit for file storage.

## Stack

- NestJS + TypeScript
- PostgreSQL (Neon) via Prisma
- Socket.IO for realtime messaging, presence, and typing
- JWT access + refresh tokens
- ImageKit for avatar/message file storage
- Deployed on Railway

## Getting started

```bash
npm install
cp .env.example .env   # fill in your own values
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

Runs at `http://localhost:3000`. Swagger docs at `/api/docs`.

## Environment variables

See `.env.example` for the full list — database URL, JWT secrets, ImageKit keys, and `CORS_ORIGIN` (must match your deployed frontend's URL exactly).

## API overview

Auth, users (profile/avatar/search), conversations, and messages all live under `/api`. Full endpoint list and request/response shapes are documented in Swagger once the server is running.

Socket.IO connects on the root URL (no `/api` prefix) with the access token passed as `socket.handshake.auth.token`. Events: `joinConversation`, `leaveConversation`, `typing`, `stopTyping`, `messageDelivered`, `messageRead` (client → server) and `newMessage`, `messageUpdated`, `messageDeleted`, `messageStatusUpdate`, `typing`, `stopTyping`, `userStatus` (server → client).

## Deployment

Deployed on Railway, database on Neon, files on ImageKit. After any schema change, run `npx prisma migrate deploy` against the production database before deploying the new code.