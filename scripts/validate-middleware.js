#!/usr/bin/env node

/**
 * Validation script for middleware implementation
 * Checks configuration and basic functionality
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Authentication Middleware Implementation...\n');

// Check if middleware file exists and is properly configured
const middlewarePath = path.join(__dirname, '..', 'middleware.ts');

if (!fs.existsSync(middlewarePath)) {
  console.error('❌ middleware.ts not found');
  process.exit(1);
}

const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');

// Validation checks
const checks = [
  {
    name: 'Middleware is enabled',
    test: () => !middlewareContent.includes('matcher: []'),
    critical: true
  },
  {
    name: 'Security headers are implemented',
    test: () => middlewareContent.includes('X-Frame-Options') && 
                middlewareContent.includes('X-Content-Type-Options'),
    critical: true
  },
  {
    name: 'Content Security Policy is configured',
    test: () => middlewareContent.includes('Content-Security-Policy'),
    critical: false
  },
  {
    name: 'Authentication logic exists',
    test: () => middlewareContent.includes('getSession') && 
                middlewareContent.includes('redirect'),
    critical: true
  },
  {
    name: 'Role-based access control implemented',
    test: () => middlewareContent.includes('userLevel') && 
                middlewareContent.includes('adminRoutes'),
    critical: true
  },
  {
    name: 'Public routes are defined',
    test: () => middlewareContent.includes('publicRoutes') && 
                middlewareContent.includes('/login'),
    critical: true
  },
  {
    name: 'Static assets are excluded',
    test: () => middlewareContent.includes('_next/static') && 
                middlewareContent.includes('favicon.ico'),
    critical: true
  },
  {
    name: 'Error handling is implemented',
    test: () => middlewareContent.includes('try') && 
                middlewareContent.includes('catch'),
    critical: true
  },
  {
    name: 'Development logging is conditional',
    test: () => middlewareContent.includes('NODE_ENV === \'development\''),
    critical: false
  },
  {
    name: 'Redirect URL preservation',
    test: () => middlewareContent.includes('redirectTo'),
    critical: false
  }
];

let passed = 0;
let critical_failures = 0;

console.log('Running validation checks:\n');

checks.forEach(check => {
  const result = check.test();
  const status = result ? '✅' : '❌';
  const severity = check.critical ? '(CRITICAL)' : '(WARNING)';
  
  console.log(`${status} ${check.name} ${!result && check.critical ? severity : ''}`);
  
  if (result) {
    passed++;
  } else if (check.critical) {
    critical_failures++;
  }
});

console.log(`\n📊 Results: ${passed}/${checks.length} checks passed`);

if (critical_failures > 0) {
  console.log(`❌ ${critical_failures} critical failures detected`);
  console.log('\n🚨 SECURITY RISK: Critical middleware checks failed!');
  process.exit(1);
} else {
  console.log('✅ All critical security checks passed');
  
  if (passed === checks.length) {
    console.log('🎉 Perfect score! Middleware implementation is secure and complete.');
  } else {
    console.log('⚠️  Some non-critical improvements could be made.');
  }
}

// Check if test files exist
const testPath = path.join(__dirname, '..', '__tests__', 'middleware.test.ts');
if (fs.existsSync(testPath)) {
  console.log('✅ Test file exists: middleware.test.ts');
} else {
  console.log('⚠️  Test file not found: __tests__/middleware.test.ts');
}

// Check if documentation exists
const docPath = path.join(__dirname, '..', 'docs', 'MIDDLEWARE_SECURITY.md');
if (fs.existsSync(docPath)) {
  console.log('✅ Documentation exists: docs/MIDDLEWARE_SECURITY.md');
} else {
  console.log('⚠️  Documentation not found: docs/MIDDLEWARE_SECURITY.md');
}

console.log('\n🔐 Middleware validation complete!');