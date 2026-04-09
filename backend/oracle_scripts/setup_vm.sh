#!/bin/bash
# BIST Veri Toplayıcı - Oracle Cloud VM Kurulum Scripti
# Bu scripti VM üzerinde çalıştırarak ortamı hazırlayın.

echo "=========================================="
echo "🚀 BIST Veri Toplayıcı - Kurulum"
echo "=========================================="

# 1. Gerekli Python paketlerini yükle
echo "📦 Python paketleri yükleniyor..."
pip3 install --user yfinance oracledb pandas

# 2. Çalışma dizini oluştur
echo "📁 Dizin oluşturuluyor..."
mkdir -p ~/bist_collector
cd ~/bist_collector

# 3. Environment variable dosyası oluştur
echo "🔐 Environment dosyası oluşturuluyor..."
cat > ~/.bist_env << 'EOF'
# Oracle Database Bağlantı Bilgileri
export ORACLE_DB_USER="ADMIN"
export ORACLE_DB_PASSWORD="SIFREYI_BURAYA_YAZ"
export ORACLE_DB_DSN="evalondb_high"
export ORACLE_WALLET_DIR="/home/opc/wallet"
EOF

echo ""
echo "⚠️  ÖNEMLİ: ~/.bist_env dosyasını düzenleyip gerçek şifreyi girin!"
echo "   nano ~/.bist_env"
echo ""

# 4. Cron job ayarla (Her 2 günde bir, akşam 22:00'de çalışacak - borsa kapandıktan sonra)
echo "⏰ Cron job ekleniyor..."
(crontab -l 2>/dev/null | grep -v "bist_oracle_collector"; echo "0 22 */2 * * source ~/.bist_env && cd ~/bist_collector && python3 bist_oracle_collector.py >> ~/bist_collector/collector.log 2>&1") | crontab -

echo ""
echo "=========================================="
echo "✅ Kurulum tamamlandı!"
echo "=========================================="
echo ""
echo "📋 Sonraki Adımlar:"
echo "1. Şifreyi ayarlayın: nano ~/.bist_env"
echo "2. Scripti kopyalayın: scp bist_oracle_collector.py opc@<VM_IP>:~/bist_collector/"
echo "3. Bağlantıyı test edin: python3 bist_oracle_collector.py --test"
echo "4. Manuel çalıştırma: python3 bist_oracle_collector.py"
echo ""
echo "📅 Otomatik çalışma: Her 2 günde bir, saat 10:00'da"
echo "📝 Log dosyası: ~/bist_collector/collector.log"
echo ""
