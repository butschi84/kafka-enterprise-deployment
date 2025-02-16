import { Kafka } from "kafkajs";
import { Server } from "socket.io";

let io;
let consumer;
let isConsumerConnected = false;

export default function handler(req, res) {
    console.log("🚀 API Route Hit: kafka-consumer.js");

    if (!res.socket.server.io) {
        console.log("✅ Initializing WebSocket server...");
        io = new Server(res.socket.server, {
            path: "/api/socket.io",
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
                allowedHeaders: ["Content-Type"],
                credentials: true
            },
            transports: ["websocket"],
        });

        res.socket.server.io = io;
        console.log("✅ WebSocket server initialized");

        io.on("connection", async (socket) => {
            console.log("🔗 Client connected via WebSocket");

            socket.on("setBrokers", async ({ brokers, authType, username, password }) => {
                console.log(`🔄 Reconnecting consumer with brokers: ${brokers}, Auth: ${authType}`);

                try {
                    if (consumer && isConsumerConnected) {
                        await consumer.disconnect();
                    }

                    const kafkaConfig = {
                        clientId: `test-listener-${Date.now()}`,
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
                    consumer = kafka.consumer({ groupId: `test-group-${Date.now()}` });

                    await consumer.connect();
                    await consumer.subscribe({ topic: "test-topic", fromBeginning: true });

                    await consumer.run({
                        eachMessage: async ({ message }) => {
                            console.log(`📩 Received: ${message.value.toString()}`);
                            socket.emit("newMessage", message.value.toString());
                        },
                    });

                    isConsumerConnected = true;
                    socket.emit("consumerReady", "✅ Consumer connected successfully");
                } catch (error) {
                    console.error("❌ Consumer error:", error.message);
                    socket.emit("consumerError", error.message);
                }
            });

            socket.on("disconnect", () => {
                console.log("❌ Client disconnected");
            });
        });
    } else {
        console.log("⚠️ WebSocket server already initialized");
    }

    res.end();
}
