# Manual Testing Guide

## To Access the System

You need to add these entries to /etc/hosts:

```bash
sudo nano /etc/hosts
```

Add:
```
127.0.0.1 admin.lvh.me
127.0.0.1 demo.lvh.me
127.0.0.1 test-cafe.lvh.me
```

Then access:
1. BackOffice: http://admin.lvh.me:3000 (backoffice@storehubqms.local / BackOffice123\!@#)
2. Demo: http://demo.lvh.me:3000 (admin@demo.local / Demo123\!@#)
3. Test Cafe: http://test-cafe.lvh.me:3000 (cafe@testcafe.local / Test123\!@#)

The server is running on port 3838.
EOF < /dev/null