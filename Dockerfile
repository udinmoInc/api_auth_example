# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install all dependencies for compiling TS
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and build it
COPY src ./src
RUN npm run build

# Stage 2: Runtime stage
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install only production dependencies
RUN npm ci --only=production

# Copy generated Prisma Client from builder stage
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy built application from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Expose port and start application
EXPOSE 5000

CMD ["node", "dist/app.js"]
