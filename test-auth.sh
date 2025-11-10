#!/bin/bash
# Test script for JWT authentication
# This tests all authentication scenarios

BASE_URL="${1:-http://localhost:8787}"

echo "Testing Puku Subscription Service Authentication"
echo "================================================"
echo "Base URL: $BASE_URL"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health check (no auth required)
echo -e "${YELLOW}Test 1: Health Check${NC}"
echo "GET /"
response=$(curl -s "$BASE_URL/")
echo "Response: $response"
if echo "$response" | grep -q "running"; then
    echo -e "${GREEN}✓ PASSED${NC}"
else
    echo -e "${RED}✗ FAILED${NC}"
fi
echo ""

# Test 2: Missing Authorization header
echo -e "${YELLOW}Test 2: Missing Authorization Header${NC}"
echo "POST /api/key (no Authorization header)"
response=$(curl -s -X POST "$BASE_URL/api/key" -w "\nHTTP_CODE:%{http_code}")
http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
body=$(echo "$response" | grep -v "HTTP_CODE")
echo "Response: $body"
echo "HTTP Code: $http_code"
if [ "$http_code" = "403" ] && echo "$body" | grep -q "Authorization header missing"; then
    echo -e "${GREEN}✓ PASSED${NC}"
else
    echo -e "${RED}✗ FAILED (Expected 403 with 'Authorization header missing')${NC}"
fi
echo ""

# Test 3: Invalid Authorization format (no Bearer)
echo -e "${YELLOW}Test 3: Invalid Authorization Format${NC}"
echo "POST /api/key (Authorization: invalid-token)"
response=$(curl -s -X POST "$BASE_URL/api/key" \
  -H "Authorization: invalid-token" \
  -w "\nHTTP_CODE:%{http_code}")
http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
body=$(echo "$response" | grep -v "HTTP_CODE")
echo "Response: $body"
echo "HTTP Code: $http_code"
if [ "$http_code" = "403" ] && echo "$body" | grep -q "Token missing from authorization header"; then
    echo -e "${GREEN}✓ PASSED${NC}"
else
    echo -e "${RED}✗ FAILED (Expected 403 with 'Token missing from authorization header')${NC}"
fi
echo ""

# Test 4: Invalid JWT token
echo -e "${YELLOW}Test 4: Invalid JWT Token${NC}"
echo "POST /api/key (Authorization: Bearer invalid-jwt-token)"
response=$(curl -s -X POST "$BASE_URL/api/key" \
  -H "Authorization: Bearer invalid-jwt-token" \
  -w "\nHTTP_CODE:%{http_code}")
http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
body=$(echo "$response" | grep -v "HTTP_CODE")
echo "Response: $body"
echo "HTTP Code: $http_code"
if [ "$http_code" = "401" ] && echo "$body" | grep -q "Unauthorized"; then
    echo -e "${GREEN}✓ PASSED${NC}"
else
    echo -e "${RED}✗ FAILED (Expected 401 with 'Unauthorized')${NC}"
fi
echo ""

# Test 5: Valid JWT token (if provided)
if [ ! -z "$JWT_TOKEN" ]; then
    echo -e "${YELLOW}Test 5: Valid JWT Token${NC}"
    echo "POST /api/key (Authorization: Bearer \$JWT_TOKEN)"
    response=$(curl -s -X POST "$BASE_URL/api/key" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -H "Content-Type: application/json" \
      -w "\nHTTP_CODE:%{http_code}")
    http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
    body=$(echo "$response" | grep -v "HTTP_CODE")
    echo "Response: $body"
    echo "HTTP Code: $http_code"
    if [ "$http_code" = "200" ] && echo "$body" | grep -q "success"; then
        echo -e "${GREEN}✓ PASSED${NC}"
    else
        echo -e "${RED}✗ FAILED (Expected 200 with success response)${NC}"
    fi
else
    echo -e "${YELLOW}Test 5: Valid JWT Token${NC}"
    echo "Skipped (set JWT_TOKEN environment variable to test)"
fi
echo ""

echo "================================================"
echo "Authentication tests completed!"
echo ""
echo "To test with a valid JWT token:"
echo "  export JWT_TOKEN='your-jwt-token-here'"
echo "  ./test-auth.sh"
