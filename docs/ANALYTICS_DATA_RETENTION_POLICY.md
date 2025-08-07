# Analytics Data Retention Policy

## Overview

The StoreHub Queue Management System implements a **6-month data retention policy** for all analytics data. This policy ensures compliance with data protection regulations while maintaining system performance and storage efficiency.

## Retention Period

- **Maximum retention**: 6 months
- **Applies to**: All queue entries, chat messages, notification logs, and audit logs
- **Exceptions**: BackOffice/SuperAdmin audit logs may be retained longer for security purposes

## What Data is Affected

### 1. Queue Entries
- All completed, cancelled, and no-show queue entries older than 6 months
- Associated customer information and wait time data
- Queue position history and service metrics

### 2. WebChat Messages
- All chat messages between customers and staff
- Message timestamps and session data

### 3. Notification Logs
- SMS, email, push notification records
- Delivery status and error logs

### 4. Audit Logs
- User activity logs (except SuperAdmin actions)
- System event logs
- API access logs

### 5. Push Subscriptions
- Expired browser push notification subscriptions
- Device tokens older than 6 months

## Implementation Details

### Automatic Cleanup Schedule
- **Initial cleanup**: Runs on server startup
- **Daily cleanup**: Runs at 2:00 AM server time
- **Location**: `/server/jobs/analyticsDataRetention.js`

### Analytics Recalculation
After data cleanup, the system automatically:
- Recalculates queue statistics based on remaining data
- Updates average wait times and service times
- Refreshes customer satisfaction metrics

### API Limitations
Analytics API endpoints automatically enforce the 6-month limit:
- Requests for data older than 6 months return data from exactly 6 months ago
- Available periods: 1d, 7d, 30d, 90d, 180d (max)

## Manual Cleanup

To manually trigger data retention cleanup:

```bash
# Run the test script (with confirmation prompt)
node scripts/test-analytics-retention.js

# Or run the job directly
node server/jobs/analyticsDataRetention.js
```

## Monitoring

The retention job logs the following information:
- Number of records deleted per data type
- Queue analytics update count
- Any errors encountered during cleanup

Check server logs for entries starting with `[ANALYTICS RETENTION]`.

## Data Export

Before data is automatically deleted:
1. Use the analytics export endpoint to download historical data
2. Available formats: JSON, CSV
3. Export endpoint: `GET /api/analytics/export?period=180d&format=csv`

## Compliance Notes

This retention policy helps with:
- GDPR compliance (data minimization principle)
- Storage optimization
- System performance maintenance
- Privacy protection

## Configuration

Currently, the 6-month retention period is hardcoded. To modify:
1. Edit `/server/jobs/analyticsDataRetention.js`
2. Update the `sixMonthsAgo` calculation
3. Update this documentation
4. Restart the server

## Best Practices

1. **Regular Backups**: Backup important analytics data before the 6-month cutoff
2. **Export Reports**: Generate monthly/quarterly reports for long-term storage
3. **Monitor Cleanup**: Check logs to ensure cleanup runs successfully
4. **Performance**: The cleanup job is designed to run during low-traffic hours (2 AM)