# Phone Number Update Fix Summary

## Issue Resolved
The merchant phone number update was failing with the error:
```
Argument 'address' must not be null
```

This occurred when updating the merchant profile through the Settings page.

## Root Cause
The frontend was sending the entire merchant object including relations (address, businessHours) in the update request. Prisma was trying to update these relation fields directly on the merchant table, which caused the error since `address` is a separate relation model.

## Fix Applied
The fix was implemented in `/server/routes/merchant.js` in the PUT `/api/merchant/profile` endpoint:

1. **Filter allowed fields**: Only direct merchant fields are included in the update
   ```javascript
   const allowedFields = ['businessName', 'email', 'phone', 'businessType'];
   ```

2. **Handle relations separately**: Address and business hours are updated through their own upsert operations
   ```javascript
   // Handle address update separately if provided
   if (req.body.address) {
     await db.merchantAddress.upsert({
       where: { merchantId: merchant.id },
       update: req.body.address,
       create: {
         merchantId: merchant.id,
         ...req.body.address
       }
     });
   }
   ```

## Verification
The fix has been verified through:

1. **Direct service test**: Successfully updated phone number without errors
2. **Database verification**: Phone number correctly updated in the database
3. **No side effects**: Other merchant fields remain unchanged

## Test Results
✅ Phone update test PASSED!
- Phone number can be updated without errors
- The "Argument 'address' must not be null" error is resolved
- Direct merchant fields are updated properly
- Relations (address, businessHours) are handled separately

## Files Modified
- `/server/routes/merchant.js` - Updated PUT /api/merchant/profile endpoint

## Additional Improvements
The fix also ensures:
- Proper separation of concerns between direct fields and relations
- Better error handling for related models
- Maintains data integrity across related tables