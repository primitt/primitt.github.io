import requests
import base64
from urllib.parse import urlencode, urlparse, parse_qs
import webbrowser
import dotenv
import os

ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
dotenv.load_dotenv(ENV_PATH)

CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
REDIRECT_URI = "http://127.0.0.1:5001/callback"

def get_auth_url():
    params = {
        'client_id': CLIENT_ID,
        'response_type': 'code',
        'redirect_uri': REDIRECT_URI,
        'scope': 'user-read-currently-playing user-read-playback-state',
        'show_dialog': 'true'
    }
    
    auth_url = f"https://accounts.spotify.com/authorize?{urlencode(params)}"
    return auth_url

def get_tokens(auth_code):
    client_credentials = f"{CLIENT_ID}:{CLIENT_SECRET}"
    encoded_credentials = base64.b64encode(client_credentials.encode()).decode()
    
    headers = {
        'Authorization': f'Basic {encoded_credentials}',
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    
    data = {
        'grant_type': 'authorization_code',
        'code': auth_code,
        'redirect_uri': REDIRECT_URI
    }
    
    response = requests.post('https://accounts.spotify.com/api/token', headers=headers, data=data)
    return response.json()

def extract_auth_code(pasted):
    pasted = pasted.strip()
    if pasted.startswith("http://") or pasted.startswith("https://"):
        query = parse_qs(urlparse(pasted).query)
        code = query.get('code', [None])[0]
        if not code:
            raise ValueError("No 'code' parameter found in the pasted URL.")
        return code
    return pasted

if __name__ == "__main__":
    print(get_auth_url())

    pasted = input("\nPaste the full redirect URL (or just the code): ")
    auth_code = extract_auth_code(pasted)
    tokens = get_tokens(auth_code)

    refresh_token = tokens.get('refresh_token')
    if not refresh_token:
        print(f"Failed to get refresh token. Response: {tokens}")
    else:
        dotenv.set_key(ENV_PATH, "SPOTIFY_REFRESH_TOKEN", refresh_token)
        print(f"Saved SPOTIFY_REFRESH_TOKEN to {ENV_PATH}")
