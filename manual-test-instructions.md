# Manual Test Instructions for Notify Button

## Prerequisites
- Server is running on port 3838 (`npm start`)
- Demo merchant account exists

## Test Steps

1. **Open Browser**
   - Navigate to http://localhost:3838/auth/login

2. **Login**
   - Email: `demo@storehub.com`
   - Password: `Demo123!`
   - Click Login

3. **Check Dashboard**
   - You should be on the dashboard page
   - Open browser DevTools (F12)
   - Go to Console tab

4. **Test CSRF Token**
   - In console, type: `csrfToken`
   - You should see a token value, not undefined

5. **Find Active Queue**
   - Look for the "Active Queue" section
   - If no queue exists, create one from the dashboard

6. **Add Test Customer**
   - Open new tab: http://localhost:3838/join.html
   - Fill in:
     - Name: Test Customer
     - Phone: +60126368832
     - Email: test@example.com
     - Party Size: 2
   - Click Join Queue

7. **Test Notify Button**
   - Go back to dashboard
   - In Active Queue section, find the customer
   - Click the "Notify" button
   - Check console for any errors

## Expected Results
- ✅ CSRF token should be defined in console
- ✅ Notify button should work without 403 errors
- ✅ Customer status should change to "called"
- ✅ Push notification should be sent (if enabled)

## Current Issue
The CSRF token is not being passed from the dashboard route to the template, causing the Notify button to fail with a 403 Forbidden error.