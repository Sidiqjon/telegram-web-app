# Step 1: Use a reliable Node 22 image to build the app
FROM node:22-alpine AS builder
WORKDIR /app

# ADD THIS LINE: Install OpenSSL for the build stage
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci
COPY . .

RUN npx prisma generate
RUN npm run build

# Step 2: Create a lightweight image to run the app
FROM node:22-alpine
WORKDIR /app

# ADD THIS LINE: Install OpenSSL for the runtime stage
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main.js"]
