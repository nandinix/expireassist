#!/usr/bin/env bash
# test_inventory.sh
# Defines a shell function `test_inventory` you can source and call repeatedly,
# or executes the test when run directly.

# Usage:
#  - Source into your shell to get the `test_inventory` function:
#      source tests/test_inventory.sh
#      test_inventory
#  - Or run directly:
#      ./tests/test_inventory.sh

test_inventory() {
  # Localize strict mode to the function so sourcing doesn't change caller shell.
  set -euo pipefail

  local BASE_URL="${BASE_URL:-http://localhost:5000}"
  local CURL="curl"
  local JQ="jq"

  command -v "$CURL" >/dev/null 2>&1 || { echo "curl is required" >&2; return 2; }
  command -v "$JQ" >/dev/null 2>&1 || { echo "jq is required (for JSON assertions)" >&2; return 2; }

  echo "Using base URL: $BASE_URL"

  # Globals set by do_request: body, code
  do_request() {
    # args: METHOD URL [DATA]
    local method="$1"
    local url="$2"
    local data="${3-}"
    if [ -n "$data" ]; then
      resp=$($CURL -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url")
    else
      resp=$($CURL -s -w "\n%{http_code}" -X "$method" "$url")
    fi
    body=$(echo "$resp" | sed '$d')
    code=$(echo "$resp" | tail -n1)
  }

  echo "1) GET /api/inventory (expect 200 and JSON array)"
  do_request GET "$BASE_URL/api/inventory"
  if [ "$code" -ne 200 ]; then
    echo "GET /api/inventory failed with HTTP $code" >&2
    echo "$body" >&2
    return 1
  fi
  echo "$body" | $JQ -e 'if type=="array" then . else error("expected array") end' >/dev/null

  echo "2) POST /api/inventory (create a test item)"
  local POST_PAYLOAD
  POST_PAYLOAD='{"item_name":"Test CLI Item","quantity":2,"expiry_date":"2024-12-31"}'
  do_request POST "$BASE_URL/api/inventory" "$POST_PAYLOAD"
  if [ "$code" -ne 201 ]; then
    echo "POST /api/inventory failed with HTTP $code" >&2
    echo "$body" >&2
    return 1
  fi
  local id
  id=$(echo "$body" | $JQ -r '.id // empty')
  if ! [[ "$id" =~ ^[0-9]+$ ]]; then
    echo "POST response did not include numeric id:" >&2
    echo "$body" >&2
    return 1
  fi
  echo "Created inventory id: $id"

  echo "3) GET /api/inventory/$id (expect 200 and item_name present)"
  do_request GET "$BASE_URL/api/inventory/$id"
  if [ "$code" -ne 200 ]; then
    echo "GET /api/inventory/$id failed with HTTP $code" >&2
    echo "$body" >&2
    return 1
  fi
  local item_name
  item_name=$(echo "$body" | $JQ -r '.item_name // empty')
  if [ -z "$item_name" ]; then
    echo "GET response did not include item_name" >&2
    echo "$body" >&2
    return 1
  fi
  echo "Item name: $item_name"

  echo "4) PUT /api/inventory/$id (update quantity to 5)"
  local PUT_PAYLOAD
  PUT_PAYLOAD='{"quantity":5}'
  do_request PUT "$BASE_URL/api/inventory/$id" "$PUT_PAYLOAD"
  if [ "$code" -ne 200 ]; then
    echo "PUT /api/inventory/$id failed with HTTP $code" >&2
    echo "$body" >&2
    return 1
  fi
  local new_qty
  new_qty=$(echo "$body" | $JQ -r '.quantity // empty')
  if [ "$new_qty" != "5" ]; then
    echo "PUT did not update quantity (got: $new_qty)" >&2
    echo "$body" >&2
    return 1
  fi

  echo "5) DELETE /api/inventory/$id"
  do_request DELETE "$BASE_URL/api/inventory/$id"
  if [ "$code" -ne 200 ]; then
    echo "DELETE /api/inventory/$id failed with HTTP $code" >&2
    echo "$body" >&2
    return 1
  fi

  echo "6) Ensure GET returns 404 after delete"
  do_request GET "$BASE_URL/api/inventory/$id"
  if [ "$code" -ne 404 ]; then
    echo "Expected 404 after delete, got HTTP $code" >&2
    echo "$body" >&2
    return 1
  fi

  echo "All inventory endpoint tests passed."
  return 0
}

# If the script is executed directly, run the test.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  test_inventory
  exit $?
fi