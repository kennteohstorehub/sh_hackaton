# Card-Based Acknowledgment System Test Guide

## Overview
This document describes the comprehensive test suite for the new card-based acknowledgment system that replaces the overlay popup in the queue management system.

## Test Categories

### 1. Card Appearance Tests
- **Inline Display**: Verifies cards appear inline within the chat interface (not as overlay)
- **Verification Code**: Ensures the verification code is prominently displayed with proper styling
- **Action Buttons**: Confirms both action buttons are visible, enabled, and have proper accessibility attributes

### 2. Input Box Behavior Tests
- **Hidden During Interaction**: Validates that text input is hidden when acknowledgment cards are shown
- **Instruction Message**: Verifies "use action buttons" message appears when input is hidden
- **Re-enable After Action**: Confirms input is re-enabled after acknowledgment or cancellation

### 3. Acknowledgment Flow Tests
- **Acknowledge Action**: Tests clicking "I'm headed to restaurant" shows confirmation message
- **Dashboard Update**: Verifies dashboard reflects acknowledgment status (if applicable)
- **Card Replacement**: Ensures cards are replaced with success message after acknowledgment

### 4. Cancellation Flow Tests
- **Cancel Initiation**: Tests clicking "Cancel my spot" shows confirmation cards
- **Confirm Cancellation**: Verifies "Yes, cancel" removes user from queue
- **Decline Cancellation**: Ensures "No, keep my spot" returns to original cards

### 5. Timeout Flow Tests
- **Warning Messages**: Tests timeout warnings at 4 and 5 minutes (skipped in automated tests)
- **Warning Styling**: Validates warning card appearance and styling
- **Auto-cancellation**: Tests automatic cancellation at 7 minutes (manual test)

### 6. Edge Case Tests
- **Double-click Prevention**: Ensures buttons disable after first click to prevent duplicate actions
- **Page Refresh**: Verifies cards reappear correctly after page refresh if not acknowledged
- **Multiple Notifications**: Tests handling of duplicate call notifications
- **Network Errors**: Validates graceful handling of network failures
- **Keyboard Navigation**: Ensures cards are accessible via keyboard (Tab/Enter)

### 7. Visual Tests
- **Design Compliance**: Takes screenshots to verify visual appearance
- **Mobile Responsiveness**: Tests card layout on mobile viewport (375x667)

### 8. Sound and Notification Tests
- **Sound Playback**: Verifies notification sound plays when customer is called
- **Sound Stopping**: Ensures sound stops on acknowledgment

## Running the Tests

### Prerequisites
1. Start the development server:
   ```bash
   npm run dev
   ```

2. Ensure the server is running on port 3838:
   ```bash
   curl http://localhost:3838/health
   ```

### Run All Card Tests
```bash
./run-card-tests.sh
```

### Run Specific Test Groups
```bash
# Run only card appearance tests
npx playwright test tests/e2e/card-acknowledgment-system.spec.js -g "Card Appearance"

# Run only edge case tests
npx playwright test tests/e2e/card-acknowledgment-system.spec.js -g "Edge Cases"
```

### Run with UI Mode (Interactive)
```bash
npx playwright test tests/e2e/card-acknowledgment-system.spec.js --ui
```

### Debug Mode
```bash
npx playwright test tests/e2e/card-acknowledgment-system.spec.js --debug
```

## Test Data
- **Test Merchant ID**: `507f1f77bcf86cd799439011`
- **Test Queue ID**: `507f1f77bcf86cd799439012`
- **Test Phone**: `+60123456789`
- Each test creates unique customer names with timestamps

## Screenshots
Test screenshots are saved in the `test-results/` directory:
- `card-appearance.png` - Shows cards in the chat interface
- `cards-visual.png` - Close-up of card styling
- `cards-mobile.png` - Mobile responsive view

## Manual Testing Checklist

### Timeout Testing (Manual)
Since timeout tests take 4-7 minutes, test these manually:

1. **4-Minute Warning**:
   - Join queue and get called
   - Wait 4 minutes without responding
   - Verify warning card appears

2. **5-Minute Urgent Warning**:
   - Continue waiting
   - Verify urgent warning at 5 minutes

3. **7-Minute Auto-cancel**:
   - Wait until 7 minutes
   - Verify automatic cancellation

### Cross-Browser Testing
Run tests in different browsers:
```bash
# Chrome (default)
npx playwright test tests/e2e/card-acknowledgment-system.spec.js

# Firefox
npx playwright test tests/e2e/card-acknowledgment-system.spec.js --project=firefox

# Safari
npx playwright test tests/e2e/card-acknowledgment-system.spec.js --project=webkit
```

## Troubleshooting

### Common Issues

1. **"Server not running" error**:
   - Ensure server is started: `npm run dev`
   - Check port 3838 is not in use

2. **Tests timeout**:
   - Increase timeout: `--timeout=120000`
   - Check network connectivity

3. **Screenshots missing**:
   - Ensure `test-results/` directory exists
   - Check file permissions

### Debug Tips
- Add `await page.pause()` to pause test execution
- Use `page.screenshot()` for debugging specific states
- Check browser console logs in test output
- Use `--headed` flag to see browser during tests

## CI/CD Integration
To run in CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Run Card Acknowledgment Tests
  run: |
    npm ci
    npx playwright install
    npm run dev &
    sleep 5
    npx playwright test tests/e2e/card-acknowledgment-system.spec.js
```

## Test Maintenance
- Update test IDs if UI element IDs change
- Adjust timeouts based on system performance
- Update screenshots baseline when design changes
- Add new tests for new features

## Coverage Report
The test suite covers:
- ✅ All user interactions with acknowledgment cards
- ✅ Error handling and edge cases
- ✅ Visual appearance and responsiveness
- ✅ Integration with backend APIs
- ✅ Accessibility features
- ⚠️  Long timeout flows (manual testing recommended)
EOF < /dev/null