#!/usr/bin/env python3
import requests
import json

# Test Claude API directly
api_key = "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"

headers = {
    "x-api-key": api_key,
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01"
}

payload = {
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 100,
    "messages": [
        {
            "role": "user",
            "content": "Hello, this is a test message."
        }
    ]
}

try:
    response = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers=headers,
        json=payload,
        timeout=30
    )
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
