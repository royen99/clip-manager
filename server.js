const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
require('dotenv').config();

const {
    createVideo,
    addTags,
    getAllVideosWithTags,
    searchVideosByTags,
    getVideoWithTags,
    videoOperations
} = require('./database');

const { extractComfyUIMetadata, generateBasicTags } = require('./metadataExtractor');
const { analyzeVideo } = require('./videoAnalysis');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));
app.use('/uploads', express.static(UPLOAD_DIR));

// Configure multer for video uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            await fs.mkdir(UPLOAD_DIR, { recursive: true });
            cb(null, UPLOAD_DIR);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'video-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024 // 100MB default
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /mp4|mov|avi|webm|mkv/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only video files are allowed (mp4, mov, avi, webm, mkv)'));
        }
    }
});


// Database is initialized automatically when the module is loaded

// API Routes

/**
 * Upload video endpoint
 */
app.post('/api/upload', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file provided' });
        }

        const videoPath = path.join(UPLOAD_DIR, req.file.filename);
        const { title } = req.body;

        console.log(`Processing uploaded video: ${req.file.originalname}`);

        // Extract metadata
        const metadata = await extractComfyUIMetadata(videoPath);

        // Generate basic tags from filename and metadata
        const basicTags = generateBasicTags(req.file.originalname, metadata);

        // Analyze video (content moderation + AI tagging)
        const analysis = await analyzeVideo(videoPath);

        // Check if video is approved
        if (!analysis.moderation.approved) {
            await fs.unlink(videoPath); // Delete rejected video
            return res.status(400).json({
                error: 'Video rejected',
                reason: analysis.moderation.reason,
                confidence: analysis.moderation.confidence
            });
        }

        // Create video record in database
        const videoId = createVideo({
            filename: req.file.filename,
            originalName: req.file.originalname,
            title: title || req.file.originalname,
            fileSize: req.file.size,
            duration: metadata.basic.duration,
            metadata: metadata
        });

        // Combine all tags (basic + AI)
        const allTags = [...basicTags, ...analysis.aiTags];

        // Add tags to database
        if (allTags.length > 0) {
            addTags(videoId, allTags);
        }

        // Fetch complete video data to return
        const videoData = getVideoWithTags(videoId);

        console.log(`Video uploaded successfully: ID ${videoId}`);

        res.json({
            success: true,
            message: 'Video uploaded successfully',
            video: videoData
        });

    } catch (error) {
        console.error('Upload error:', error);

        // Clean up file if it exists
        if (req.file) {
            try {
                await fs.unlink(path.join(UPLOAD_DIR, req.file.filename));
            } catch (unlinkError) {
                console.error('Error deleting file:', unlinkError);
            }
        }

        res.status(500).json({
            error: 'Upload failed',
            message: error.message
        });
    }
});

/**
 * Get all videos
 */
app.get('/api/videos', (req, res) => {
    try {
        const videos = getAllVideosWithTags();
        res.json({ success: true, videos });
    } catch (error) {
        console.error('Error fetching videos:', error);
        res.status(500).json({ error: 'Failed to fetch videos' });
    }
});

/**
 * Get video by ID
 */
app.get('/api/videos/:id', (req, res) => {
    try {
        const video = getVideoWithTags(parseInt(req.params.id));

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Increment view count
        videoOperations.incrementViews.run(video.id);

        res.json({ success: true, video });
    } catch (error) {
        console.error('Error fetching video:', error);
        res.status(500).json({ error: 'Failed to fetch video' });
    }
});

/**
 * Search videos by tags
 */
app.get('/api/search', (req, res) => {
    try {
        const { tags, q } = req.query;

        let tagArray = [];
        if (tags) {
            tagArray = tags.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
        } else if (q) {
            tagArray = q.split(' ').map(t => t.trim().toLowerCase()).filter(t => t);
        }

        const videos = searchVideosByTags(tagArray);
        res.json({ success: true, videos, query: tagArray });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

/**
 * Get all unique tags
 */
app.get('/api/tags', (req, res) => {
    try {
        const db = require('./database').db;
        const tags = db.prepare(`
      SELECT DISTINCT tag_name, COUNT(*) as count
      FROM tags
      GROUP BY tag_name
      ORDER BY count DESC
      LIMIT 50
    `).all();

        res.json({ success: true, tags });
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ error: 'Failed to fetch tags' });
    }
});

/**
 * Delete video
 */
app.delete('/api/videos/:id', async (req, res) => {
    try {
        const video = getVideoWithTags(parseInt(req.params.id));

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Delete file
        const filePath = path.join(UPLOAD_DIR, video.filename);
        await fs.unlink(filePath);

        // Delete from database (tags will be deleted via CASCADE)
        videoOperations.deleteVideo.run(video.id);

        res.json({ success: true, message: 'Video deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Failed to delete video' });
    }
});

/**
 * Download ComfyUI workflow JSON
 */
app.get('/api/videos/:id/workflow', (req, res) => {
    try {
        const video = getVideoWithTags(parseInt(req.params.id));

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Check if video has ComfyUI workflow
        if (!video.metadata?.comfyui?.workflow) {
            return res.status(404).json({ error: 'No ComfyUI workflow found for this video' });
        }

        // Set headers for download
        const filename = `${video.title.replace(/[^a-z0-9]/gi, '_')}_workflow.json`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/json');

        // Send workflow JSON
        res.json(video.metadata.comfyui.workflow);
    } catch (error) {
        console.error('Workflow download error:', error);
        res.status(500).json({ error: 'Failed to download workflow' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🎬 Clip Manager Server running on http://localhost:${PORT}`);
    console.log(`📁 Upload directory: ${UPLOAD_DIR}`);
    console.log(`💾 Database: ${process.env.DB_PATH || './database.db'}\n`);
});

module.exports = app;
