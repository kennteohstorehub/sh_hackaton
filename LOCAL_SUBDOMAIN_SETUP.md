# Local Subdomain Setup for Multi-Tenant QMS

The system requires subdomain access. Here's how to set it up:

## Quick Setup

Run this command in Terminal:

```bash
sudo sh -c 'echo "
# StoreHub QMS
127.0.0.1 admin.lvh.me
127.0.0.1 demo.lvh.me
127.0.0.1 test-cafe.lvh.me" >> /etc/hosts'
```

Enter your password when prompted.

## Test Access

After adding hosts entries, access:

1. BackOffice: http://admin.lvh.me:3838
   - Login: backoffice@storehubqms.local
   - Password: BackOffice123\!@#

2. Demo Tenant: http://demo.lvh.me:3838
   - Login: admin@demo.local
   - Password: Demo123\!@#

3. Test Cafe: http://test-cafe.lvh.me:3838
   - Login: cafe@testcafe.local
   - Password: Test123\!@#

## Verify Setup

Test if domains resolve:
```bash
ping -c 1 admin.lvh.me
```

Should show: `64 bytes from 127.0.0.1`
EOF < /dev/null