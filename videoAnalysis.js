require('dotenv').config();

/**
 * Video analysis module for content moderation and tag generation
 * Supports Google Cloud Vision API (optional) with graceful fallback
 */

const ENABLE_CONTENT_MODERATION = process.env.ENABLE_CONTENT_MODERATION === 'true';
const ENABLE_AUTO_TAGGING = process.env.ENABLE_AUTO_TAGGING === 'true';
const MODERATION_THRESHOLD = parseFloat(process.env.MODERATION_THRESHOLD) || 0.7;

let videoIntelligence = null;

// Try to load Google Cloud Video Intelligence if credentials are available
try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        const vision = require('@google-cloud/video-intelligence');
        videoIntelligence = new vision.VideoIntelligenceServiceClient();
        console.log('Google Cloud Video Intelligence initialized');
    }
} catch (error) {
    console.log('Google Cloud Video Intelligence not available (this is optional)');
}

/**
 * Analyze video for explicit content
 * Returns { approved: boolean, reason: string, confidence: number }
 */
async function moderateContent(videoPath) {
    if (!ENABLE_CONTENT_MODERATION || !videoIntelligence) {
        // No moderation enabled or API not available - approve by default
        return {
            approved: true,
            reason: null,
            confidence: 1.0
        };
    }

    try {
        const fs = require('fs');
        const videoBytes = fs.readFileSync(videoPath).toString('base64');

        const request = {
            inputContent: videoBytes,
            features: ['EXPLICIT_CONTENT_DETECTION'],
        };

        const [operation] = await videoIntelligence.annotateVideo(request);
        const [response] = await operation.promise();

        const explicitAnnotation = response.annotationResults[0].explicitAnnotation;

        if (!explicitAnnotation || !explicitAnnotation.frames) {
            return { approved: true, reason: null, confidence: 1.0 };
        }

        // Check if any frame has explicit content above threshold
        for (const frame of explicitAnnotation.frames) {
            const likelihood = frame.pornographyLikelihood;
            const score = getLikelihoodScore(likelihood);

            if (score >= MODERATION_THRESHOLD) {
                return {
                    approved: false,
                    reason: 'Explicit content detected',
                    confidence: score
                };
            }
        }

        return { approved: true, reason: null, confidence: 1.0 };
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
 * Generate tags from video content using AI
 * Returns array of { name: string, confidence: number, source: string }
 */
async function generateAITags(videoPath) {
    if (!ENABLE_AUTO_TAGGING || !videoIntelligence) {
        // No AI tagging available - return empty array
        return [];
    }

    try {
        const fs = require('fs');
        const videoBytes = fs.readFileSync(videoPath).toString('base64');

        const request = {
            inputContent: videoBytes,
            features: ['LABEL_DETECTION'],
        };

        const [operation] = await videoIntelligence.annotateVideo(request);
        const [response] = await operation.promise();

        const labels = response.annotationResults[0].segmentLabelAnnotations;

        if (!labels) {
            return [];
        }

        const tags = labels
            .map(label => ({
                name: label.entity.description.toLowerCase(),
                confidence: label.segments[0]?.confidence || 0.5,
                source: 'ai'
            }))
            .filter(tag => tag.confidence >= parseFloat(process.env.TAG_CONFIDENCE_THRESHOLD) || 0.5)
            .slice(0, 15); // Limit to top 15 tags

        return tags;
    } catch (error) {
        console.error('AI tagging error:', error);
        return [];
    }
}

/**
 * Convert Google's likelihood enum to a score
 */
function getLikelihoodScore(likelihood) {
    const scores = {
        'LIKELIHOOD_UNSPECIFIED': 0,
        'VERY_UNLIKELY': 0.1,
        'UNLIKELY': 0.3,
        'POSSIBLE': 0.5,
        'LIKELY': 0.7,
        'VERY_LIKELY': 0.9
    };
    return scores[likelihood] || 0;
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
    analyzeVideo
};
