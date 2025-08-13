// Simple test script for platform limits validation
// Run with: node -r esbuild-register test-platform-limits.js

const { validateFileSize, validateMultipleFiles, getPlatformLimitsInfo } = require('./lib/platform-limits');

console.log('🧪 Testing Platform Limits System\n');

// Test individual file validation
console.log('📁 Testing individual file validation:');

// Test TikTok video (4GB limit)
const tiktokVideo = validateFileSize('tiktok', 3 * 1024 * 1024 * 1024, 'video/mp4'); // 3GB
console.log('TikTok 3GB video:', tiktokVideo.valid ? '✅ Valid' : '❌ Invalid', tiktokVideo.error || '');

// Test Instagram photo (30MB limit)
const instagramPhoto = validateFileSize('instagram', 25 * 1024 * 1024, 'image/jpeg'); // 25MB
console.log('Instagram 25MB photo:', instagramPhoto.valid ? '✅ Valid' : '❌ Invalid', instagramPhoto.error || '');

// Test oversized file
const oversizedFile = validateFileSize('x', 600 * 1024 * 1024, 'video/mp4'); // 600MB for X (limit: 512MB)
console.log('X 600MB video:', oversizedFile.valid ? '✅ Valid' : '❌ Invalid', oversizedFile.error || '');

// Test multiple files validation
console.log('\n📁 Testing multiple files validation:');

const instagramCarousel = validateMultipleFiles('instagram', [
  { size: 20 * 1024 * 1024, type: 'image/jpeg' }, // 20MB
  { size: 25 * 1024 * 1024, type: 'image/png' },  // 25MB
  { size: 35 * 1024 * 1024, type: 'image/jpeg' }  // 35MB (exceeds 30MB limit)
]);

console.log('Instagram carousel (20MB, 25MB, 35MB photos):');
console.log('Valid:', instagramCarousel.valid ? '✅' : '❌');
console.log('Errors:', instagramCarousel.errors);
console.log('Valid files:', instagramCarousel.validFiles, '/ 3');

// Test platform limits info
console.log('\n📋 Platform Limits Information:');
console.log('TikTok:', getPlatformLimitsInfo('tiktok'));
console.log('Instagram:', getPlatformLimitsInfo('instagram'));
console.log('Facebook:', getPlatformLimitsInfo('facebook'));
console.log('X (Twitter):', getPlatformLimitsInfo('x'));
console.log('LinkedIn:', getPlatformLimitsInfo('linkedin'));

console.log('\n✅ Platform limits testing completed!');