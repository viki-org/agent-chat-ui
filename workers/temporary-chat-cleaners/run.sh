#!/bin/bash

# Script to delete temporary threads older than 24 hours from LangGraph server
# Usage: ./run.sh

set -e

CUTOFF_TIME=$(date -u -v-120S +%s)  # 2 minutes ago in Unix timestamp

echo "Fetching threads from $LANGGRAPH_SERVER..."
echo "Cutoff time: $(date -u -r $CUTOFF_TIME +"%Y-%m-%dT%H:%M:%S+00:00")"
echo ""

# Fetch all threads
THREADS=$(curl -sSL --request POST \
  --url "${LANGGRAPH_SERVER}/threads/search" \
  --header 'Content-Type: application/json' \
  -d {})

# Check if curl was successful
if [ $? -ne 0 ]; then
  echo "Error: Failed to fetch threads from server"
  exit 1
fi

# Parse and delete temporary threads older than 24 hours
echo "$THREADS" | jq -c '.[]' | while read -r thread; do
  THREAD_ID=$(echo "$thread" | jq -r '.thread_id')
  UPDATED_AT=$(echo "$thread" | jq -r '.updated_at')
  IS_TEMPORARY=$(echo "$thread" | jq -r '.metadata.temporary // "false"')

  # Convert updated_at to Unix timestamp
  UPDATED_TIMESTAMP=$(date -j -f "%Y-%m-%dT%H:%M:%S" "$(echo $UPDATED_AT | cut -d'+' -f1)" +%s 2>/dev/null)

  # Check if thread is temporary and older than 24 hours
  if [ "$IS_TEMPORARY" = "true" ] && [ "$UPDATED_TIMESTAMP" -lt "$CUTOFF_TIME" ]; then
    echo "Deleting thread: $THREAD_ID (updated: $UPDATED_AT)"

    # Send DELETE request
    DELETE_RESPONSE=$(curl -sSL -w "\nHTTP_STATUS:%{http_code}" \
      --request DELETE \
      --url "${LANGGRAPH_SERVER}/threads/${THREAD_ID}" \
      --header 'Content-Type: application/json')

    HTTP_STATUS=$(echo "$DELETE_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)

    if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "204" ]; then
      echo "  ✓ Successfully deleted thread $THREAD_ID"
    else
      echo "  ✗ Failed to delete thread $THREAD_ID (HTTP status: $HTTP_STATUS)"
    fi
  else
    if [ "$IS_TEMPORARY" = "true" ]; then
      echo "Skipping thread: $THREAD_ID (not old enough, updated: $UPDATED_AT)"
    fi
  fi
done

echo ""
echo "Cleanup completed!"
