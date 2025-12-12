require('dotenv').config();
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;

/**
 * Video analysis module for content moderation and tag generation
 * Supports Ollama with vision models (free, local or remote)
 * Falls back to basic analysis if Ollama is not available
 */

const ENABLE_CONTENT_MODERATION = process.env.ENABLE_CONTENT_MODERATION === 'true';
const ENABLE_AUTO_TAGGING = process.env.ENABLE_AUTO_TAGGING === 'true';
const MODERATION_THRESHOLD = parseFloat(process.env.MODERATION_THRESHOLD) || 0.7;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llava';  // Default vision model
const FRAMES_TO_ANALYZE = parseInt(process.env.FRAMES_TO_ANALYZE) || 3;

let ollamaAvailable = false;

// Check if Ollama is available
async function checkOllamaAvailability() {
    try {
        const response = await fetch(`${OLLAMA_HOST}/api/tags`);
        if (response.ok) {
            const data = await response.json();
            const hasVisionModel = data.models?.some(m =>
                m.name.includes('llava') || m.name.includes('bakllava')
            );

            if (hasVisionModel) {
                ollamaAvailable = true;
                console.log('✅ Ollama with vision model detected - AI analysis enabled');
            } else {
                console.log('⚠️  Ollama found but no vision model (llava/bakllava) installed');
                console.log('   Install with: ollama pull llava');
            }
        }
    } catch (error) {
        console.log('ℹ️  Ollama not available - using basic tag generation');
    }
}

// Initialize
checkOllamaAvailability();

/**
 * Extract frames from video at specific intervals
 */
async function extractFrames(videoPath, numFrames = 3) {
    const outputDir = path.join(path.dirname(videoPath), '.frames');
    await fs.mkdir(outputDir, { recursive: true });

    const framePaths = [];

    return new Promise((resolve, reject) => {
        // Get video duration first
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                reject(err);
                return;
            }

            const duration = metadata.format.duration;
            const interval = duration / (numFrames + 1);

            let framesExtracted = 0;

            // Extract frames at intervals
            for (let i = 1; i <= numFrames; i++) {
                const timestamp = interval * i;
                const outputPath = path.join(outputDir, `frame_${i}.jpg`);

                ffmpeg(videoPath)
                    .screenshots({
                        timestamps: [timestamp],
                        filename: `frame_${i}.jpg`,
                        folder: outputDir,
                        size: '640x?'  // Resize for faster processing
                    })
                    .on('end', () => {
                        framePaths.push(outputPath);
                        framesExtracted++;

                        if (framesExtracted === numFrames) {
                            resolve(framePaths);
                        }
                    })
                    .on('error', (err) => {
                        console.error(`Error extracting frame ${i}:`, err);
                        framesExtracted++;
                        if (framesExtracted === numFrames) {
                            resolve(framePaths);
                        }
                    });
            }
        });
    });
}

/**
 * Analyze a single frame using Ollama vision model
 */
async function analyzeFrameWithOllama(imagePath, prompt) {
    try {
        const imageBuffer = await fs.readFile(imagePath);
        const base64Image = imageBuffer.toString('base64');

        const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: prompt,
                images: [base64Image],
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error('Error analyzing frame with Ollama:', error);
        return null;
    }
}

/**
 * Analyze video for explicit content using Ollama
 */
async function moderateContent(videoPath) {
    if (!ENABLE_CONTENT_MODERATION) {
        return {
            approved: true,
            reason: null,
            confidence: 1.0
        };
    }

    if (!ollamaAvailable) {
        // No moderation available - approve by default (fail-open)
        return {
            approved: true,
            reason: null,
            confidence: 1.0
        };
    }

    try {
        // Extract frames
        const framePaths = await extractFrames(videoPath, 2);

        const moderationPrompt = `Analyze this image for inappropriate content. Is there any explicit, violent, or inappropriate content? Respond with only "SAFE" or "UNSAFE: [brief reason]"`;

        let hasIssues = false;
        let issueReason = null;

        for (const framePath of framePaths) {
            const result = await analyzeFrameWithOllama(framePath, moderationPrompt);

            if (result && result.toUpperCase().includes('UNSAFE')) {
                hasIssues = true;
                issueReason = result.replace(/^UNSAFE:\s*/i, '');
                break;
            }
        }

        // Clean up frames
        await cleanupFrames(framePaths);

        if (hasIssues) {
            return {
                approved: false,
                reason: issueReason || 'Potentially inappropriate content detected',
                confidence: 0.8
            };
        }

        return {
            approved: true,
            reason: null,
            confidence: 0.9
        };

    } catch (error) {
        console.error('Content moderation error:', error);
        // On error, approve by default (fail-open)
        return {
            approved: true,
            reason: null,
            confidence: 0
        };
    }
}

/**
 * Generate tags from video content using Ollama
 */
async function generateAITags(videoPath) {
    if (!ENABLE_AUTO_TAGGING) {
        return [];
    }

    if (!ollamaAvailable) {
        return [];
    }

    try {
        // Extract frames
        const framePaths = await extractFrames(videoPath, FRAMES_TO_ANALYZE);

        const taggingPrompt = `Describe this image in detail. List the main subjects, objects, activities, scene type, style, and mood. Be specific and concise. Format: subject1, subject2, action, scene, style, mood`;

        const allTags = new Set();

        for (const framePath of framePaths) {
            const description = await analyzeFrameWithOllama(framePath, taggingPrompt);

            if (description) {
                // Extract tags from description
                const tags = extractTagsFromDescription(description);
                tags.forEach(tag => allTags.add(tag.toLowerCase()));
            }
        }

        // Clean up frames
        await cleanupFrames(framePaths);

        // Convert to tag objects
        const tagObjects = Array.from(allTags).map(tag => ({
            name: tag,
            confidence: 0.8,
            source: 'ollama-ai'
        }));

        // Limit to top 15 tags
        return tagObjects.slice(0, 15);

    } catch (error) {
        console.error('AI tagging error:', error);
        return [];
    }
}

/**
 * Extract tags from LLM description
 */
function extractTagsFromDescription(description) {
    const tags = [];

    // Remove common words and split by commas/spaces
    const words = description
        .toLowerCase()
        .replace(/[.,!?;:]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2);

    // Common stop words to exclude
    const stopWords = new Set([
        'the', 'this', 'that', 'with', 'from', 'have', 'has', 'had',
        'are', 'was', 'were', 'been', 'being', 'and', 'but', 'not',
        'for', 'can', 'could', 'would', 'should', 'may', 'might'
    ]);

    words.forEach(word => {
        if (!stopWords.has(word) && word.length > 2) {
            tags.push(word);
        }
    });

    // Remove duplicates
    return [...new Set(tags)];
}

/**
 * Clean up extracted frames
 */
async function cleanupFrames(framePaths) {
    try {
        for (const framePath of framePaths) {
            try {
                await fs.unlink(framePath);
            } catch (err) {
                // Ignore errors
            }
        }

        // Try to remove the frames directory
        if (framePaths.length > 0) {
            const framesDir = path.dirname(framePaths[0]);
            try {
                await fs.rmdir(framesDir);
            } catch (err) {
                // Ignore errors
            }
        }
    } catch (error) {
        // Ignore cleanup errors
    }
}

/**
 * Analyze video completely - moderation + tagging
 */
async function analyzeVideo(videoPath) {
    const [moderation, aiTags] = await Promise.all([
        moderateContent(videoPath),
        generateAITags(videoPath)
    ]);

    return {
        moderation,
        aiTags
    };
}

module.exports = {
    moderateContent,
    generateAITags,
    analyzeVideo,
    checkOllamaAvailability
};
