# Use Node.js LTS (Long Term Support) version
FROM node:18-alpine

# Install FFmpeg for video metadata extraction
RUN apk add --no-cache ffmpeg

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Set environment variables (can be overridden by docker-compose or -e flags)
ENV PORT=3000
ENV UPLOAD_DIR=/app/uploads
ENV DB_PATH=/app/database.db

# Start the application
CMD ["node", "server.js"]
