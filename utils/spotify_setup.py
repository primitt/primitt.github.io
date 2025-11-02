import requests
import base64
from urllib.parse import urlencode
import webbrowser
import dotenv
import os
dotenv.load_dotenv()

CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
REDIRECT_URI = "http://localhost:5000/callback"

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

if __name__ == "__main__":
    print(get_auth_url())
    
    auth_code = input("\nEnter the authorization code: ")
    tokens = get_tokens(auth_code)
    
    print(f"SPOTIFY_REFRESH_TOKEN={tokens.get('refresh_token')}")
