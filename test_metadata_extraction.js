
const { parseComfyUIWorkflow } = require('./metadataExtractor');

const testCases = [
    {
        name: "User Reported Case (UnetLoaderGGUF)",
        workflow: {
            "61": {
                "inputs": {
                    "unet_name": "wan22RemixT2VI2V_i2vHighV20-Q4_K_M.gguf"
                },
                "class_type": "UnetLoaderGGUF",
                "_meta": { "title": "Unet Loader (GGUF)" }
            },
            "62": {
                "inputs": {
                    "unet_name": "wan22RemixT2VI2V_i2vLowV20-Q4_K_M.gguf"
                },
                "class_type": "UnetLoaderGGUF",
                "_meta": { "title": "Unet Loader (GGUF)" }
            }
        },
        expectedModel: "wan22RemixT2VI2V_i2vHighV20-Q4_K_M.gguf"
    },
    {
        name: "Lora Loader (LoraManager) Case",
        workflow: {
            "130": {
                "inputs": {
                    "loras": [
                        { "name": "CLK_NSFW_high_v2.1", "strength": 1, "active": true },
                        { "name": "DR34ML4Y_I2V_14B_HIGH", "strength": 1, "active": true }
                    ]
                },
                "class_type": "Lora Loader (LoraManager)",
                "_meta": { "title": "High Noise Lora" }
            }
        },
        expectedLoras: ["CLK_NSFW_high_v2.1", "DR34ML4Y_I2V_14B_HIGH"]
    },
    {
        name: "Standard LoraLoaderModelOnly Case",
        workflow: {
            "131": {
                "inputs": {
                    "lora_name": "wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors",
                    "strength_model": 1.0
                },
                "class_type": "LoraLoaderModelOnly",
                "_meta": { "title": "Lightspeed Lora - High" }
            }
        },
        expectedLoras: ["wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors"]
    },
    {
        name: "CheckpointLoaderSimple Case",
        workflow: {
            "340": {
                "inputs": {
                    "ckpt_name": "SDXL\\ultraepicaiRealism_v10.safetensors"
                },
                "class_type": "CheckpointLoaderSimple",
                "_meta": { "title": "Load Checkpoint" }
            }
        },
        expectedModel: "SDXL\\ultraepicaiRealism_v10.safetensors"
    }
];

function runTests() {
    console.log("Running parseComfyUIWorkflow Unit Tests...\n");

    let allPassed = true;

    for (const test of testCases) {
        console.log(`--- Test: ${test.name} ---`);

        try {
            const parsed = parseComfyUIWorkflow(test.workflow);

            console.log("Extracted Model:", parsed.model);
            console.log("Extracted LoRAs:", (parsed.loras || []).map(l => l.name));

            let passed = true;

            if (test.expectedModel) {
                if (!parsed.model || !parsed.model.includes(require('path').basename(test.expectedModel))) {
                    // Check basename match roughly
                    const expectedBase = test.expectedModel.split(/[\\/]/).pop();
                    const actualBase = parsed.model ? parsed.model.split(/[\\/]/).pop() : "";

                    if (!actualBase.includes(expectedBase)) {
                        console.error(`❌ Model Mismatch. Expected to contain: ${test.expectedModel}, Got: ${parsed.model}`);
                        passed = false;
                    }
                }
            }

            if (test.expectedLoras) {
                const extractedNames = (parsed.loras || []).map(l => l.name);
                for (const expected of test.expectedLoras) {
                    if (!extractedNames.includes(expected)) {
                        console.error(`❌ Missing LoRA: ${expected}`);
                        passed = false;
                    }
                }
            }

            if (passed) {
                console.log("✅ Passed");
            } else {
                allPassed = false;
            }

        } catch (e) {
            console.error("❌ Error:", e);
            allPassed = false;
        }
        console.log("");
    }

    if (!allPassed) {
        process.exit(1);
    }
}

runTests();
