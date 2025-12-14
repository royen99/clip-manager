
const { parseComfyUIWorkflow } = require('./metadataExtractor');

const testCases = [
    {
        name: "User Reported Case (PrimitiveStringMultiline)",
        workflow: {
            "88": {
                "inputs": {
                    "value": "Una mujer con traje de cuero negro ceñido y con casco de moto puesto entra en un coche descapotable deportivo y se sienta en el asiento del conductor. El morro del coche apunta hacia la izquierda de la escena.\nNada mas acabar de sentarse, el coche empieza a desarmarse.\nAl coche se le caen las puestas.\nAl coche se le pinchan las ruedas.\nAl coche se le cae la carroceria.\nAl coche se le cae el motor.\nLa mujer sale del coche totalmente estropeado y se empieza a reir."
                },
                "class_type": "PrimitiveStringMultiline",
                "_meta": {
                    "title": "Positive"
                }
            },
            "90": {
                "inputs": {
                    "text": [
                        "88",
                        0
                    ],
                    "clip": [
                        "38",
                        0
                    ]
                },
                "class_type": "CLIPTextEncode",
                "_meta": {
                    "title": "Positive encode"
                }
            }
        },
        expectedPrompt: "Una mujer con traje de cuero negro ceñido y con casco de moto puesto entra en un coche descapotable deportivo y se sienta en el asiento del conductor. El morro del coche apunta hacia la izquierda de la escena.\nNada mas acabar de sentarse, el coche empieza a desarmarse.\nAl coche se le caen las puestas.\nAl coche se le pinchan las ruedas.\nAl coche se le cae la carroceria.\nAl coche se le cae el motor.\nLa mujer sale del coche totalmente estropeado y se empieza a reir."
    }
];

function runTests() {
    console.log("Running parseComfyUIWorkflow Prompt Tests...\n");

    let allPassed = true;

    for (const test of testCases) {
        console.log(`--- Test: ${test.name} ---`);

        try {
            const parsed = parseComfyUIWorkflow(test.workflow);

            console.log("Extracted Prompt:", parsed.prompt);

            let passed = true;

            if (test.expectedPrompt) {
                if (!parsed.prompt || !parsed.prompt.includes("Una mujer con traje de cuero")) {
                    console.error(`❌ Prompt Mismatch.\nExpected to start with: Una mujer con traje de cuero...\nGot: ${parsed.prompt}`);
                    passed = false;
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
