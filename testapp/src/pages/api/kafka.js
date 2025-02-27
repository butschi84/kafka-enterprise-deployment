import { Kafka } from "kafkajs";

export default async function handler(req, res) {
    const {
        action,
        message,
        brokers,
        authType,
        username,
        password,
        ca,
        clientCert,
        clientKey,
        tokenEndpointUrl,
        clientId,
        clientSecret,
    } = req.body;
    if (!brokers) {
        return res.status(400).json({ success: false, error: "Kafka brokers are required" });
    }

    const kafkaConfig = {
        clientId: "testapp",
        brokers: brokers.split(","),
    };

    if (authType === "sasl_plaintext") {
        kafkaConfig.sasl = {
            mechanism: "plain",
            username: username,
            password: password,
        };
        kafkaConfig.ssl = false; // Explicitly set for plaintext
    } else if (authType === "oauthbearer") {
        kafkaConfig.sasl = {
            mechanism: "oauthbearer",
            oauthBearerProvider: async () => {
                try {
                    const response = await fetch(tokenEndpointUrl, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                        },
                        body: new URLSearchParams({
                            grant_type: "urn:ietf:params:oauth:grant-type:uma-ticket",
                            client_id: clientId,
                            client_secret: clientSecret,
                            audience: clientId,
                        }),
                    });
                    if (!response.ok) {
                        throw new Error(`Token fetch failed: ${response.statusText}`);
                    }
                    const { access_token } = await response.json();
                    console.log("🔑 Fetched OAuth token:", access_token.slice(0, 20) + "...");
                    return { value: access_token };
                } catch (error) {
                    console.error("❌ OAuth token fetch error:", error.message);
                    throw error; // Propagates error to Kafka client
                }
            },
        };
        kafkaConfig.ssl = {
            rejectUnauthorized: false, // Use true in production
            ca: [Buffer.from(ca.split(',')[1], 'base64')],
            cert: Buffer.from(clientCert.split(',')[1], 'base64'),
            key: Buffer.from(clientKey.split(',')[1], 'base64'),
        };
    } else if (authType === "ssl") {
        try {
            kafkaConfig.ssl = {
                rejectUnauthorized: false, // Use true in production
                ca: [Buffer.from(ca.split(',')[1], 'base64')],
                cert: Buffer.from(clientCert.split(',')[1], 'base64'),
                key: Buffer.from(clientKey.split(',')[1], 'base64'),
            };
        } catch (error) {
            return res.status(500).json({ success: false, error: "Failed to configure SSL: " + error.message });
        }
    }

    const kafka = new Kafka(kafkaConfig);

    if (action === "send") {
        try {
            const producer = kafka.producer();
            await producer.connect();
            await producer.send({ topic: "test-topic", messages: [{ value: message }] });
            await producer.disconnect();
            res.status(200).json({ success: true, message: "Message sent" });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    } else {
        res.status(400).json({ success: false, error: "Invalid action" });
    }
}