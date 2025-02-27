#!/bin/bash
set -e  # Exit on error
set -o pipefail  # Ensure pipes fail on errors

if [ $# -ne 2 ]; then
    echo "Usage: $0 <keystore-password> <truststore-password>"
    exit 1
fi

KEYSTOREPASSWORD="$1"
TRUSTSTOREPASSWORD="$2"
CERTS_DIR="certs"

# Cleanup old certs
rm -rf "$CERTS_DIR"
mkdir -p "$CERTS_DIR"

# Generate CA Certificate (Used for Signing)
openssl genrsa -out "$CERTS_DIR/ca.key" 2048
openssl req -x509 -new -nodes -key "$CERTS_DIR/ca.key" -sha256 -days 365 -out "$CERTS_DIR/ca.crt" -subj "/CN=Kafka-CA"

# Store password in a credentials file
echo "$KEYSTOREPASSWORD" > "$CERTS_DIR/credentials"

# Create OpenSSL Config File for SANs
cat > "$CERTS_DIR/openssl.cnf" <<EOF
[ req ]
default_bits       = 2048
prompt            = no
default_md        = sha256
distinguished_name = dn
req_extensions    = v3_req

[ dn ]
CN=kafka

[ v3_req ]
subjectAltName = @alt_names

[ alt_names ]
DNS.1 = kafka-1
DNS.2 = kafka-2
DNS.3 = kafka-3
IP.1  = 127.0.0.1
EOF

# Generate Kafka Broker Keystore with SANs
keytool -genkeypair -keystore "$CERTS_DIR/server.keystore.jks" -alias kafka -validity 365 -keyalg RSA -storepass "$KEYSTOREPASSWORD" -dname "CN=kafka"
keytool -keystore "$CERTS_DIR/server.keystore.jks" -alias kafka -certreq -file "$CERTS_DIR/kafka.csr" -storepass "$KEYSTOREPASSWORD"

# Sign Broker Certificate with CA (Include SANs)
openssl x509 -req -CA "$CERTS_DIR/ca.crt" -CAkey "$CERTS_DIR/ca.key" -in "$CERTS_DIR/kafka.csr" -out "$CERTS_DIR/kafka.crt" -days 365 -CAcreateserial -sha256 -extfile "$CERTS_DIR/openssl.cnf" -extensions v3_req

# Import CA into Broker Keystore
keytool -keystore "$CERTS_DIR/server.keystore.jks" -alias CARoot -importcert -file "$CERTS_DIR/ca.crt" -storepass "$KEYSTOREPASSWORD" -noprompt

# Import Signed Cert into Broker Keystore
keytool -keystore "$CERTS_DIR/server.keystore.jks" -alias kafka -importcert -file "$CERTS_DIR/kafka.crt" -storepass "$KEYSTOREPASSWORD" -noprompt

# Generate Truststore for Kafka Brokers (Stores CA Certificate)
keytool -keystore "$CERTS_DIR/server.truststore.jks" -alias CARoot -importcert -file "$CERTS_DIR/ca.crt" -storepass "$TRUSTSTOREPASSWORD" -noprompt

### Generate Kafka-UI Client Certificate (Full Access)
keytool -genkeypair -keystore "$CERTS_DIR/kafka-ui.keystore.jks" -alias kafka-ui -validity 365 -keyalg RSA -storepass "$KEYSTOREPASSWORD" -dname "CN=kafka-ui"
keytool -keystore "$CERTS_DIR/kafka-ui.keystore.jks" -alias kafka-ui -certreq -file "$CERTS_DIR/kafka-ui.csr" -storepass "$KEYSTOREPASSWORD"
openssl x509 -req -CA "$CERTS_DIR/ca.crt" -CAkey "$CERTS_DIR/ca.key" -in "$CERTS_DIR/kafka-ui.csr" -out "$CERTS_DIR/kafka-ui.crt" -days 365 -CAcreateserial -sha256
keytool -keystore "$CERTS_DIR/kafka-ui.keystore.jks" -alias CARoot -importcert -file "$CERTS_DIR/ca.crt" -storepass "$KEYSTOREPASSWORD" -noprompt
keytool -keystore "$CERTS_DIR/kafka-ui.keystore.jks" -alias kafka-ui -importcert -file "$CERTS_DIR/kafka-ui.crt" -storepass "$KEYSTOREPASSWORD" -noprompt

### Generate Client Certificate for Client-1
keytool -genkeypair -keystore "$CERTS_DIR/client-1.keystore.jks" -alias client-1 -validity 365 -keyalg RSA -storepass "$KEYSTOREPASSWORD" -dname "CN=client-1"
keytool -keystore "$CERTS_DIR/client-1.keystore.jks" -alias client-1 -certreq -file "$CERTS_DIR/client-1.csr" -storepass "$KEYSTOREPASSWORD"
openssl x509 -req -CA "$CERTS_DIR/ca.crt" -CAkey "$CERTS_DIR/ca.key" -in "$CERTS_DIR/client-1.csr" -out "$CERTS_DIR/client-1.crt" -days 365 -CAcreateserial -sha256
keytool -keystore "$CERTS_DIR/client-1.keystore.jks" -alias CARoot -importcert -file "$CERTS_DIR/ca.crt" -storepass "$KEYSTOREPASSWORD" -noprompt
keytool -keystore "$CERTS_DIR/client-1.keystore.jks" -alias client-1 -importcert -file "$CERTS_DIR/client-1.crt" -storepass "$KEYSTOREPASSWORD" -noprompt
# export the private key
keytool -importkeystore -srckeystore "$CERTS_DIR/client-1.keystore.jks" -destkeystore "$CERTS_DIR/client-1.p12" -deststoretype PKCS12 -srcstorepass "$KEYSTOREPASSWORD" -deststorepass "$KEYSTOREPASSWORD" -noprompt
openssl pkcs12 -in "$CERTS_DIR/client-1.p12" -nocerts -nodes -out "$CERTS_DIR/client-1.key" -passin pass:"$KEYSTOREPASSWORD"
rm "$CERTS_DIR/client-1.p12"

echo "✅ Kafka Broker SSL Certificates and Truststore have been successfully generated in $CERTS_DIR."
