from flask import Flask, render_template, send_file, send_from_directory, jsonify, redirect
from db.db import Photography, Projects, Blogs
from PIL import Image, ImageOps
from functools import lru_cache
import bleach
import markdown2
import requests
import base64
from io import BytesIO
import os
from dotenv import load_dotenv
import time
import warnings

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'default_secret_key')

SPOTIFY_CLIENT_ID = os.getenv('SPOTIFY_CLIENT_ID')
SPOTIFY_CLIENT_SECRET = os.getenv('SPOTIFY_CLIENT_SECRET')
SPOTIFY_REFRESH_TOKEN = os.getenv('SPOTIFY_REFRESH_TOKEN')

spotify_access_token = None
token_expires_at = None
THUMBNAIL_MAX_BYTES = 25 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 25_000_000
ALLOWED_BLOG_TAGS = set(bleach.sanitizer.ALLOWED_TAGS) | {
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'p', 'pre', 'code', 'table',
    'thead', 'tbody', 'tr', 'th', 'td', 'img', 'br', 'blockquote',
}
ALLOWED_BLOG_ATTRIBUTES = {
    '*': ['class'],
    'a': ['href', 'title'],
    'img': ['src', 'alt', 'title'],
}

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
    photos = Photography.select().order_by(Photography.id.desc()).limit(4)
    return render_template('index.html', projects=projects, blogs=blogs, photos=photos)

@app.route('/images/<name>')
def images(name):
    return send_from_directory('templates/images', name)
@app.route('/scripts/<name>')
def scripts(name):
    return send_from_directory('scripts', name)

@app.route('/blog/<int:blog_id>')
def blog_detail(blog_id):
    blog = Blogs.get_or_none(Blogs.id == blog_id)
    if not blog:
        return "Blog not found", 404
    blog.content = bleach.clean(
        markdown2.markdown(blog.content, extras=["fenced-code-blocks", "footnotes", "strike", "tables"]) if blog.content else "",
        tags=ALLOWED_BLOG_TAGS,
        attributes=ALLOWED_BLOG_ATTRIBUTES,
        protocols=['http', 'https', 'mailto'],
    )
    return render_template('blogs.html', blog=blog)

@app.route('/blog')
def red_blogs():
    return redirect('/')

@app.route('/photography')
def photography():
    photos = Photography.select().order_by(Photography.series, Photography.id)
    return render_template('photography.html', photos=photos, selected_photo=None)

@app.route('/photography/images/<name>')
def photography_image(name):
    return send_from_directory('images', name)

@app.route('/photography/thumbnails/<name>')
def photography_thumbnail(name):
    image_path = os.path.join(app.root_path, 'images', os.path.basename(name))
    if not os.path.isfile(image_path) or os.path.getsize(image_path) > THUMBNAIL_MAX_BYTES:
        return "Photograph not found", 404

    try:
        thumbnail = build_thumbnail(image_path, os.path.getmtime(image_path))
    except (Image.DecompressionBombError, OSError):
        return "Photograph not found", 404

    return send_file(BytesIO(thumbnail), mimetype='image/jpeg', max_age=86400)

@lru_cache(maxsize=64)
def build_thumbnail(image_path, modified_at):
    with warnings.catch_warnings():
        warnings.simplefilter('error', Image.DecompressionBombWarning)
        with Image.open(image_path) as image:
            image = ImageOps.exif_transpose(image).convert('RGB')
            image.thumbnail((640, 640))
            output = BytesIO()
            image.save(output, 'JPEG', quality=60, optimize=True)
            return output.getvalue()
@app.route("/resume")
def resume():
    return send_file("scripts/resume.pdf", mimetype="application/pdf")
if __name__ == "__main__":
    app.run(host="0.0.0.0", port="5001")
