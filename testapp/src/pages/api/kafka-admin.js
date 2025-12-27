import { Kafka } from "kafkajs";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { action, brokers, authType, username, password, ca, clientCert, clientKey, tokenEndpointUrl, clientId, clientSecret, topic } = req.body;

    try {
        const kafkaConfig = {
            clientId: `kafka-admin-${Date.now()}`,
            brokers: brokers.split(","),
        };

        // Configure authentication
        if (authType === "sasl_plaintext") {
            kafkaConfig.sasl = {
                mechanism: "plain",
                username: username,
                password: password,
            };
            kafkaConfig.ssl = false;
        } else if (authType === "oauthbearer") {
            kafkaConfig.sasl = {
                mechanism: "oauthbearer",
                oauthBearerProvider: async () => {
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
                        const errorText = await response.text();
                        throw new Error(`Token fetch failed: ${response.statusText} - ${errorText}`);
                    }
                    const { access_token } = await response.json();
                    return { value: access_token };
                },
            };
            if (ca && clientCert && clientKey) {
                kafkaConfig.ssl = {
                    rejectUnauthorized: false,
                    ca: [Buffer.from(ca.split(',')[1], 'base64')],
                    cert: Buffer.from(clientCert.split(',')[1], 'base64'),
                    key: Buffer.from(clientKey.split(',')[1], 'base64'),
                };
            }
        } else if (authType === "ssl") {
            if (ca && clientCert && clientKey) {
                kafkaConfig.ssl = {
                    rejectUnauthorized: false,
                    ca: [Buffer.from(ca.split(',')[1], 'base64')],
                    cert: Buffer.from(clientCert.split(',')[1], 'base64'),
                    key: Buffer.from(clientKey.split(',')[1], 'base64'),
                };
            }
        }

        const kafka = new Kafka(kafkaConfig);
        const admin = kafka.admin();

        await admin.connect();

        if (action === "getTopicMetadata") {
            const metadata = await admin.fetchTopicMetadata({ topics: [topic || "test-topic"] });
            
            if (metadata.topics.length === 0) {
                await admin.disconnect();
                return res.status(404).json({ error: `Topic ${topic || "test-topic"} not found` });
            }

            const topicMetadata = metadata.topics[0];
            const partitions = topicMetadata.partitions || [];

            // Get detailed partition information
            const partitionDetails = partitions.map((partition) => ({
                partitionId: partition.partitionId,
                leader: partition.leader,
                replicas: partition.replicas || [],
                isr: partition.isr || [], // In-Sync Replicas
                offlineReplicas: partition.offlineReplicas || [],
            }));

            // Calculate replication stats
            const replicationStats = {
                topic: topicMetadata.name,
                partitionCount: partitions.length,
                replicationFactor: partitions.length > 0 ? partitions[0].replicas.length : 0,
                partitions: partitionDetails,
                summary: {
                    totalPartitions: partitions.length,
                    partitionsWithFullReplication: partitionDetails.filter(p => p.replicas.length === partitionDetails[0]?.replicas.length).length,
                    partitionsWithAllISR: partitionDetails.filter(p => p.isr.length === p.replicas.length).length,
                    partitionsWithOfflineReplicas: partitionDetails.filter(p => p.offlineReplicas.length > 0).length,
                    minISR: Math.min(...partitionDetails.map(p => p.isr.length)),
                    maxISR: Math.max(...partitionDetails.map(p => p.isr.length)),
                }
            };

            await admin.disconnect();
            return res.status(200).json(replicationStats);
        }

        await admin.disconnect();
        return res.status(400).json({ error: "Unknown action" });
    } catch (error) {
        console.error("Admin API error:", error);
        return res.status(500).json({ error: error.message });
    }
}

