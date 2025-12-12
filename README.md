# Clip Manager 🎬

A modern web application for uploading, analyzing, browsing, and searching AI-generated video clips from ComfyUI. Features automatic content moderation, AI-powered tagging, metadata extraction, and a beautiful Tailwind CSS interface.

## Features

✨ **Video Upload**
- Drag-and-drop file upload
- Support for MP4, MOV, AVI, WebM, MKV formats
- Real-time upload progress tracking
- Automatic metadata extraction

🤖 **AI-Powered Analysis**
- Optional content moderation (Google Cloud Vision API)
- Automatic tag generation
- ComfyUI metadata extraction (model, prompt, parameters)
- Tag-based search functionality

🎨 **Modern UI**
- Beautiful dark theme with Tailwind CSS
- Responsive design (mobile, tablet, desktop)
- Smooth animations and transitions
- Video modal with metadata display
- Glass morphism effects

📊 **Video Management**
- Browse all uploaded videos in a gallery
- Search by tags or keywords
- View detailed video information
- Track video views
- Popular tags display

## Installation

### Option 1: Docker (Recommended)

**Prerequisites:**
- Docker
- Docker Compose

**Setup:**

1. Navigate to the project directory:
```bash
cd /Users/BQ72TR/git/clip-manager
```

2. Build and start the container:
```bash
docker-compose up -d
```

3. Open your browser:
```
http://localhost:3000
```

4. View logs (optional):
```bash
docker-compose logs -f
```

5. Stop the container:
```bash
docker-compose down
```

**Note:** Uploads and database are persisted in the host directory via volumes.

### Option 2: Local Installation

**Prerequisites:**
- Node.js (v14 or higher)
- npm or yarn
- FFmpeg (for video metadata extraction)

**Install FFmpeg:**

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg
```

**Windows:**
Download from [ffmpeg.org](https://ffmpeg.org/download.html)

**Setup:**

1. Clone or navigate to the project directory:
```bash
cd /Users/BQ72TR/git/clip-manager
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment (optional):
```bash
cp .env.example .env
# Edit .env with your preferred settings
```

4. Start the server:
```bash
npm start
```

5. Open your browser:
```
http://localhost:3000
```

## Configuration

Edit `.env` file to customize settings:

```env
# Server Configuration
PORT=3000

# Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=104857600  # 100MB in bytes

# Database Configuration
DB_PATH=./database.db

# Video Analysis (Optional - Google Cloud Vision API)
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
# ENABLE_CONTENT_MODERATION=true
# ENABLE_AUTO_TAGGING=true

# Content Moderation Thresholds
MODERATION_THRESHOLD=0.7
TAG_CONFIDENCE_THRESHOLD=0.5
```

## Optional: Google Cloud Vision API

For advanced content moderation and AI tagging:

1. Create a Google Cloud project
2. Enable Video Intelligence API
3. Create a service account and download JSON key
4. Set environment variable:
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
```
5. Update `.env`:
```env
ENABLE_CONTENT_MODERATION=true
ENABLE_AUTO_TAGGING=true
```

**Note:** The application works without Google Cloud Vision API. It will use basic tag extraction from filenames and metadata instead.

## API Endpoints

### Upload Video
```
POST /api/upload
Content-Type: multipart/form-data

Body:
- video: video file
- title: optional title
```

### Get All Videos
```
GET /api/videos
```

### Get Video by ID
```
GET /api/videos/:id
```

### Search Videos
```
GET /api/search?tags=landscape,hd
GET /api/search?q=landscape
```

### Get Popular Tags
```
GET /api/tags
```

### Delete Video
```
DELETE /api/videos/:id
```

## Project Structure

```
clip-manager/
├── server.js              # Express server & API routes
├── database.js            # SQLite database operations
├── metadataExtractor.js   # Video metadata & ComfyUI parsing
├── videoAnalysis.js       # Content moderation & AI tagging
├── package.json           # Dependencies
├── Dockerfile             # Docker container definition
├── docker-compose.yml     # Docker orchestration
├── .dockerignore          # Docker build exclusions
├── .env                   # Configuration (create from .env.example)
├── public/
│   ├── index.html        # Main HTML
│   ├── css/
│   │   └── styles.css    # Custom styles
│   └── js/
│       └── app.js        # Frontend JavaScript
└── uploads/              # Uploaded videos (auto-created)
```

## Usage

### Upload a Video

1. Navigate to the upload section
2. Drag and drop a video file or click to browse
3. Optionally enter a custom title
4. Click "Upload Video"
5. Wait for processing (metadata extraction, tagging, analysis)
6. Video appears in the gallery

### Browse Videos

- All approved videos are displayed in the gallery
- Click on any video to view details in a modal
- View duration, resolution, tags, and metadata
- Click tags to search for similar videos

### Search Videos

- Use the search bar to filter by tags or keywords
- Click on popular tags to quickly filter
- Search is case-insensitive and supports multiple keywords

## Development

### Docker Development

```bash
# Rebuild after code changes
docker-compose up --build

# Run with live logs
docker-compose up
```

### Local Development

```bash
npm run dev
```

Uses `nodemon` for auto-restart on file changes.

### Database Schema

**videos table:**
- id, filename, original_name, title, file_size, duration
- upload_date, metadata, status, rejection_reason, views

**tags table:**
- id, video_id, tag_name, confidence, source

## Deployment Considerations

For production deployment:

1. Use a process manager (PM2, systemd)
2. Set up reverse proxy (nginx, Apache)
3. Enable HTTPS
4. Consider migrating to PostgreSQL/MySQL
5. Use cloud storage (AWS S3, Google Cloud Storage)
6. Set up proper logging
7. Configure CORS for your domain
8. Set strong file size limits and validation

## Troubleshooting

**FFmpeg errors:**
- Ensure FFmpeg is installed and in PATH
- Test: `ffmpeg -version`

**Upload fails:**
- Check file size limits (default 100MB)
- Verify file format is supported
- Check server logs for detailed errors

**Videos don't appear:**
- Check database file exists (`database.db`)
- Verify uploads directory has write permissions
- Check browser console for API errors

## License

MIT

## Credits

Built with:
- Node.js & Express
- SQLite & better-sqlite3
- FFmpeg & fluent-ffmpeg
- Tailwind CSS
- Google Cloud Vision API (optional)
