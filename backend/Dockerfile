# Build the jar with the same toolchain the project uses locally.
FROM gradle:8.14-jdk21 AS build
WORKDIR /src
COPY gradle gradle
COPY gradlew build.gradle.kts settings.gradle.kts gradle.properties ./
# Cache dependency resolution before the sources change.
RUN ./gradlew --no-daemon dependencies > /dev/null 2>&1 || true
COPY src src
RUN ./gradlew --no-daemon bootJar -x test

FROM eclipse-temurin:24-jre AS runtime
WORKDIR /app
# Run unprivileged: nothing here needs root.
RUN useradd --system --uid 10001 translad
COPY --from=build /src/build/libs/*.jar app.jar
USER translad
EXPOSE 8088
ENV SPRING_PROFILES_ACTIVE=prod
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD ["sh", "-c", "exec 3<>/dev/tcp/127.0.0.1/8088 && echo -e 'GET /actuator/health HTTP/1.1\\r\\nHost: localhost\\r\\nConnection: close\\r\\n\\r\\n' >&3 && grep -q '\"status\":\"UP\"' <&3"]
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
