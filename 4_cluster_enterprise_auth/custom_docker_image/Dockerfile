FROM confluentinc/cp-kafka:latest

# Switch to root to install libraries
USER root

# Download and add Strimzi OAuth libraries
RUN curl -L -o /usr/share/java/kafka/strimzi-kafka-oauth-common-0.15.0.jar https://repo1.maven.org/maven2/io/strimzi/kafka-oauth-common/0.15.0/kafka-oauth-common-0.15.0.jar && \
    curl -L -o /usr/share/java/kafka/strimzi-kafka-oauth-server-0.15.0.jar https://repo1.maven.org/maven2/io/strimzi/kafka-oauth-server/0.15.0/kafka-oauth-server-0.15.0.jar && \
    curl -L -o /usr/share/java/kafka/strimzi-kafka-oauth-client-0.15.0.jar https://repo1.maven.org/maven2/io/strimzi/kafka-oauth-client/0.15.0/kafka-oauth-client-0.15.0.jar && \
    curl -L -o /usr/share/java/kafka/kafka-oauth-keycloak-authorizer-0.15.0.jar https://repo1.maven.org/maven2/io/strimzi/kafka-oauth-keycloak-authorizer/0.15.0/kafka-oauth-keycloak-authorizer-0.15.0.jar

# Download and add Nimbus JOSE+JWT library
RUN curl -L -o /usr/share/java/kafka/nimbus-jose-jwt-10.0.1.jar https://repo1.maven.org/maven2/com/nimbusds/nimbus-jose-jwt/10.0.1/nimbus-jose-jwt-10.0.1.jar

# troubleshooting tools install
RUN dnf install -y net-tools

# Switch back to appuser
USER appuser