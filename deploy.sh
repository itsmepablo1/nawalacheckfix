#!/bin/bash
# =============================================================
# deploy.sh — Script deploy manual di VPS
# Jalankan: bash deploy.sh
# =============================================================

set -e  # stop jika ada error

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$APP_DIR/.env"

echo "=================================="
echo "🚀 Nawala Checker — Deploy Script"
echo "=================================="

# Pastikan .env ada di VPS
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ File .env tidak ditemukan di $ENV_FILE"
    echo "   Buat file .env dengan isi berikut:"
    echo ""
    echo "   DATABASE_URL=postgresql://postgres:PASSWORD@db:5432/nawala_db?schema=public"
    echo "   REDIS_URL=redis://redis:6379"
    echo "   AUTH_SECRET=ganti-dengan-secret-kuat"
    echo "   INDIWTF_API_TOKEN=6b933746ff9ccc7d801eec163a0c8f31"
    echo ""
    exit 1
fi

echo "⬇️  Pull kode terbaru..."
git pull origin main

echo "🐳 Load env variables..."
export $(grep -v '^#' "$ENV_FILE" | xargs)

echo "🔨 Build & restart containers..."
docker compose up -d --build --remove-orphans

echo "⏳ Tunggu containers siap (15 detik)..."
sleep 15

echo "🗄️  Push schema database..."
docker compose exec -T web npx prisma db push --schema prisma/schema.prisma

echo "🧹 Bersihkan image lama..."
docker image prune -f

echo ""
echo "✅ Deploy berhasil!"
echo ""
docker compose ps
