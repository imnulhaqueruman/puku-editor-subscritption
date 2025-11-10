

This is the example code of create new api key 
```python
import requests
import os

PROVISIONING_API_KEY = os.getenv("PROVISIONING_API_KEY", "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")
BASE_URL = "https://openrouter.ai/api/v1/keys"

def create_openrouter_key(name: str, daily_limit: float):
    """
    Creates a new OpenRouter API key with a daily usage limit.
    Once the limit is exceeded, the key automatically becomes disabled.
    """
    payload = {
        "name": name,
        "limit": daily_limit,  # Daily credit limit
          # Reset every day at midnight UTC
        "include_byok_in_limit": False,
    }

    headers = {
        "Authorization": f"Bearer {PROVISIONING_API_KEY}",
        "Content-Type": "application/json",
    }

    response = requests.post(BASE_URL, headers=headers, json=payload)
    """
    example response 
    {
  "data": {
    "hash": "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",
    "name": "My New API Key",
    "label": "My New API Key",
    "disabled": false,
    "limit": 50,
    "limit_remaining": 50,
    "limit_reset": "monthly",
    "include_byok_in_limit": true,
    "usage": 0,
    "usage_daily": 0,
    "usage_weekly": 0,
    "usage_monthly": 0,
    "byok_usage": 0,
    "byok_usage_daily": 0,
    "byok_usage_weekly": 0,
    "byok_usage_monthly": 0,
    "created_at": "2025-08-24T10:30:00Z",
    "updated_at": null
  },
  "key": "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"
}

    """
    if response.status_code != 200:
        raise Exception(f"❌ Failed to create API key: {response.status_code} - {response.text}")

    data = response.json()
    print("✅ API key created successfully!")
    print("Label:", data["data"]["label"])
    print("Daily limit:", data["data"]["limit"])
    print("Limit reset:", data["data"]["limit_reset"])
    print("Key hash:", data["data"].get("hash"))
    print("Key ID:", data["data"]["id"])  # You'll need this to check status later

    return data["data"]["id"]

def check_key_usage(key_id: str):
    """
    Retrieves key details to check remaining credits and usage.
    """
    url = f"{BASE_URL}/{key_id}"
    print(key_id)
    headers = {"Authorization": f"Bearer {PROVISIONING_API_KEY}"}

    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        raise Exception(f"❌ Failed to fetch key info: {response.status_code} - {response.text}")

    data = response.json()["data"]

    print("\n📊 Key Usage Info:")
    print("Label:", data["label"])
    print("Limit:", data["limit"])
    print("Remaining:", data["limit_remaining"])
    print("Usage Today:", data["usage_daily"])
    print("Resets:", data["limit_reset"])
    print("Include BYOK in Limit:", data["include_byok_in_limit"])
    print("Disabled:", data.get("disabled", False))

    return data

if __name__ == "__main__":
    # Step 1: Create key
    # key_id = create_openrouter_key("Daily Key Test", daily_limit=0.3)

    # Step 2: Check usage for that key
    check_key_usage("14f2995f858c3b8632a68d240a516c2d5451414afec45b2b1922d9cc9f22b66d")


``` 
This is the example code of get api key 

```python
import requests
# /api/v1/keys/:hash
url = "https://openrouter.ai/api/v1/keys/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"

headers = {"Authorization": "Bearer <token>"}

response = requests.get(url, headers=headers)

"""
example response 

{
  "data": {
    "hash": "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",
    "name": "My Production Key",
    "label": "Production API Key",
    "disabled": false,
    "limit": 100,
    "limit_remaining": 74.5,
    "limit_reset": "monthly",
    "include_byok_in_limit": false,
    "usage": 25.5,
    "usage_daily": 25.5,
    "usage_weekly": 25.5,
    "usage_monthly": 25.5,
    "byok_usage": 17.38,
    "byok_usage_daily": 17.38,
    "byok_usage_weekly": 17.38,
    "byok_usage_monthly": 17.38,
    "created_at": "2025-08-24T10:30:00Z",
    "updated_at": "2025-08-24T15:45:00Z"
  }
}

"""

print(response.json())
```
This is the example code of delete api key 

```python
import requests
 # /api/v1/keys/:hash
url = "https://openrouter.ai/api/v1/keys/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"

headers = {"Authorization": "Bearer <token>"}

response = requests.delete(url, headers=headers)
"""
example response 
{
  "deleted": true
}
"""

print(response.json())

```

This is the example of auth token verification 

```go 
package auth

import (
	"context"
	"fmt"
	"github.com/golang-jwt/jwt/v4"
	"net/http"
	"os"
	"strings"
)

// UserClaims extends jwt.StandardClaims to include user information
type UserClaims struct {
	jwt.StandardClaims
	// Add additional fields that match your JWT payload
	UserID   string `json:"uid,omitempty"`
	Email    string `json:"email,omitempty"`
	UserName string `json:"username,omitempty"`
	// Add any other user info fields you need
}

// ValidateWebSocketToken validates JWT token from Sec-WebSocket-Protocol header
func ValidateWebSocketToken(token string) (*UserClaims, error) {
	if token == "" {
		return nil, fmt.Errorf("token is empty")
	}

	// Get JWT secret

	jwtSecret := os.Getenv("JWT_SECRET_CLOUD")
	if jwtSecret == "" {
		return nil, fmt.Errorf("JWT secret not configured")
	}

	// Parse and validate the token
	parsedToken, err := jwt.ParseWithClaims(token, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
		// Validate signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(jwtSecret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("token validation failed: %v", err)
	}

	// Extract and validate claims
	if claims, ok := parsedToken.Claims.(*UserClaims); ok && parsedToken.Valid {
		if claims.UserID == "" {
			return nil, fmt.Errorf("user ID is empty in token")
		}
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token claims")
}

// VerifyToken middleware checks for a valid JWT token
func VerifyToken(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get the Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Authorization header missing", http.StatusForbidden)
			return
		}

		// Split the token from the "Bearer " prefix
		splitToken := strings.Split(authHeader, "Bearer ")
		if len(splitToken) != 2 {
			http.Error(w, "Token missing from authorization header", http.StatusForbidden)
			return
		}

		tokenString := splitToken[1]

		// Get JWT secret from environment variable
		// jwtSecret := os.Getenv("JWT_SECRET")
		jwtSecret := os.Getenv("JWT_SECRET_CLOUD")
		if jwtSecret == "" {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			fmt.Println("JWT_SECRET environment variable not set")
			return
		}

		// Parse and validate the token
		token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
			// Validate signing method
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(jwtSecret), nil
		})

		if err != nil {
			errMsg := "Unauthorized"
			if err.Error() == "token is expired" {
				errMsg = "Token expired"
			}
			http.Error(w, errMsg, http.StatusUnauthorized)
			return
		}

		// Extract user info and add to request context
		// In VerifyToken middleware
		if claims, ok := token.Claims.(*UserClaims); ok && token.Valid {
			fmt.Printf("JWT claims: %+v\n", claims)
			// Check if UserID is empty
			if claims.UserID == "" {
				fmt.Println("WARNING: UserID is empty in the JWT token")
			}

			ctx := r.Context()
			ctx = context.WithValue(ctx, "userinfo", claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		} else {
			http.Error(w, "Invalid token claims", http.StatusUnauthorized)
		}
	})
}

```

Now I want to make a backend service based on this with Cloudflare D1 and deployed it on cloudflared worker 

This is the db schema 

```json
{ 

    user-id: string 
    user-name:string 
    email: string 
    key: string 
    hash: string 
    total-limit: number
    remaining-limit: number
    usage-limit: number 

}
```

Now I will describe the flow and logic 

New user: 

For the first time user request to create new api key with limit= 1 then verify auth with auth token , from this auth exec user info 

Then store user infor in db , from the response of api key collect key and hash store this in db schema as a key and hash . for the new user total-limit and remaining-limit will be equal to 10 and usage limit equal to 1 

for the new user delete api key ang get api key dont call 


existing user : 

first check user db based on user_id and check remaining-limit if its less then or equal 0.1 then delete user schema and create new user like New user step 

For the existing user first collect hash from db based on user-id from auth 

Then call with this hash call openrouter get api key check the limit_remaining from response , if limit_remaining greater then 0.5 Then return to user api-key from D1 db and update user schema remaining-limit --> like this math operation (remaining-limit -(usage-limit - limit_remaining ))  also update usage-limit = limit_remaining and skip delete api key operation 


if limit_remaining less then 0.5 then need to update  remaining-limit --> like this math operation (remaining-limit -(usage- limit_remaining))  Then call collect hash from user db schema based on user-id then call delete api key using this hash after get true from response after this then create new api key with limit = 1 after get response then again update user db with key hash and set usage-limit = 1 