FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

# 전단 크롤링용 Google Chrome + 한글 폰트 설치 (NAS가 amd64)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      wget gnupg ca-certificates fonts-liberation fonts-nanum \
 && wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
 && apt-get install -y --no-install-recommends /tmp/chrome.deb \
 && rm -f /tmp/chrome.deb \
 && rm -rf /var/lib/apt/lists/*

COPY cibono-api.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
