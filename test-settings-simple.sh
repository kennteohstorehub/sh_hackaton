#!/bin/bash

# Get CSRF token from cookie
echo "Getting CSRF token..."
CSRF_RESPONSE=$(curl -s -c cookies.txt http://demo.lvh.me:3838/auth/login)
CSRF_TOKEN=$(grep csrf-token cookies.txt | awk '{print $7}')

echo "CSRF Token: $CSRF_TOKEN"

# Login
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -b cookies.txt -c cookies.txt \
  -X POST http://demo.lvh.me:3838/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{"username":"admin@demo.local","password":"Demo123!@#","_csrf":"'$CSRF_TOKEN'"}'
)

echo "Login response: $LOGIN_RESPONSE"

# Update profile
echo "Updating profile..."
UPDATE_RESPONSE=$(curl -v -b cookies.txt \
  -X PUT http://demo.lvh.me:3838/api/merchant/profile \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{"businessName":"Test Restaurant Update","_csrf":"'$CSRF_TOKEN'"}'
)

echo "Update response: $UPDATE_RESPONSE"

# Check server logs
echo ""
echo "Recent server logs:"
tail -30 /tmp/server.log | grep -E "(tenantIsolation|TenantResolver|validateMerchant|PROFILE|ERROR|error)" || echo "No matching logs found"

# Clean up
rm -f cookies.txt