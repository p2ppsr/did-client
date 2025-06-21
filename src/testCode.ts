import { DIDClient } from './index.js'
import { WalletClient } from '@bsv/sdk'

/**
 * Test script for DIDCatalog.findDID method
 * 
 * This script demonstrates how to:
 * 1. Initialize the DIDCatalog with proper configuration
 * 2. Search for DIDs using various query parameters
 * 3. Process and display the results
 */

async function testFindDID(): Promise<void> {
  try {
    console.log('Starting DIDCatalog.findDID test...')

    // Initialize wallet client with default settings
    const wallet = new WalletClient()

    // Create DID catalog with wallet and network configuration
    const catalog = new DIDClient({
      wallet,
      networkPreset: 'mainnet', // Can be 'mainnet', 'testnet', or 'local'
      overlayTopic: 'tm_did',   // Default topic for DID messages
      overlayService: 'ls_did'  // Default lookup service
    })

    console.log('DIDCatalog initialized')

    // Test Case 1: Find by serialNumber
    console.log('\nTest Case 1: Find by serialNumber')
    const serialNumber = 'Zjm0/kwkmBunHIlI/hyQLC0d/yX8081pUhzNBxzluKk=' // Replace with actual serialNumber to test
    const resultsBySerial = await catalog.findDID({ serialNumber })
    console.log(`Found ${resultsBySerial.length} records by serialNumber`)
    console.log(resultsBySerial)
    // console.log(JSON.stringify(resultsBySerial, null, 2))

    // Test Case 2: Find by outpoint
    // console.log('\nTest Case 2: Find by outpoint')
    // const outpoint = 'txid.vout' // Replace with actual txid.vout to test
    // const resultsByOutpoint = await catalog.findDID({ outpoint })
    // console.log(`Found ${resultsByOutpoint.length} records by outpoint`)
    // console.log(JSON.stringify(resultsByOutpoint, null, 2))

    // // Test Case 3: Find with pagination
    // console.log('\nTest Case 3: Find with pagination')
    // const paginatedResults = await catalog.findDID({
    //   limit: 5,
    //   skip: 0,
    //   sortOrder: 'desc' // Most recent first
    // })
    // console.log(`Found ${paginatedResults.length} records with pagination`)
    // console.log(JSON.stringify(paginatedResults, null, 2))

    // // Test Case 4: Find within a date range
    // console.log('\nTest Case 4: Find within a date range')
    // const startDate = '2025-01-01' // Format: YYYY-MM-DD
    // const endDate = '2025-06-21'   // Format: YYYY-MM-DD
    // const dateRangeResults = await catalog.findDID({
    //   startDate,
    //   endDate,
    //   limit: 10
    // })
    // console.log(`Found ${dateRangeResults.length} records within date range`)
    // console.log(JSON.stringify(dateRangeResults, null, 2))

    console.log('\nAll tests completed!')
  } catch (error) {
    console.error('Error testing findDID method:', error)
  }
}

// Execute the test
testFindDID().catch(err => {
  console.error('Unhandled error in test:', err)
  process.exit(1)
})
