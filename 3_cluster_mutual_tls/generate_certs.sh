#!/bin/bash
set -e  # Exit on error
set -o pipefail  # Ensure pipes fail on errors

if [ $# -ne 1 ]; then
    echo "Usage: $0 <password>"
    exit 1
fi

PASSWORD="$1"
CERTS_DIR="certs"

# Cleanup old certs
rm -rf "$CERTS_DIR"
mkdir -p "$CERTS_DIR"

# Generate CA key and cert
openssl genrsa -out "$CERTS_DIR/ca.key" 2048
openssl req -x509 -new -nodes -key "$CERTS_DIR/ca.key" -sha256 -days 365 -out "$CERTS_DIR/ca.crt" -subj "/CN=Kafka-CA"

# Store password in a credentials file
echo "$PASSWORD" > "$CERTS_DIR/credentials"

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

### Generate Kafka Broker Certificate
keytool -genkeypair -keystore "$CERTS_DIR/server.keystore.jks" -alias kafka -validity 365 -keyalg RSA -storepass "$PASSWORD" -dname "CN=kafka"
keytool -keystore "$CERTS_DIR/server.keystore.jks" -alias kafka -certreq -file "$CERTS_DIR/kafka.csr" -storepass "$PASSWORD"
openssl x509 -req -CA "$CERTS_DIR/ca.crt" -CAkey "$CERTS_DIR/ca.key" -in "$CERTS_DIR/kafka.csr" -out "$CERTS_DIR/kafka.crt" -days 365 -CAcreateserial -sha256 -extfile "$CERTS_DIR/openssl.cnf" -extensions v3_req
keytool -keystore "$CERTS_DIR/server.keystore.jks" -alias CARoot -importcert -file "$CERTS_DIR/ca.crt" -storepass "$PASSWORD" -noprompt
keytool -keystore "$CERTS_DIR/server.keystore.jks" -alias kafka -importcert -file "$CERTS_DIR/kafka.crt" -storepass "$PASSWORD" -noprompt

### Generate Client Certificate for Client-1
keytool -genkeypair -keystore "$CERTS_DIR/client-1.keystore.jks" -alias client-1 -validity 365 -keyalg RSA -storepass "$PASSWORD" -dname "CN=client-1"
keytool -keystore "$CERTS_DIR/client-1.keystore.jks" -alias client-1 -certreq -file "$CERTS_DIR/client-1.csr" -storepass "$PASSWORD"
openssl x509 -req -CA "$CERTS_DIR/ca.crt" -CAkey "$CERTS_DIR/ca.key" -in "$CERTS_DIR/client-1.csr" -out "$CERTS_DIR/client-1.crt" -days 365 -CAcreateserial -sha256
keytool -keystore "$CERTS_DIR/client-1.keystore.jks" -alias CARoot -importcert -file "$CERTS_DIR/ca.crt" -storepass "$PASSWORD" -noprompt
keytool -keystore "$CERTS_DIR/client-1.keystore.jks" -alias client-1 -importcert -file "$CERTS_DIR/client-1.crt" -storepass "$PASSWORD" -noprompt
# export the private key
keytool -importkeystore -srckeystore "$CERTS_DIR/client-1.keystore.jks" -destkeystore "$CERTS_DIR/client-1.p12" -deststoretype PKCS12 -srcstorepass "$PASSWORD" -deststorepass "$PASSWORD" -noprompt
openssl pkcs12 -in "$CERTS_DIR/client-1.p12" -nocerts -nodes -out "$CERTS_DIR/client-1.key" -passin pass:"$PASSWORD"
rm "$CERTS_DIR/client-1.p12"

### Generate Client Certificate for Client-2
keytool -genkeypair -keystore "$CERTS_DIR/client-2.keystore.jks" -alias client-2 -validity 365 -keyalg RSA -storepass "$PASSWORD" -dname "CN=client-2"
keytool -keystore "$CERTS_DIR/client-2.keystore.jks" -alias client-2 -certreq -file "$CERTS_DIR/client-2.csr" -storepass "$PASSWORD"
openssl x509 -req -CA "$CERTS_DIR/ca.crt" -CAkey "$CERTS_DIR/ca.key" -in "$CERTS_DIR/client-2.csr" -out "$CERTS_DIR/client-2.crt" -days 365 -CAcreateserial -sha256
keytool -keystore "$CERTS_DIR/client-2.keystore.jks" -alias CARoot -importcert -file "$CERTS_DIR/ca.crt" -storepass "$PASSWORD" -noprompt
keytool -keystore "$CERTS_DIR/client-2.keystore.jks" -alias client-2 -importcert -file "$CERTS_DIR/client-2.crt" -storepass "$PASSWORD" -noprompt

### Generate Kafka-UI Client Certificate (Full Access)
keytool -genkeypair -keystore "$CERTS_DIR/kafka-ui.keystore.jks" -alias kafka-ui -validity 365 -keyalg RSA -storepass "$PASSWORD" -dname "CN=kafka-ui"
keytool -keystore "$CERTS_DIR/kafka-ui.keystore.jks" -alias kafka-ui -certreq -file "$CERTS_DIR/kafka-ui.csr" -storepass "$PASSWORD"
openssl x509 -req -CA "$CERTS_DIR/ca.crt" -CAkey "$CERTS_DIR/ca.key" -in "$CERTS_DIR/kafka-ui.csr" -out "$CERTS_DIR/kafka-ui.crt" -days 365 -CAcreateserial -sha256
keytool -keystore "$CERTS_DIR/kafka-ui.keystore.jks" -alias CARoot -importcert -file "$CERTS_DIR/ca.crt" -storepass "$PASSWORD" -noprompt
keytool -keystore "$CERTS_DIR/kafka-ui.keystore.jks" -alias kafka-ui -importcert -file "$CERTS_DIR/kafka-ui.crt" -storepass "$PASSWORD" -noprompt

# Generate Truststore for Servers and Clients
keytool -keystore "$CERTS_DIR/server.truststore.jks" -alias CARoot -importcert -file "$CERTS_DIR/ca.crt" -storepass "$PASSWORD" -noprompt

echo "Certificates and keystores for Kafka-UI and clients have been successfully generated in $CERTS_DIR."
