import { Kafka } from "kafkajs";
import randomAnimalName from "random-animal-name";

// Store active producers by session ID
const activeProducers = new Map();

// Helper function to create Kafka config
function createKafkaConfig(brokers, authType, authConfig) {
    const kafkaConfig = {
        clientId: "testapp-producer",
        brokers: brokers.split(","),
    };

    if (authType === "sasl_plaintext") {
        kafkaConfig.sasl = {
            mechanism: "plain",
            username: authConfig.username,
            password: authConfig.password,
        };
        kafkaConfig.ssl = false;
    } else if (authType === "oauthbearer") {
        kafkaConfig.sasl = {
            mechanism: "oauthbearer",
            oauthBearerProvider: async () => {
                try {
                    const response = await fetch(authConfig.tokenEndpointUrl, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                        },
                        body: new URLSearchParams({
                            grant_type: "urn:ietf:params:oauth:grant-type:uma-ticket",
                            client_id: authConfig.clientId,
                            client_secret: authConfig.clientSecret,
                            audience: authConfig.clientId,
                        }),
                    });
                    if (!response.ok) {
                        throw new Error(`Token fetch failed: ${response.statusText}`);
                    }
                    const { access_token } = await response.json();
                    return { value: access_token };
                } catch (error) {
                    console.error("❌ OAuth token fetch error:", error.message);
                    throw error;
                }
            },
        };
        kafkaConfig.ssl = {
            rejectUnauthorized: false,
            ca: [Buffer.from(authConfig.ca.split(',')[1], 'base64')],
            cert: Buffer.from(authConfig.clientCert.split(',')[1], 'base64'),
            key: Buffer.from(authConfig.clientKey.split(',')[1], 'base64'),
        };
    } else if (authType === "ssl") {
        kafkaConfig.ssl = {
            rejectUnauthorized: false,
            ca: [Buffer.from(authConfig.ca.split(',')[1], 'base64')],
            cert: Buffer.from(authConfig.clientCert.split(',')[1], 'base64'),
            key: Buffer.from(authConfig.clientKey.split(',')[1], 'base64'),
        };
    }

    return kafkaConfig;
}

// Helper function to generate random key
function generateRandomKey() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export default async function handler(req, res) {
    const { action, sessionId, brokers, authType, interval = 2000, ...authConfig } = req.body;

    if (action === "start") {
        if (!brokers) {
            return res.status(400).json({ success: false, error: "Kafka brokers are required" });
        }
        if (!sessionId) {
            return res.status(400).json({ success: false, error: "Session ID is required" });
        }

        // Stop existing producer for this session if any
        if (activeProducers.has(sessionId)) {
            const existing = activeProducers.get(sessionId);
            clearInterval(existing.intervalId);
            if (existing.producer) {
                try {
                    await existing.producer.disconnect();
                } catch (error) {
                    console.error("Error disconnecting existing producer:", error);
                }
            }
        }

        try {
            const kafkaConfig = createKafkaConfig(brokers, authType, authConfig);
            const kafka = new Kafka(kafkaConfig);
            const producer = kafka.producer();
            await producer.connect();

            const intervalId = setInterval(async () => {
                try {
                    const animalName = randomAnimalName();
                    const randomKey = generateRandomKey();
                    
                    await producer.send({
                        topic: "test-topic",
                        messages: [{
                            key: randomKey,
                            value: animalName,
                        }],
                    });
                    console.log(`📤 Sent: ${animalName} (key: ${randomKey})`);
                } catch (error) {
                    console.error("❌ Error sending message:", error.message);
                }
            }, parseInt(interval) || 2000);

            activeProducers.set(sessionId, { producer, intervalId });
            
            res.status(200).json({ 
                success: true, 
                message: "Producer started",
                sessionId 
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    } else if (action === "stop") {
        if (!sessionId) {
            return res.status(400).json({ success: false, error: "Session ID is required" });
        }

        console.log(`🛑 Stop request for sessionId: ${sessionId}`);
        console.log(`📊 Active producers: ${Array.from(activeProducers.keys()).join(", ")}`);

        if (activeProducers.has(sessionId)) {
            const { producer, intervalId } = activeProducers.get(sessionId);
            clearInterval(intervalId);
            try {
                await producer.disconnect();
            } catch (error) {
                console.error("Error disconnecting producer:", error);
            }
            activeProducers.delete(sessionId);
            res.status(200).json({ success: true, message: "Producer stopped" });
        } else {
            // Idempotent: if producer is already stopped, return success
            console.log(`⚠️ No active producer found for sessionId: ${sessionId}, but returning success (idempotent)`);
            res.status(200).json({ success: true, message: "Producer already stopped or not found" });
        }
    } else if (action === "status") {
        if (!sessionId) {
            return res.status(400).json({ success: false, error: "Session ID is required" });
        }
        
        const isActive = activeProducers.has(sessionId);
        res.status(200).json({ success: true, active: isActive });
    } else {
        res.status(400).json({ success: false, error: "Invalid action. Use 'start', 'stop', or 'status'" });
    }
}

