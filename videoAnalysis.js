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

    return new Promise((resolve, reject) => {
        // Get video duration first
        ffmpeg.ffprobe(videoPath, async (err, metadata) => {
            if (err) {
                reject(err);
                return;
            }

            const duration = metadata.format.duration;
            const interval = duration / (numFrames + 1);
            const framePaths = [];

            // Extract frames SEQUENTIALLY to avoid race conditions
            try {
                for (let i = 1; i <= numFrames; i++) {
                    const timestamp = interval * i;
                    const outputPath = path.join(outputDir, `frame_${i}.jpg`);

                    // Wait for each frame to complete before starting the next
                    await new Promise((resolveFrame, rejectFrame) => {
                        ffmpeg(videoPath)
                            .screenshots({
                                timestamps: [timestamp],
                                filename: `frame_${i}.jpg`,
                                folder: outputDir,
                                size: '640x?'
                            })
                            .on('end', async () => {
                                // Wait a bit to ensure file is written
                                await new Promise(r => setTimeout(r, 200));

                                // Verify file exists
                                try {
                                    await fs.access(outputPath);
                                    framePaths.push(outputPath);
                                    resolveFrame();
                                } catch (e) {
                                    console.error(`Frame ${i} not found after extraction`);
                                    resolveFrame(); // Continue even if this frame failed
                                }
                            })
                            .on('error', (err) => {
                                console.error(`Error extracting frame ${i}:`, err);
                                resolveFrame(); // Continue even if this frame failed
                            });
                    });
                }

                if (framePaths.length > 0) {
                    resolve(framePaths);
                } else {
                    reject(new Error('Failed to extract any frames'));
                }
            } catch (error) {
                reject(error);
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
 * Classify video content and assign rating
 */
async function classifyContent(videoPath) {
    const enableModeration = process.env.ENABLE_CONTENT_MODERATION === 'true';

    if (!enableModeration) {
        return {
            rating: 'SAFE',
            reason: 'Content moderation disabled',
            isLegal: true
        };
    }

    if (!ollamaAvailable) {
        // No moderation available - approve by default (fail-open)
        return {
            rating: 'SAFE',
            reason: 'Ollama not available - defaulting to safe',
            isLegal: true
        };
    }

    try {
        // Extract frames
        const framePaths = await extractFrames(videoPath, 3);

        const ratingPrompt = `Analyze this image and classify its content maturity level. Consider:
- Nudity (none, partial, full, explicit)
- Violence (none, mild, graphic)
- Sexual content (none, suggestive, explicit)
- Adult themes

Respond in this exact format:
RATING: [SAFE, PG-13, R, or XXX]
REASON: [brief explanation]

Classifications:
- SAFE: No mature content
- PG-13: Partial nudity, mild violence, or suggestive themes
- R: Full nudity, graphic violence, or adult themes
- XXX: Explicit sexual content or graphic adult material`;

        let maxRating = 'SAFE';
        let ratingReason = 'Clean content';
        const ratingLevels = { 'SAFE': 0, 'PG-13': 1, 'R': 2, 'XXX': 3 };

        // Analyze each frame
        for (const framePath of framePaths) {
            const result = await analyzeFrameWithOllama(framePath, ratingPrompt);

            if (result) {
                // Parse rating from response
                const ratingMatch = result.match(/RATING:\s*(SAFE|PG-13|R|XXX)/i);
                const reasonMatch = result.match(/REASON:\s*(.+)/i);

                if (ratingMatch) {
                    const frameRating = ratingMatch[1].toUpperCase();
                    const frameReason = reasonMatch ? reasonMatch[1].trim() : '';

                    // Keep the highest rating found
                    if (ratingLevels[frameRating] > ratingLevels[maxRating]) {
                        maxRating = frameRating;
                        ratingReason = frameReason || `Content classified as ${frameRating}`;
                    }
                }

                // Check for illegal content keywords
                const lowerResult = result.toLowerCase();
                const illegalKeywords = ['child', 'minor', 'childhood', 'children', 'underage', 'kid', 'young child', 'prepubescent'];
                const hasIllegalContent = illegalKeywords.some(keyword => {
                    // Check if keyword appears in context of nudity or sexual content
                    const keywordRegex = new RegExp(`(${keyword}).*?(nude|vagina|penis|naked|sex|sexual|explicit)|(nude|vagina|penis|naked|sex|sexual|explicit).*?(${keyword})`, 'i');
                    return keywordRegex.test(result);
                });

                if (hasIllegalContent) {
                    await cleanupFrames(framePaths);
                    return {
                        rating: 'REJECTED',
                        reason: 'Potentially illegal content detected',
                        isLegal: false
                    };
                }
            }
        }

        // Clean up frames
        await cleanupFrames(framePaths);

        return {
            rating: maxRating,
            reason: ratingReason,
            isLegal: true
        };

    } catch (error) {
        console.error('Content classification error:', error);
        // On error, default to SAFE (fail-safe)
        return {
            rating: 'SAFE',
            reason: 'Classification error - defaulting to safe',
            isLegal: true
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

        const taggingPrompt = `Analyze this image and list COMPREHENSIVE tags for what is ACTUALLY VISIBLE. 

Rules:
- List subjects, objects, settings, styles, and moods.
- ONLY tag "person", "man", "woman" etc if a human is clearly visible. 
- ONLY tag clothing/nudity if a person is visible.
- If no people are present, DO NOT include tags about people, clothing, or body parts.
- For adult content, be specific (e.g., "nude", "lingerie", "sexual activity", "toy").
- Include specific object names (e.g., "chair", "car", "apple").

Output purely a comma-separated list of relevant tags. Do not categorize or explain.`;

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
 * Analyze video completely - classification + tagging
 */
async function analyzeVideo(videoPath) {
    const [contentClassification, aiTags] = await Promise.all([
        classifyContent(videoPath),
        generateAITags(videoPath)
    ]);

    return {
        contentClassification,
        aiTags
    };
}

module.exports = {
    classifyContent,
    generateAITags,
    analyzeVideo,
    checkOllamaAvailability
};
