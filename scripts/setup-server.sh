#!/usr/bin/env bash
set -e

echo "=== Настройка сервера для MockInterviewAI ==="

# 1. Обновление пакетов и установка зависимостей
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release ufw

# 2. Установка официального Docker и Docker Compose
if ! command -v docker &> /dev/null; then
    echo "Установка Docker..."
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker $USER
    echo "Docker успешно установлен."
else
    echo "Docker уже установлен."
fi

# 3. Создание рабочей директории
sudo mkdir -p /opt/mock-interview-ai
sudo chown -R $USER:$USER /opt/mock-interview-ai

# 4. Настройка фаервола UFW (открываем SSH, 80, 443, 3000, 8080)
echo "Настройка UFW фаервола..."
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 8080/tcp
sudo ufw --force enable

echo ""
echo "=== Сервер успешно настроен! ==="
echo "Рабочая папка проекта: /opt/mock-interview-ai"
echo "Не забудьте перезайти по SSH, если вы только что установили Docker (чтобы применилась группа docker)."
