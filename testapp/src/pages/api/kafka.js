import { Kafka } from "kafkajs";

export default async function handler(req, res) {
    const { action, message, brokers, authType, username, password } = req.body;
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
