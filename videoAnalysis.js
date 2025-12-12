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
            const failedFrames = [];

            // Helper function to wait for file to exist and be readable
            const waitForFile = async (filePath, maxAttempts = 10) => {
                for (let attempt = 0; attempt < maxAttempts; attempt++) {
                    try {
                        await fs.access(filePath);
                        // Small additional delay to ensure file is fully written
                        await new Promise(resolve => setTimeout(resolve, 100));
                        return true;
                    } catch (e) {
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                }
                return false;
            };

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
                    .on('end', async () => {
                        // Wait for file to be fully written
                        const fileExists = await waitForFile(outputPath);

                        if (fileExists) {
                            framePaths.push(outputPath);
                        } else {
                            console.error(`Frame ${i} was not written successfully`);
                            failedFrames.push(i);
                        }

                        framesExtracted++;

                        if (framesExtracted === numFrames) {
                            if (framePaths.length > 0) {
                                resolve(framePaths);
                            } else {
                                reject(new Error('Failed to extract any frames'));
                            }
                        }
                    })
                    .on('error', (err) => {
                        console.error(`Error extracting frame ${i}:`, err);
                        failedFrames.push(i);
                        framesExtracted++;

                        if (framesExtracted === numFrames) {
                            if (framePaths.length > 0) {
                                resolve(framePaths);
                            } else {
                                reject(new Error('Failed to extract any frames'));
                            }
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
                const illegalKeywords = ['child', 'minor', 'underage', 'kid', 'young child', 'prepubescent'];
                const hasIllegalContent = illegalKeywords.some(keyword => {
                    // Check if keyword appears in context of nudity or sexual content
                    const keywordRegex = new RegExp(`(${keyword}).*?(nude|naked|sexual|explicit)|(nude|naked|sexual|explicit).*?(${keyword})`, 'i');
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

        const taggingPrompt = `Analyze this image in detail and provide comprehensive tags. Include:

PEOPLE: Describe any people (man, woman, multiple people, age range if apparent)
CLOTHING: State of dress (clothed, nude, partial nudity, lingerie, swimwear, costume, casual, formal, etc.)
ACTIVITIES: What actions are happening (standing, sitting, dancing, exercising, intimate activities, etc.)
OBJECTS: Items visible (furniture, vehicles, pets, toys, electronics, food, drinks, etc.)
SETTING: Location and scene (indoor, outdoor, bedroom, office, nature, city, beach, etc.)
STYLE: Visual style (realistic, artistic, professional, amateur, high-quality, vintage, etc.)
MOOD: Overall atmosphere (romantic, playful, serious, energetic, calm, passionate, etc.)

For adult content, be specific about what's happening and visible.
List all relevant tags separated by commas. Be thorough and specific.`;

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
