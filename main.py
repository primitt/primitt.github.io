from flask import Flask, render_template, send_from_directory, jsonify
from db.db import Projects, Blogs
import requests
import base64
import os
from dotenv import load_dotenv
import time

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'default_secret_key')

SPOTIFY_CLIENT_ID = os.getenv('SPOTIFY_CLIENT_ID')
SPOTIFY_CLIENT_SECRET = os.getenv('SPOTIFY_CLIENT_SECRET')
SPOTIFY_REFRESH_TOKEN = os.getenv('SPOTIFY_REFRESH_TOKEN')

spotify_access_token = None
token_expires_at = None

def refresh_spotify_token():
    global spotify_access_token, token_expires_at
    
    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET or not SPOTIFY_REFRESH_TOKEN:
        return None
    
    try:
        client_credentials = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
        encoded_credentials = base64.b64encode(client_credentials.encode()).decode()
        
        headers = {
            'Authorization': f'Basic {encoded_credentials}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        data = {
            'grant_type': 'refresh_token',
            'refresh_token': SPOTIFY_REFRESH_TOKEN
        }
        
        response = requests.post('https://accounts.spotify.com/api/token', headers=headers, data=data)
        
        if response.status_code == 200:
            token_data = response.json()
            spotify_access_token = token_data['access_token']
            expires_in = token_data.get('expires_in', 3600)
            token_expires_at = time.time() + expires_in
            return spotify_access_token
        else:
            print(f"Failed to refresh Spotify token: {response.status_code}")
            return None
    except Exception as e:
        print(f"Error refreshing Spotify token: {e}")
        return None


def get_spotify_access_token():
    global spotify_access_token, token_expires_at
    
    if not spotify_access_token or time.time() >= token_expires_at - 300: 
        return refresh_spotify_token()
    
    return spotify_access_token


def get_current_playing():
    access_token = get_spotify_access_token()
    
    if not access_token:
        return None
    
    try:
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        
        response = requests.get('https://api.spotify.com/v1/me/player/currently-playing', headers=headers)
        
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 204:
            # No content - nothing is playing
            return {"is_playing": False}
        else:
            print(f"Spotify API error: {response.status_code}")
            return None
    except Exception as e:
        print(f"Error getting current playing track: {e}")
        return None


@app.route("/api/spotify/current-track")
def spotify_current_track():
    try:
        current_track = get_current_playing()
        
        return jsonify(current_track)
    
    except Exception as e:
        print(f"Error in spotify endpoint: {e}")
        return jsonify({"error": "Failed to get current track"}), 500


@app.route("/")
def index():
    projects = Projects.select()
    projects = sorted(projects, key=lambda x: int(x.date.split("-")[0]), reverse=True)
    blogs = Blogs.select()
    return render_template('index.html', projects=projects, blogs=blogs)

@app.route('/images/<name>')
def images(name):
    return send_from_directory('templates/images', name)
@app.route('/scripts/<name>')
def scripts(name):
    return send_from_directory('scripts', name)

if __name__ == "__main__":
    app.run(debug=True)