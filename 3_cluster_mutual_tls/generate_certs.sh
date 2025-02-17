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
CN = kafka

[ v3_req ]
subjectAltName = @alt_names

[ alt_names ]
DNS.1 = kafka-1
DNS.2 = kafka-2
DNS.3 = kafka-3
IP.1  = 127.0.0.1
EOF

# Generate Server Keystore
keytool -genkeypair -keystore "$CERTS_DIR/server.keystore.jks" -alias kafka -validity 365 -keyalg RSA -storepass "$PASSWORD" -dname "CN=kafka"
keytool -keystore "$CERTS_DIR/server.keystore.jks" -alias kafka -certreq -file "$CERTS_DIR/kafka.csr" -storepass "$PASSWORD"

# Sign Server Cert with SANs
openssl x509 -req -CA "$CERTS_DIR/ca.crt" -CAkey "$CERTS_DIR/ca.key" -in "$CERTS_DIR/kafka.csr" -out "$CERTS_DIR/kafka.crt" -days 365 -CAcreateserial -sha256 -extfile "$CERTS_DIR/openssl.cnf" -extensions v3_req

# Import CA and Signed Cert into Server Keystore
keytool -keystore "$CERTS_DIR/server.keystore.jks" -alias CARoot -importcert -file "$CERTS_DIR/ca.crt" -storepass "$PASSWORD" -noprompt
keytool -keystore "$CERTS_DIR/server.keystore.jks" -alias kafka -importcert -file "$CERTS_DIR/kafka.crt" -storepass "$PASSWORD" -noprompt

# Generate Client Keystore
keytool -genkeypair -keystore "$CERTS_DIR/client.keystore.jks" -alias client -validity 365 -keyalg RSA -storepass "$PASSWORD" -dname "CN=client"
keytool -keystore "$CERTS_DIR/client.keystore.jks" -alias client -certreq -file "$CERTS_DIR/client.csr" -storepass "$PASSWORD"

# Sign Client Cert
openssl x509 -req -CA "$CERTS_DIR/ca.crt" -CAkey "$CERTS_DIR/ca.key" -in "$CERTS_DIR/client.csr" -out "$CERTS_DIR/client.crt" -days 365 -CAcreateserial -sha256

# Import CA and Signed Cert into Client Keystore
keytool -keystore "$CERTS_DIR/client.keystore.jks" -alias CARoot -importcert -file "$CERTS_DIR/ca.crt" -storepass "$PASSWORD" -noprompt
keytool -keystore "$CERTS_DIR/client.keystore.jks" -alias client -importcert -file "$CERTS_DIR/client.crt" -storepass "$PASSWORD" -noprompt

# Generate Truststore (for Server and Client)
keytool -keystore "$CERTS_DIR/server.truststore.jks" -alias CARoot -importcert -file "$CERTS_DIR/ca.crt" -storepass "$PASSWORD" -noprompt

echo "Certificates and keystores with SANs have been successfully generated in $CERTS_DIR."
