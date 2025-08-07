#!/bin/bash

echo "Testing merchant phone number update..."
echo

# Base URL
BASE_URL="http://localhost:3838"

# Step 1: Get login page to extract CSRF token and session
echo "1. Getting CSRF token..."
LOGIN_PAGE=$(curl -s -c cookies.txt "$BASE_URL/auth/login")
CSRF_TOKEN=$(echo "$LOGIN_PAGE" | grep -oP 'name="csrf-token"\s+content="\K[^"]+' || echo "$LOGIN_PAGE" | grep -o 'name="csrf-token"[[:space:]]*content="[^"]*"' | sed 's/.*content="\([^"]*\)".*/\1/')

if [ -z "$CSRF_TOKEN" ]; then
  echo "Failed to extract CSRF token"
  exit 1
fi

echo "✓ CSRF token obtained: ${CSRF_TOKEN:0:10}..."
echo

# Step 2: Login as merchant
echo "2. Logging in as merchant..."
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -b cookies.txt -c cookies.txt \
  -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d "email=demo@merchant.com&password=password123" \
  -L)

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "302" && "$HTTP_CODE" != "303" ]]; then
  echo "Login failed with HTTP $HTTP_CODE"
  echo "Response: $RESPONSE_BODY"
  exit 1
fi

echo "✓ Login successful"
echo

# Step 3: Get current profile
echo "3. Getting current profile..."
PROFILE=$(curl -s -b cookies.txt "$BASE_URL/api/merchant/profile")
CURRENT_PHONE=$(echo "$PROFILE" | grep -o '"phone":"[^"]*"' | cut -d'"' -f4)
echo "Current phone: ${CURRENT_PHONE:-Not set}"
echo "✓ Profile retrieved"
echo

# Step 4: Update phone number
echo "4. Updating phone number..."
NEW_PHONE="+1 (555) 123-4567"

UPDATE_RESPONSE=$(curl -s -w "\n%{http_code}" -b cookies.txt \
  -X PUT "$BASE_URL/api/merchant/profile" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d "{\"phone\":\"$NEW_PHONE\"}")

HTTP_CODE=$(echo "$UPDATE_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$UPDATE_RESPONSE" | sed '$d')

echo "Update response status: $HTTP_CODE"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "Update failed!"
  echo "Response: $RESPONSE_BODY"
  exit 1
fi

echo "✓ Phone updated successfully"
echo

# Step 5: Verify the update
echo "5. Verifying update..."
VERIFY_PROFILE=$(curl -s -b cookies.txt "$BASE_URL/api/merchant/profile")
UPDATED_PHONE=$(echo "$VERIFY_PROFILE" | grep -o '"phone":"[^"]*"' | cut -d'"' -f4)
echo "Updated phone: $UPDATED_PHONE"

# Clean up
rm -f cookies.txt

# Check if update was successful
if [ "$UPDATED_PHONE" = "$NEW_PHONE" ]; then
  echo
  echo "✅ Phone update test PASSED!"
  echo
  echo "The fix is working correctly:"
  echo "- Phone number can be updated without errors"
  echo "- The 'Argument address must not be null' error is resolved"
  echo "- Relations (address, businessHours) are handled separately"
else
  echo
  echo "❌ Phone update test FAILED!"
  echo "Expected: $NEW_PHONE"
  echo "Got: $UPDATED_PHONE"
  exit 1
fi