/**
 * Test script to verify Firestore connection and CRUD operations.
 *
 * Run with: npx tsx scripts/test-firestore.ts
 */

import { db } from '../lib/firebase';
import {
  createOrganization,
  getOrganizationById,
  getOrgByBccAddress,
  createDeal,
  getDealsByOrg,
  getDealById,
  updateDealStatus,
} from '../lib/firestore-service';
import { parseEmailToDeal } from '../lib/deal-parser';
import { collection, getDocs } from 'firebase/firestore';

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset'): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message: string): void {
  log(`✓ ${message}`, 'green');
}

function logError(message: string): void {
  log(`✗ ${message}`, 'red');
}

function logInfo(message: string): void {
  log(`→ ${message}`, 'cyan');
}

async function testFirestoreConnection(): Promise<boolean> {
  log('\n========================================', 'blue');
  log('  ChannelSignal Firestore Test Suite', 'blue');
  log('========================================\n', 'blue');

  try {
    // Test 1: Basic connection
    logInfo('Testing Firestore connection...');
    const testCollection = collection(db, '_connection_test');
    await getDocs(testCollection);
    logSuccess('Firestore connection successful!');

    // Test 2: Create Organization
    logInfo('Creating test organization...');
    const testOrg = await createOrganization({
      name: 'Test Company Inc.',
      bccAddress: `deals-test-${Date.now()}@channelsignal.app`,
      members: [
        {
          userId: 'test-user-123',
          email: 'admin@testcompany.com',
          role: 'owner',
          joinedAt: new Date(),
        },
      ],
    });
    logSuccess(`Organization created with ID: ${testOrg.id}`);
    console.log('   Organization data:', JSON.stringify(testOrg, null, 2));

    // Test 3: Get Organization by ID
    logInfo('Retrieving organization by ID...');
    const fetchedOrg = await getOrganizationById(testOrg.id);
    if (fetchedOrg) {
      logSuccess(`Organization retrieved: ${fetchedOrg.name}`);
    } else {
      logError('Failed to retrieve organization by ID');
      return false;
    }

    // Test 4: Get Organization by BCC address
    logInfo('Looking up organization by BCC address...');
    const orgByBcc = await getOrgByBccAddress(testOrg.bccAddress);
    if (orgByBcc) {
      logSuccess(`Organization found by BCC: ${orgByBcc.name}`);
    } else {
      logError('Failed to find organization by BCC address');
      return false;
    }

    // Test 5: Parse email and create deal
    logInfo('Parsing test email and creating deal...');
    const testEmail = `From: John Seller <john@partner.com>
To: Jane Buyer <jane@customer.com>
Cc: deals-test@channelsignal.app
Subject: RE: Proposal for Enterprise License - $50,000

Hi Jane,

Thanks for your interest in our Enterprise License.

As discussed, the total investment would be $50,000 USD for the annual license,
which includes premium support and unlimited users.

Let me know if you have any questions!

Best regards,
John`;

    const parsedDeal = parseEmailToDeal(testEmail, testOrg.id);
    console.log('\n   Parsed deal data:');
    console.log(`   - Subject: ${parsedDeal.subject}`);
    console.log(`   - Amount: ${parsedDeal.amount} ${parsedDeal.currency}`);
    console.log(`   - Contacts: ${parsedDeal.contacts.length}`);
    parsedDeal.contacts.forEach((c) => {
      console.log(`     • ${c.name} <${c.email}> (${c.role})`);
    });

    const createdDeal = await createDeal(parsedDeal);
    logSuccess(`Deal created with ID: ${createdDeal.id}`);

    // Test 6: Get deals by organization
    logInfo('Fetching deals for organization...');
    const orgDeals = await getDealsByOrg(testOrg.id);
    logSuccess(`Found ${orgDeals.length} deal(s) for organization`);

    // Test 7: Get deal by ID
    logInfo('Retrieving deal by ID...');
    const fetchedDeal = await getDealById(createdDeal.id);
    if (fetchedDeal) {
      logSuccess(`Deal retrieved: "${fetchedDeal.subject}"`);
    } else {
      logError('Failed to retrieve deal by ID');
      return false;
    }

    // Test 8: Update deal status
    logInfo('Updating deal status...');
    await updateDealStatus(createdDeal.id, 'active');
    const updatedDeal = await getDealById(createdDeal.id);
    if (updatedDeal?.status === 'active') {
      logSuccess(`Deal status updated to: ${updatedDeal.status}`);
    } else {
      logError('Failed to update deal status');
      return false;
    }

    log('\n========================================', 'green');
    log('  All tests passed successfully! ', 'green');
    log('========================================\n', 'green');

    log('Test data created:', 'yellow');
    log(`  Organization ID: ${testOrg.id}`, 'yellow');
    log(`  BCC Address: ${testOrg.bccAddress}`, 'yellow');
    log(`  Deal ID: ${createdDeal.id}`, 'yellow');
    log('\nNote: Test data remains in Firestore.', 'yellow');
    log('You can view it in the Firebase Console.\n', 'yellow');

    return true;
  } catch (error) {
    logError('Test failed with error:');
    console.error(error);
    return false;
  }
}

// Run the test
testFirestoreConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
