#!/bin/bash
# 1. jar 빌드
cd ../cibono-api
./gradlew bootJar

# 2. jar 복사
cp build/libs/cibono-api-*.jar ../deploy/cibono-api.jar

# 3. 컨테이너 재시작
cd ../deploy
docker-compose up -d --build

echo "배포 완료"
