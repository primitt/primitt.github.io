from flask import Flask, render_template, send_from_directory
app = Flask(__name__)

@app.route("/")
def index():
    return render_template('indexnew.html')
    

@app.route('/images/<name>')
def images(name):
    return send_from_directory('templates/images', name)
@app.route('/scripts/<name>')
def scripts(name):
    return send_from_directory('scripts', name)

if __name__ == "__main__":
    app.run(debug=True)