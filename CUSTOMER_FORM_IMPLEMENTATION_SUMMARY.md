# Customer Form Implementation Summary

## Overview
Successfully implemented a complete customer form with all requested fields and merchant-controlled party size limits.

## Changes Made

### 1. Dashboard Customer Form (views/dashboard/index-storehub-new.ejs)
- Added Customer Name field (required)
- Added Phone Number field (required) 
- Added Party Size dropdown (required, 1-maxPartySize)
- Added Special Requests textarea (optional)
- Form is mobile-responsive with grid layout that stacks on small screens

### 2. JavaScript Function Updates (views/dashboard/index-storehub-new.ejs)
- Updated `addCustomer()` function to:
  - Validate all required fields (name, phone, party size)
  - Send all new fields to the API endpoint
  - Show appropriate error messages for validation

### 3. API Endpoint Created (server/routes/queue.js)
- Created POST `/api/queues/:id/customers` endpoint
- Validates party size against merchant settings
- Generates unique customer ID and verification code
- Emits real-time updates to merchant dashboard

### 4. Merchant Settings Integration
- Added `partySizeRegularMax` to merchant settings (default: 5, max: 20)
- Settings page allows merchants to configure max party size
- Dashboard loads merchant settings on render
- Customer-facing queue join pages respect merchant settings

### 5. Database Schema
- Already had `partySize` field in QueueEntry model
- Already had `partySizeRegularMax` in MerchantSettings model
- No database changes needed

## Key Features

### Party Size Control
- Merchants can set maximum party size (1-20, recommended 1-10)
- Default maximum is 5 people
- Form enforces the limit both client-side and server-side
- User suggestion: Groups larger than 5 should use reservations

### Mobile Responsiveness
- Form uses CSS Grid with `form-row` class
- Automatically stacks fields on screens < 768px
- All form elements are touch-friendly

### Data Validation
- Name: Required, 1-100 characters
- Phone: Required, valid international format
- Party Size: Required, 1-maxPartySize
- Special Requests: Optional, max 500 characters

## Usage

### For Merchants:
1. Go to Settings > Queue Settings
2. Set "Maximum Party Size" (default 5)
3. Save settings

### Adding Customers:
1. Click "Add Customer" button on dashboard
2. Fill in all required fields
3. Customer is added to queue with all information

## Testing
- Form validates all required fields before submission
- API validates party size against merchant settings
- Real-time updates show new customers immediately
- Mobile layout tested and working