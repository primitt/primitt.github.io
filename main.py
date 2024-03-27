from flask import Flask, render_template, send_from_directory

app = Flask(__name__)
maintainance = False

@app.route("/")
def index():
    if maintainance:
        return render_template('construction.html')
    else:
        return render_template('index.html')
@app.route('/images/<name>')
def images(name):
    return send_from_directory('templates/images', name)
@app.route('/scripts/<name>')
def scripts(name):
    return send_from_directory('scripts', name)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5003, debug=True)