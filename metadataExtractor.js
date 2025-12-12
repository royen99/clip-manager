const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');

/**
 * Extract metadata from video file using ffmpeg
 */
async function extractVideoMetadata(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.error('Error extracting metadata:', err);
                reject(err);
                return;
            }

            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

            const result = {
                duration: metadata.format.duration,
                fileSize: metadata.format.size,
                format: metadata.format.format_name,
                videoCodec: videoStream?.codec_name,
                width: videoStream?.width,
                height: videoStream?.height,
                frameRate: videoStream?.r_frame_rate,
                bitrate: metadata.format.bit_rate,
                audioCodec: audioStream?.codec_name,
                rawMetadata: metadata
            };

            resolve(result);
        });
    });
}

/**
 * Extract ComfyUI-specific metadata from video file
 * ComfyUI often embeds metadata in the video file comments or as custom metadata
 */
async function extractComfyUIMetadata(filePath) {
    try {
        const metadata = await extractVideoMetadata(filePath);
        const comfyData = {
            model: null,
            prompt: null,
            negativePrompt: null,
            seed: null,
            steps: null,
            cfg: null,
            sampler: null,
            generationType: null // 'text-to-video' or 'image-to-video'
        };

        // Check for metadata in format tags
        const formatTags = metadata.rawMetadata?.format?.tags || {};

        // Try to parse common ComfyUI metadata fields
        if (formatTags.comment) {
            try {
                const parsedComment = JSON.parse(formatTags.comment);
                Object.assign(comfyData, parsedComment);
            } catch (e) {
                // If not JSON, try to parse as key-value pairs
                const commentLines = formatTags.comment.split('\n');
                commentLines.forEach(line => {
                    const [key, value] = line.split(':').map(s => s.trim());
                    if (key && value) {
                        comfyData[key.toLowerCase()] = value;
                    }
                });
            }
        }

        // Extract from title/description if available
        if (formatTags.title) comfyData.title = formatTags.title;
        if (formatTags.description) comfyData.description = formatTags.description;

        return {
            basic: metadata,
            comfyui: comfyData
        };
    } catch (error) {
        console.error('Error extracting ComfyUI metadata:', error);
        // Return basic metadata even if ComfyUI parsing fails
        const basicMetadata = await extractVideoMetadata(filePath);
        return {
            basic: basicMetadata,
            comfyui: null
        };
    }
}

/**
 * Generate automatic tags from filename and basic metadata
 */
function generateBasicTags(filename, metadata) {
    const tags = [];

    // Extract words from filename (excluding extension)
    const nameWithoutExt = path.basename(filename, path.extname(filename));
    const words = nameWithoutExt
        .split(/[-_\s]+/)
        .filter(word => word.length > 2 && !/^\d+$/.test(word));

    words.forEach(word => {
        tags.push({
            name: word.toLowerCase(),
            confidence: 0.6,
            source: 'filename'
        });
    });

    // Add duration-based tags
    if (metadata.basic?.duration) {
        if (metadata.basic.duration < 5) {
            tags.push({ name: 'short', confidence: 1.0, source: 'auto' });
        } else if (metadata.basic.duration < 15) {
            tags.push({ name: 'medium', confidence: 1.0, source: 'auto' });
        } else {
            tags.push({ name: 'long', confidence: 1.0, source: 'auto' });
        }
    }

    // Add resolution-based tags
    if (metadata.basic?.width && metadata.basic?.height) {
        const { width, height } = metadata.basic;
        if (width >= 3840 || height >= 2160) {
            tags.push({ name: '4k', confidence: 1.0, source: 'auto' });
        } else if (width >= 1920 || height >= 1080) {
            tags.push({ name: 'hd', confidence: 1.0, source: 'auto' });
        }

        if (width > height) {
            tags.push({ name: 'landscape', confidence: 1.0, source: 'auto' });
        } else if (height > width) {
            tags.push({ name: 'portrait', confidence: 1.0, source: 'auto' });
        }
    }

    // Add format tag
    if (metadata.basic?.format) {
        tags.push({
            name: metadata.basic.format.split(',')[0],
            confidence: 1.0,
            source: 'auto'
        });
    }

    // Add ComfyUI-specific tags if available
    if (metadata.comfyui) {
        if (metadata.comfyui.generationType) {
            tags.push({
                name: metadata.comfyui.generationType,
                confidence: 1.0,
                source: 'comfyui'
            });
        }
        if (metadata.comfyui.model) {
            tags.push({
                name: 'ai-generated',
                confidence: 1.0,
                source: 'comfyui'
            });
        }
    }

    // Remove duplicate tags
    const uniqueTags = Array.from(
        new Map(tags.map(tag => [tag.name, tag])).values()
    );

    return uniqueTags;
}

module.exports = {
    extractVideoMetadata,
    extractComfyUIMetadata,
    generateBasicTags
};
