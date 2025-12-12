# Clip Manager 🎬

A modern web application for uploading, analyzing, browsing, and searching AI-generated video clips from ComfyUI. Features automatic content moderation, AI-powered tagging, metadata extraction, and a beautiful Tailwind CSS interface.

## Features

✨ **Video Upload**
- Drag-and-drop file upload
- Support for MP4, MOV, AVI, WebM, MKV formats
- Real-time upload progress tracking
- **ComfyUI Metadata Validation**: Only accepts videos with embedded workflow/metadata

🤖 **Local AI Analysis (Ollama)**
- **Content Rating System**: Classifies videos as SAFE, PG-13, R, or XXX
- **Automatic Tagging**: Generates descriptive tags using LLaVA vision model
- **Illegal Content Detection**: Strictly rejects prohibited content (CSAM, etc.)
- **Privacy Focused**: All analysis happens locally - no data leaves your server

🎨 **Modern UI**
- Beautiful dark theme with Tailwind CSS
- **Smart Content Blurring**: Automatically blurs thumbnails for R/XXX rated content
- Responsive design (mobile, tablet, desktop)
- Video modal with detailed ComfyUI workflow data

📊 **Video Management**
- Browse all uploaded videos in a gallery
- Filter by Content Rating or Tag
- Search by prompt, model, or generation parameters
- View detailed metadata and popularity stats

## Installation

### Option 1: Docker (Recommended)

**Prerequisites:**
- Docker
- Docker Compose

**Setup:**

1. Clone the repository:
```bash
git clone https://github.com/royen99/clip-manager.git
```

2. Navigate to the project directory:
```bash
cd clip-manager
```

3. Build and start the container:
```bash
docker-compose up -d
```

4. Open your browser:
```
http://localhost:3000
```

5. View logs (optional):
```bash
docker-compose logs -f
```

6. Stop the container:
```bash
docker-compose down
```

**Note:** Uploads and database are persisted in the host directory via volumes.

**Note:** If you are using podman instead of docker, use `podman-compose` instead of `docker-compose`.

#### Docker environment variables

Variable name | Description | Default value
--- | --- | ---
PORT | Server port | 3000
UPLOAD_DIR | Upload directory | /app/uploads
DB_PATH | Database path | /app/data/database.db
MAX_FILE_SIZE | Maximum file size | 100000000
OLLAMA_HOST | Ollama host | http://host.docker.internal:11434
OLLAMA_MODEL | Ollama model | llava:latest
FRAMES_TO_ANALYZE | Number of frames to analyze | 5
ENABLE_CONTENT_MODERATION | Enable content moderation | true
ENABLE_AUTO_TAGGING | Enable auto tagging | true
MODERATION_THRESHOLD | Moderation threshold | 0.7
TAG_CONFIDENCE_THRESHOLD | Tag confidence threshold | 0.6
ADMIN_USERNAME | Admin username | admin
ADMIN_PASSWORD | Admin password | changeme
SESSION_SECRET | Session secret | change-this-to-a-random-secret-string

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
cd clip-manager
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

# Video Analysis with Ollama (Free, Local or Remote)
# Install Ollama: https://ollama.ai
# Then run: ollama pull llava
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llava
FRAMES_TO_ANALYZE=3
ENABLE_CONTENT_MODERATION=true
ENABLE_AUTO_TAGGING=true

# Content Moderation Thresholds
MODERATION_THRESHOLD=0.7
TAG_CONFIDENCE_THRESHOLD=0.5
```

## 🛡️ Content Rating System & AI Analysis

Clip Manager uses local AI (Ollama + LLaVA) to automatically analyze every uploaded video. This ensures your library stays organized and safe.

### Rating Levels
The system assigns one of the following ratings to each video:

| Rating | Description | Handling |
|--------|-------------|----------|
| **SAFE** | General audiences, no mature content | Visible to all |
| **PG-13** | Mild themes, non-explicit | Visible to all |
| **R** | Mature themes, partial nudity | **Blurred Thumbnail** (Click to reveal) |
| **XXX** | Explicit content, nudity | **Blurred Thumbnail** (Click to reveal) |

### 🚫 Strictly Prohibited Content
**Zero Tolerance Policy**: The system is designed to **automatically reject** any content containing:
- Child Sexual Abuse Material (CSAM)
- Minors in sexualized contexts
- Non-consensual content

If such content is detected during analysis:
1. The upload is **immediately rejected**.
2. The file is **permanently deleted** from the server.
3. The incident is logged.

### 🤖 AI Setup (Ollama)
For these features to work, you need [Ollama](https://ollama.ai) running locally or on your network.

1. **Install Ollama:**
   ```bash
   curl https://ollama.ai/install.sh | sh
   ```

2. **Pull the Vision Model:**
   ```bash
   ollama pull llava
   ```

3. **Configure Docker:**
   Ensure `docker-compose.yml` points to your Ollama instance:
   ```yaml
   environment:
     - OLLAMA_HOST=http://host.docker.internal:11434
     - OLLAMA_MODEL=llava
   ```

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

> **Note**: Only videos generated by **ComfyUI** (with embedded workflow/prompt metadata) are accepted.

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
