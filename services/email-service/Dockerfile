# Email Service Dockerfile

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies for building
RUN npm ci && npm cache clean --force

# Install TypeScript globally to avoid npx permission issues
RUN npm install -g typescript

# Copy source code
COPY . .

# Build the application using TypeScript compiler directly
RUN tsc -p tsconfig.build.json

# Production stage  
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Expose port (Railway will set PORT environment variable)
EXPOSE 8080

# Switch to non-root user
USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-8080}/health || exit 1

# Start the application
CMD ["node", "dist/main.js"]