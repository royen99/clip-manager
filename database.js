const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './database.db';

// Ensure parent directory exists
const dbDir = require('path').dirname(DB_PATH);
require('fs').mkdirSync(dbDir, { recursive: true });

const db = new Database(DB_PATH);

// Initialize database tables immediately
db.exec(`
  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    title TEXT,
    file_size INTEGER,
    duration REAL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    status TEXT DEFAULT 'approved',
    rejection_reason TEXT,
    views INTEGER DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    tag_name TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    source TEXT DEFAULT 'manual',
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(tag_name);
  CREATE INDEX IF NOT EXISTS idx_tags_video ON tags(video_id);
  CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
`);

console.log('Database initialized successfully');


// Video operations
const videoOperations = {
  // Insert a new video
  insertVideo: db.prepare(`
    INSERT INTO videos (filename, original_name, title, file_size, duration, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `),

  // Get all approved videos
  getAllVideos: db.prepare(`
    SELECT * FROM videos
    WHERE status = 'approved'
    ORDER BY upload_date DESC
  `),

  // Get video by ID
  getVideoById: db.prepare(`
    SELECT * FROM videos WHERE id = ?
  `),

  // Update video status
  updateVideoStatus: db.prepare(`
    UPDATE videos
    SET status = ?, rejection_reason = ?
    WHERE id = ?
  `),

  // Increment view count
  incrementViews: db.prepare(`
    UPDATE videos SET views = views + 1 WHERE id = ?
  `),

  // Delete video
  deleteVideo: db.prepare(`
    DELETE FROM videos WHERE id = ?
  `)
};

// Tag operations
const tagOperations = {
  // Insert a tag
  insertTag: db.prepare(`
    INSERT INTO tags (video_id, tag_name, confidence, source)
    VALUES (?, ?, ?, ?)
  `),

  // Get tags for a video
  getTagsByVideoId: db.prepare(`
    SELECT * FROM tags WHERE video_id = ?
  `),

  // Get all unique tags
  getAllTags: db.prepare(`
    SELECT DISTINCT tag_name, COUNT(*) as count
    FROM tags
    GROUP BY tag_name
    ORDER BY count DESC
  `),

  // Delete tags for a video
  deleteTagsByVideoId: db.prepare(`
    DELETE FROM tags WHERE video_id = ?
  `)
};

// Helper functions
function createVideo(videoData) {
  const { filename, originalName, title, fileSize, duration, metadata } = videoData;
  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  const result = videoOperations.insertVideo.run(
    filename,
    originalName,
    title || originalName,
    fileSize,
    duration,
    metadataJson
  );

  return result.lastInsertRowid;
}

function addTags(videoId, tags) {
  const insertTag = tagOperations.insertTag;

  for (const tag of tags) {
    insertTag.run(
      videoId,
      tag.name.toLowerCase(),
      tag.confidence || 1.0,
      tag.source || 'auto'
    );
  }
}

function getVideoWithTags(videoId) {
  const video = videoOperations.getVideoById.get(videoId);
  if (!video) return null;

  const tags = tagOperations.getTagsByVideoId.all(videoId);

  return {
    ...video,
    metadata: video.metadata ? JSON.parse(video.metadata) : null,
    tags: tags.map(t => ({
      name: t.tag_name,
      confidence: t.confidence,
      source: t.source
    }))
  };
}

function getAllVideosWithTags() {
  const videos = videoOperations.getAllVideos.all();

  return videos.map(video => {
    const tags = tagOperations.getTagsByVideoId.all(video.id);
    return {
      ...video,
      metadata: video.metadata ? JSON.parse(video.metadata) : null,
      tags: tags.map(t => ({
        name: t.tag_name,
        confidence: t.confidence,
        source: t.source
      }))
    };
  });
}

function searchVideosByTags(tagNames) {
  if (!tagNames || tagNames.length === 0) {
    return getAllVideosWithTags();
  }

  const placeholders = tagNames.map(() => '?').join(',');
  const query = `
    SELECT DISTINCT v.*
    FROM videos v
    INNER JOIN tags t ON v.id = t.video_id
    WHERE v.status = 'approved'
      AND t.tag_name IN (${placeholders})
    ORDER BY v.upload_date DESC
  `;

  const videos = db.prepare(query).all(...tagNames.map(t => t.toLowerCase()));

  return videos.map(video => {
    const tags = tagOperations.getTagsByVideoId.all(video.id);
    return {
      ...video,
      metadata: video.metadata ? JSON.parse(video.metadata) : null,
      tags: tags.map(t => ({
        name: t.tag_name,
        confidence: t.confidence,
        source: t.source
      }))
    };
  });
}

module.exports = {
  createVideo,
  addTags,
  getVideoWithTags,
  getAllVideosWithTags,
  searchVideosByTags,
  videoOperations,
  tagOperations,
  db
};
