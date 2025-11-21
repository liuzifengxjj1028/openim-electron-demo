#!/bin/sh
set -e

echo "========================================="
echo "Starting Nginx with PORT=$PORT"
echo "=========================================

"

# 生成 nginx 配置
envsubst '\$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

echo "Generated nginx configuration:"
cat /etc/nginx/conf.d/default.conf

echo ""
echo "Testing nginx configuration..."
nginx -t

echo ""
echo "Starting nginx..."
exec nginx -g 'daemon off;'
