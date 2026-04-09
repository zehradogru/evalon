#!/bin/bash
source ~/.bist_env
cd ~/bist_collector
pkill -f bist_oracle_1h_collector || true
nohup python3 -u bist_oracle_1h_collector.py > collector_1h.log 2>&1 &
echo "Collector successfully started in the background."
ps aux | grep bist_oracle_1h | grep -v grep
