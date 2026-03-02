#!/bin/bash
# Первоначальная настройка VPS (Ubuntu, 1GB RAM)
# Запускать от root: bash setup-vps.sh
set -euo pipefail

echo "=== 1. Swap (2GB) для 1GB VPS ==="
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Swap создан"
else
  echo "Swap уже есть"
fi

echo "=== 2. Docker ==="
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  echo "Docker установлен"
else
  echo "Docker уже установлен"
fi

echo "=== 3. Пользователь deploy ==="
if ! id deploy &> /dev/null; then
  useradd -m -s /bin/bash -G docker deploy
  echo "Пользователь deploy создан. Добавь SSH-ключ:"
  echo "  mkdir -p /home/deploy/.ssh"
  echo "  echo 'ТВОЙ_ПУБЛИЧНЫЙ_КЛЮЧ' >> /home/deploy/.ssh/authorized_keys"
  echo "  chown -R deploy:deploy /home/deploy/.ssh"
  echo "  chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys"
else
  echo "Пользователь deploy уже существует"
fi

echo "=== 4. Директория проекта ==="
mkdir -p /home/deploy/benefit-market/deploy
chown -R deploy:deploy /home/deploy/benefit-market

echo "=== 5. Файрвол ==="
if command -v ufw &> /dev/null; then
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
  echo "UFW настроен (22, 80, 443)"
fi

echo ""
echo "=== Готово! ==="
echo ""
echo "Дальше:"
echo "1. Добавь SSH-ключ для deploy (см. выше)"
echo "2. Залогинься как deploy и скопируй файлы:"
echo "   scp docker-compose.prod.yml deploy@VPS_IP:~/benefit-market/"
echo "   scp deploy/Caddyfile deploy@VPS_IP:~/benefit-market/deploy/"
echo ""
echo "3. Создай .env на сервере:"
echo "   ssh deploy@VPS_IP"
echo "   cat > ~/benefit-market/.env << 'EOF'"
echo "   SUPABASE_SERVICE_ROLE_KEY=sb_secret_..."
echo "   EOF"
echo ""
echo "4. Залогинь docker в GHCR:"
echo "   docker login ghcr.io -u GITHUB_USERNAME"
echo ""
echo "5. Добавь секреты в GitHub (Settings → Secrets → Actions):"
echo "   VPS_HOST       — IP сервера"
echo "   VPS_USER       — deploy"
echo "   VPS_SSH_KEY    — приватный SSH-ключ"
echo "   NEXT_PUBLIC_SUPABASE_URL  — URL Supabase"
echo "   NEXT_PUBLIC_SUPABASE_ANON_KEY — anon key"
echo ""
echo "6. Задай домен на сервере:"
echo "   echo 'DOMAIN=benefit-market.duckdns.org' >> ~/benefit-market/.env"
echo ""
echo "7. git push в main — деплой автоматический!"
