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
 * Parse ComfyUI workflow data into user-friendly format
 */
function parseComfyUIWorkflow(workflowData) {
    const parsed = {
        prompt: null,
        negativePrompt: null,
        model: null,
        loras: [],
        steps: null,
        cfg: null,
        seed: null,
        sampler: null,
        scheduler: null,
        resolution: null,
        frameRate: null,
        numFrames: null,
        vaeModel: null,
        clipModel: null
    };

    if (!workflowData || typeof workflowData !== 'object') {
        return parsed;
    }

    // Iterate through all nodes to extract information
    Object.values(workflowData).forEach(node => {
        if (!node || !node.inputs) return;

        const inputs = node.inputs;
        const classType = node.class_type;

        // Extract positive prompts (CLIPTextEncode, ImpactWildcardProcessor)
        if (classType === 'CLIPTextEncode' && inputs.text && !parsed.prompt) {
            // Check if it's not the negative prompt (usually longer or first one found)
            const text = inputs.text;
            if (typeof text === 'string' && text.length > 10 && !text.includes('低质量') && !text.includes('worst quality')) {
                parsed.prompt = text;
            } else if (typeof text === 'string' && text.includes('低质量')) {
                parsed.negativePrompt = text;
            }
        }

        // Extract wildcard/prompt processor
        if (classType === 'ImpactWildcardProcessor' && inputs.populated_text) {
            parsed.prompt = inputs.populated_text;
        }

        // Extract model information
        if (classType === 'WanVideoModelLoader' && inputs.model) {
            if (!parsed.model || inputs.model.includes('HIGH')) {
                parsed.model = inputs.model;
            }
        }

        // Extract LoRA information
        if ((classType === 'WanVideoLoraSelect' || classType === 'WanVideoLoraSelectMulti') && inputs.lora) {
            if (inputs.lora !== 'none') {
                parsed.loras.push({
                    name: inputs.lora,
                    strength: inputs.strength || inputs.strength_0 || 1.0
                });
            }
        }

        // Extract sampler settings
        if (classType === 'WanVideoSampler') {
            if (inputs.steps) parsed.steps = inputs.steps;
            if (inputs.cfg) parsed.cfg = inputs.cfg;
            if (inputs.seed !== undefined) parsed.seed = inputs.seed;
            if (inputs.scheduler) parsed.scheduler = inputs.scheduler;
        }

        // Extract VAE model
        if (classType === 'WanVideoVAELoader' && inputs.model_name) {
            parsed.vaeModel = inputs.model_name;
        }

        // Extract CLIP model
        if (classType === 'CLIPLoader' && inputs.clip_name) {
            parsed.clipModel = inputs.clip_name;
        }

        // Extract video settings
        if (classType === 'VHS_VideoCombine') {
            if (inputs.frame_rate) parsed.frameRate = inputs.frame_rate;
        }

        // Extract frame count
        if (classType === 'WanVideoEmptyEmbeds') {
            if (inputs.num_frames) parsed.numFrames = inputs.num_frames;
            if (inputs.width && inputs.height) {
                parsed.resolution = `${inputs.width}x${inputs.height}`;
            }
        }

        // Extract resolution from aspect ratio calculator
        if (classType === 'Width and height from aspect ratio 🦴') {
            parsed.aspectRatio = inputs.aspect_ratio;
        }
    });

    return parsed;
}

/**
 * Extract ComfyUI-specific metadata from video file
 * ComfyUI often embeds metadata in the video file comments or as custom metadata
 */
async function extractComfyUIMetadata(filePath) {
    try {
        const metadata = await extractVideoMetadata(filePath);
        let comfyData = {
            prompt: null,
            negativePrompt: null,
            model: null,
            loras: [],
            steps: null,
            cfg: null,
            seed: null,
            sampler: null,
            scheduler: null,
            resolution: null,
            frameRate: null,
            numFrames: null,
            vaeModel: null,
            clipModel: null,
            workflow: null
        };

        // Check for metadata in format tags
        const formatTags = metadata.rawMetadata?.format?.tags || {};

        // Parse prompt field if it exists (contains workflow JSON)
        if (formatTags.prompt) {
            try {
                const promptData = typeof formatTags.prompt === 'string'
                    ? JSON.parse(formatTags.prompt)
                    : formatTags.prompt;

                const parsedWorkflow = parseComfyUIWorkflow(promptData);
                Object.assign(comfyData, parsedWorkflow);
            } catch (e) {
                console.error('Error parsing ComfyUI prompt data:', e.message);
                // Store as raw if can't parse
                comfyData.prompt = formatTags.prompt;
            }
        }

        // Parse workflow field if it exists
        if (formatTags.workflow) {
            try {
                const workflowData = typeof formatTags.workflow === 'string'
                    ? JSON.parse(formatTags.workflow)
                    : formatTags.workflow;

                // Store workflow type/version if available
                comfyData.workflowType = workflowData.class_type || 'comfyui';
            } catch (e) {
                console.error('Error parsing workflow:', e.message);
            }
        }

        // Try to parse comment field as fallback
        if (formatTags.comment && !comfyData.prompt) {
            try {
                const parsedComment = JSON.parse(formatTags.comment);
                if (parsedComment.prompt) comfyData.prompt = parsedComment.prompt;
                if (parsedComment.model) comfyData.model = parsedComment.model;
                if (parsedComment.seed) comfyData.seed = parsedComment.seed;
            } catch (e) {
                // Not JSON, ignore
            }
        }

        // Clean up the prompt text
        if (comfyData.prompt && typeof comfyData.prompt === 'string') {
            // Remove excessive newlines and trim
            comfyData.prompt = comfyData.prompt.replace(/\n\n+/g, '\n').trim();
        }

        // Determine generation type
        if (comfyData.model) {
            if (comfyData.model.includes('T2V') || comfyData.model.includes('text')) {
                comfyData.generationType = 'text-to-video';
            } else if (comfyData.model.includes('I2V') || comfyData.model.includes('image')) {
                comfyData.generationType = 'image-to-video';
            }
        }

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
