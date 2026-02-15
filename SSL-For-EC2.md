# 🔐 FlowBoard – SSL Setup Guide (Docker + Let's Encrypt)

Complete guide to enable HTTPS on your FlowBoard application using Let's Encrypt SSL certificates.

---

## 📋 Prerequisites

Before starting, ensure:
- Your domain (`shubhamx18.live`) points to your EC2 public IP
- You have SSH access to your EC2 instance
- Docker and Docker Compose are installed

---

## 🧪 Step 0 – Verify DNS Configuration

### Check Domain Resolution

From your local machine, verify DNS is properly configured:

```bash
ping shubhamx18.live
```

**Expected Result:** Should return your EC2 public IP address

**If it fails:**
- Go to your DNS provider (Namecheap, Cloudflare, Route53, etc.)
- Add/update an A record pointing `shubhamx18.live` to your EC2 IP
- Wait 5-10 minutes for DNS propagation
- Test again

---

## 🛑 Step 1 – Stop Docker Services

Certbot needs port 80 to verify domain ownership. Stop all running containers:

```bash
cd ~/project-management-system
docker compose down
```

### Verify Port 80 is Free

```bash
sudo lsof -i :80
```

**Expected Result:** No output (port is free)

**If port is in use:** Kill the process or wait for Docker to fully stop

---

## 📦 Step 2 – Install Certbot

Update system packages and install Certbot:

```bash
sudo apt update
sudo apt install certbot -y
```

### Verify Installation

```bash
certbot --version
```

---

## 🔑 Step 3 – Generate SSL Certificate

Use standalone mode to obtain certificates:

```bash
sudo certbot certonly --standalone -d shubhamx18.live
```

### Interactive Prompts

1. **Email address:** Enter your email (for renewal notifications)
2. **Terms of Service:** Type `y` to agree
3. **Share email with EFF:** Type `y` or `n` (optional)

### Success Message

```
Congratulations! Your certificate and chain have been saved at:
/etc/letsencrypt/live/shubhamx18.live/fullchain.pem
```

### Verify Certificate Files

```bash
sudo ls /etc/letsencrypt/live/shubhamx18.live/
```

**Expected Output:**
```
cert.pem          # Your domain certificate
chain.pem         # Intermediate certificates
fullchain.pem     # Full certificate chain (cert + chain)
privkey.pem       # Private key
```

---

## 🐳 Step 4 – Update Docker Configuration

### Edit docker-compose.yml

Open your docker-compose file:

```bash
cd ~/project-management-system
nano docker-compose.yml
```

### Mount SSL Certificates in Frontend Service

Locate the `frontend:` service and update it:

```yaml
frontend:
  build: ./frontend
  ports:
    - "80:80"
    - "443:443"      # Add HTTPS port
  volumes:
    - /etc/letsencrypt:/etc/letsencrypt:ro    # Mount SSL certs (read-only)
  depends_on:
    - backend
```

**Important Notes:**
- Add the volume **inside** the `frontend` service block only
- `:ro` means read-only (security best practice)
- Do NOT duplicate `volumes:` sections

---

## ⚙️ Step 5 – Configure Nginx for SSL

### Edit frontend/nginx.conf

```bash
nano frontend/nginx.conf
```

### Replace with SSL-Enabled Configuration

```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name shubhamx18.live;
    
    # Redirect all HTTP traffic to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name shubhamx18.live;

    # SSL Certificate paths
    ssl_certificate /etc/letsencrypt/live/shubhamx18.live/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shubhamx18.live/privkey.pem;

    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Root directory
    root /usr/share/nginx/html;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://backend:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Save and exit:** Press `Ctrl+X`, then `Y`, then `Enter`

---

## 🚀 Step 6 – Rebuild and Start Services

### Rebuild with New Configuration

```bash
docker compose up -d --build
```

### Verify Containers are Running

```bash
docker ps
```

**Expected Output:** All services should be `Up` (not restarting)

### Check Frontend Logs (if issues occur)

```bash
docker logs frontend
```

Look for SSL-related errors if container keeps restarting.

---

## ✅ Step 7 – Test SSL Configuration

### Browser Test

Open in your browser:
```
https://shubhamx18.live
```

**Expected Result:** 
- 🔒 Secure lock icon in address bar
- No certificate warnings
- Application loads normally

### Test HTTP Redirect

```
http://shubhamx18.live
```

Should automatically redirect to `https://shubhamx18.live`

### Test API Endpoint

```bash
curl https://shubhamx18.live/api/health
```

**Expected Response:**
```json
{"status":"ok"}
```

### SSL Certificate Details

Check certificate information:
```bash
curl -vI https://shubhamx18.live 2>&1 | grep -A 5 "SSL certificate"
```

Or use online tools:
- https://www.ssllabs.com/ssltest/
- Enter your domain for detailed SSL analysis

---

## 🔄 Step 8 – Enable Auto-Renewal

Let's Encrypt certificates expire after **90 days**. Set up automatic renewal.

### Test Renewal Process

```bash
sudo certbot renew --dry-run
```

**Expected Output:** `Congratulations, all simulated renewals succeeded`

### Create Cron Job for Auto-Renewal

Open crontab editor:

```bash
sudo crontab -e
```

**If prompted to choose editor:** Select `nano` (usually option 1)

### Add Renewal Command

Add this line at the end:

```cron
0 3 * * * certbot renew --quiet && cd /home/ubuntu/project-management-system && docker compose restart frontend
```

**What this does:**
- Runs daily at 3:00 AM
- Checks if certificates need renewal
- If renewed, restarts the frontend container to load new certificates
- `--quiet` suppresses output unless there's an error

**Save and exit:** Press `Ctrl+X`, then `Y`, then `Enter`

### Verify Cron Job

```bash
sudo crontab -l
```

Should display your renewal command.

---

## 🚨 Troubleshooting

### Issue: "Port 80 already in use"

**Symptom:** Certbot fails with port binding error

**Solution:**
```bash
# Stop Docker completely
docker compose down

# Verify port 80 is free
sudo lsof -i :80

# If something is still running, kill it
sudo kill -9 <PID>

# Try certbot again
sudo certbot certonly --standalone -d shubhamx18.live

# Restart Docker
docker compose up -d
```

---

### Issue: Frontend Container Keeps Restarting

**Check logs:**
```bash
docker logs frontend
```

**Common causes:**
1. **SSL files not accessible**
   ```bash
   # Verify permissions
   sudo ls -l /etc/letsencrypt/live/shubhamx18.live/
   ```

2. **Nginx config syntax error**
   ```bash
   # Test nginx config inside container
   docker compose exec frontend nginx -t
   ```

3. **Wrong certificate path**
   - Ensure paths in nginx.conf match actual certificate location
   - Domain name must match exactly

**Fix and rebuild:**
```bash
docker compose down
docker compose up -d --build
```

---

### Issue: Certificate Expired

**Symptom:** Browser shows "Your connection is not private"

**Manual renewal:**
```bash
sudo certbot renew --force-renewal
docker compose restart frontend
```

---

### Issue: DNS Not Resolving

**Test from EC2 instance itself:**
```bash
dig shubhamx18.live
nslookup shubhamx18.live
```

**Check security group:**
- Ensure ports 80 and 443 are open in EC2 security group
- Allow inbound traffic from `0.0.0.0/0`

---

## 📁 Important File Locations

| File/Directory | Purpose |
|---------------|---------|
| `/etc/letsencrypt/live/shubhamx18.live/` | SSL certificates |
| `/etc/letsencrypt/renewal/` | Renewal configuration |
| `~/project-management-system/docker-compose.yml` | Docker configuration |
| `~/project-management-system/frontend/nginx.conf` | Nginx SSL config |
| `/var/log/letsencrypt/` | Certbot logs |

---

## 🔍 Quick Reference Commands

### Certificate Management
```bash
# List all certificates
sudo certbot certificates

# Renew all certificates
sudo certbot renew

# Renew specific domain
sudo certbot renew --cert-name shubhamx18.live

# Delete certificate
sudo certbot delete --cert-name shubhamx18.live
```

### Docker Operations
```bash
# View logs
docker logs frontend
docker logs backend

# Restart specific service
docker compose restart frontend

# Rebuild after config changes
docker compose up -d --build

# Stop everything
docker compose down

# Remove all containers and volumes
docker compose down -v
```

### Nginx Testing
```bash
# Test nginx config inside container
docker compose exec frontend nginx -t

# Reload nginx without restart
docker compose exec frontend nginx -s reload
```

---

## 🎯 Success Checklist

- [ ] Domain resolves to EC2 IP
- [ ] SSL certificates generated successfully
- [ ] Docker containers running without restarts
- [ ] HTTPS works in browser with green lock
- [ ] HTTP redirects to HTTPS
- [ ] API calls work over HTTPS
- [ ] Auto-renewal cron job configured
- [ ] Dry-run renewal test passes

---

## 📚 Additional Resources

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Certbot User Guide](https://eff-certbot.readthedocs.io/)
- [Nginx SSL Configuration](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [SSL Labs Test](https://www.ssllabs.com/ssltest/)

---

## 💡 Pro Tips

1. **Backup your private key:**
   ```bash
   sudo cp /etc/letsencrypt/live/shubhamx18.live/privkey.pem ~/privkey-backup.pem
   ```

2. **Monitor certificate expiration:**
   ```bash
   sudo certbot certificates
   ```

3. **Enable HSTS** (HTTP Strict Transport Security) for extra security:
   Add to nginx.conf inside the HTTPS server block:
   ```nginx
   add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
   ```

4. **Use stronger Diffie-Hellman parameters:**
   ```bash
   sudo openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048
   ```
   Then add to nginx.conf:
   ```nginx
   ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
   ```

---

## 🎉 Done!

Your FlowBoard application is now secured with SSL/TLS encryption. All traffic between users and your server is encrypted and secure.

**Questions or issues?** Check the troubleshooting section or review Docker/Nginx logs for specific error messages.
