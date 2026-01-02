/**
 * HTTP Archive Fetcher Example
 *
 * This example demonstrates how to use the HTTP archive fetcher module
 * to download and extract archives from HTTP/HTTPS URLs.
 */

import {
  fetchHttpArchive,
  listHttpCache,
  clearHttpCache,
  getCacheInfo,
} from "../src/core/http-fetcher.js";

async function main() {
  console.log("=== HTTP Archive Fetcher Example ===\n");

  // Example 1: Fetch a tar.gz archive
  console.log("1. Fetching a tar.gz archive from npm registry...");
  const result1 = await fetchHttpArchive(
    "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",
    {
      timeout: 60000,
    },
  );

  console.log(`   Cached: ${result1.cached}`);
  console.log(`   Checksum: ${result1.checksum}`);
  console.log(`   Files extracted: ${result1.files.length}`);
  console.log(`   First 5 files:`);
  for (let i = 0; i < Math.min(5, result1.files.length); i++) {
    console.log(`     - ${result1.files[i].path}`);
  }
  console.log();

  // Example 2: Fetch with subpath filter
  console.log("2. Fetching the same archive with subpath filter...");
  const result2 = await fetchHttpArchive(
    "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",
    {
      subpath: "package/",
      timeout: 60000,
    },
  );

  console.log(`   Cached: ${result2.cached}`);
  console.log(`   Files extracted (filtered): ${result2.files.length}`);
  console.log(`   First 5 files:`);
  for (let i = 0; i < Math.min(5, result2.files.length); i++) {
    console.log(`     - ${result2.files[i].path}`);
  }
  console.log();

  // Example 3: Check cache info
  console.log("3. Checking cache information...");
  const cacheInfo = await getCacheInfo(
    "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",
  );

  if (cacheInfo && cacheInfo.exists) {
    console.log(`   Cache exists: true`);
    console.log(`   Checksum: ${cacheInfo.checksum}`);
    console.log(`   Path: ${cacheInfo.path}`);
  } else {
    console.log(`   Cache exists: false`);
  }
  console.log();

  // Example 4: List cache
  console.log("4. Listing cached archives...");
  const cached = await listHttpCache();
  console.log(`   Total cached archives: ${cached.length}`);
  for (const key of cached) {
    console.log(`     - ${key}`);
  }
  console.log();

  // Example 5: Fetch with checksum validation
  console.log("5. Fetching with checksum validation...");
  try {
    const result3 = await fetchHttpArchive(
      "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",
      {
        sha256: result1.checksum, // Use correct checksum
        timeout: 60000,
      },
    );
    console.log(`   Checksum validation passed!`);
    console.log(`   Files extracted: ${result3.files.length}`);
  } catch (error) {
    console.error(`   Checksum validation failed:`, error);
  }
  console.log();

  // Example 6: Clear cache
  console.log("6. Clearing cache...");
  const cleared = await clearHttpCache();
  console.log(`   Cleared ${cleared} cache entries`);
  console.log();

  console.log("=== Example completed ===");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
