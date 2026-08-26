# Build the jar with the same toolchain the project uses locally.
FROM gradle:8.14-jdk24 AS build
WORKDIR /src
COPY gradle gradle
COPY gradlew build.gradle.kts settings.gradle.kts gradle.properties ./
# Cache dependency resolution before the sources change.
RUN ./gradlew --no-daemon dependencies > /dev/null 2>&1 || true
COPY src src
RUN ./gradlew --no-daemon bootJar -x test

# Alpine, because its busybox provides the wget the HEALTHCHECK needs;
# the Ubuntu-based JRE image ships neither wget nor curl.
FROM eclipse-temurin:24-jre-alpine AS runtime
WORKDIR /app
# Run unprivileged: nothing here needs root.
RUN adduser -S -u 10001 lexstore
COPY --from=build /src/build/libs/*.jar app.jar
USER lexstore
EXPOSE 8088
ENV SPRING_PROFILES_ACTIVE=prod
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8088/actuator/health || exit 1
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
