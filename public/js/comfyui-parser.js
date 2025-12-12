// Helper function to parse ComfyUI workflow on the client side
function parseComfyUIWorkflowClient(workflowData) {
    const parsed = {
        prompt: null,
        negativePrompt: null,
        model: null,
        loras: [],
        steps: null,
        cfg: null,
        seed: null,
        scheduler: null,
        resolution: null,
        frameRate: null,
        numFrames: null
    };

    // If it's a string, try to parse it
    if (typeof workflowData === 'string') {
        try {
            workflowData = JSON.parse(workflowData);
        } catch (e) {
            // Not JSON, treat as plain prompt
            parsed.prompt = workflowData;
            return parsed;
        }
    }

    if (!workflowData || typeof workflowData !== 'object') {
        return parsed;
    }

    // Iterate through all nodes to extract information
    Object.values(workflowData).forEach(node => {
        if (!node || !node.inputs) return;

        const inputs = node.inputs;
        const classType = node.class_type;

        // Extract positive prompt from ImpactWildcardProcessor
        if (classType === 'ImpactWildcardProcessor' && inputs.populated_text) {
            parsed.prompt = inputs.populated_text;
        }

        // Extract prompt from CLIPTextEncode (fallback)
        if (!parsed.prompt && classType === 'CLIPTextEncode' && inputs.text) {
            const text = inputs.text;
            if (typeof text === 'string' && text.length > 10 && !text.includes('低质量')) {
                parsed.prompt = text;
            } else if (typeof text === 'string' && text.includes('低质量')) {
                parsed.negativePrompt = text;
            }
        }

        // Extract model information
        if (classType === 'WanVideoModelLoader' && inputs.model) {
            if (!parsed.model || inputs.model.includes('HIGH')) {
                parsed.model = inputs.model;
            }
        }

        // Extract LoRA information
        if (classType === 'WanVideoLoraSelect' && inputs.lora && inputs.lora !== 'none') {
            parsed.loras.push({
                name: inputs.lora,
                strength: inputs.strength || 1.0
            });
        }

        // Extract sampler settings
        if (classType === 'WanVideoSampler') {
            if (inputs.steps) parsed.steps = inputs.steps;
            if (inputs.cfg) parsed.cfg = inputs.cfg;
            if (inputs.seed !== undefined) parsed.seed = inputs.seed;
            if (inputs.scheduler) parsed.scheduler = inputs.scheduler;
        }

        // Extract video settings
        if (classType === 'VHS_VideoCombine' && inputs.frame_rate) {
            parsed.frameRate = inputs.frame_rate;
        }

        // Extract frame count and resolution
        if (classType === 'WanVideoEmptyEmbeds') {
            if (inputs.num_frames) parsed.numFrames = inputs.num_frames;
            if (inputs.width && inputs.height) {
                parsed.resolution = `${inputs.width}x${inputs.height}`;
            }
        }

        // Extract aspect ratio
        if (classType === 'Width and height from aspect ratio 🦴') {
            parsed.aspectRatio = inputs.aspect_ratio;
        }

        // Extract INTConstant for steps
        if (classType === 'INTConstant' && inputs.value && !parsed.steps) {
            // This might be steps or other values
            if (inputs.value >= 1 && inputs.value <= 50) {
                parsed.steps = inputs.value;
            }
        }
    });

    // If still no steps found, look for it another way
    if (!parsed.steps) {
        Object.values(workflowData).forEach(node => {
            if (node?.inputs?.steps && typeof node.inputs.steps === 'object' && Array.isArray(node.inputs.steps)) {
                // It's a reference to another node - try to resolve it
                const refNodeId = node.inputs.steps[0];
                const refNode = workflowData[refNodeId];
                if (refNode?.inputs?.value) {
                    parsed.steps = refNode.inputs.value;
                }
            }
        });
    }

    return parsed;
}

module.exports = { parseComfyUIWorkflowClient };
