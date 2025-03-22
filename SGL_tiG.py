import os
os.environ['TK_SILENCE_DEPRECATION'] = '1'

import sys
import zipfile
import base64
import subprocess
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from hashlib import sha256
import requests
import re
import platform

import tkinter as tk
from tkinter import filedialog

def is_token_valid(token):
    headers = {"Authorization": f"token {token}"}
    response = requests.get("https://api.github.com/user", headers=headers)
    return response.status_code == 200

def get_valid_token():
    while True:
        token = input("Enter your GitHub token: ")
        if is_token_valid(token):
            print("✅ Token is valid.")
            return token
        else:
            print("❌ Invalid token. Please try again.")

# Git Configuration
token = get_valid_token()
REPO_URL = f"https://{token}@github.com/shizaiharo/shizaiharo.github.io.git"
BRANCH = "main"
MAX_ZIP_SIZE = 87 * 1024 * 1024  # 87 MiB

def combine(str1, str2):
    combined = []
    max_len = max(len(str1), len(str2))
    for i in range(max_len):
        combined.append(str1[i] if i < len(str1) else "!")
        combined.append(str2[i] if i < len(str2) else "")
    return "".join(combined)

def zip_files(files, output_path):
    """Create a ZIP archive from a list of files."""
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_STORED) as zipf:
        for file in files:
            zipf.write(file, os.path.relpath(file, os.path.dirname(files[0])))
    return output_path

def encrypt_file(input_path, output_path, password):
    """Encrypt a file using AES-CTR."""
    with open(input_path, "rb") as f:
        data = f.read()

    iv = os.urandom(16)
    key = sha256(password.encode()).digest()
    
    cipher = Cipher(algorithms.AES(key), modes.CTR(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    encrypted_data = encryptor.update(data) + encryptor.finalize()

    with open(output_path, "wb") as f:
        f.write(iv + encrypted_data)

    return output_path

def git_push(commit_message):
    try:
        subprocess.run(["git", "init"], check=True)
        # Check if the remote 'origin' already exists
        result = subprocess.run(["git", "remote", "get-url", "origin"], capture_output=True, text=True)
        if result.returncode != 0:
            subprocess.run(["git", "remote", "add", "origin", REPO_URL], check=True)
        # Check if the branch already exists
        result = subprocess.run(["git", "rev-parse", "--verify", BRANCH], capture_output=True, text=True)
        if result.returncode != 0:
            subprocess.run(["git", "checkout", "-b", BRANCH], check=True)
        else:
            subprocess.run(["git", "checkout", BRANCH], check=True)
        subprocess.run(["git", "add", "."], check=True)
        subprocess.run(["git", "commit", "-m", commit_message], check=True)
        subprocess.run(["git", "push", "--set-upstream", "origin", BRANCH], check=True)
        print("✅ Git push successful!")
    except subprocess.CalledProcessError as e:
        print(f"❌ Git push failed: {e}")

def process_folder(folder_path):
    """Process folder: zip, encrypt, and push to Git."""
    # print("stop here")
    files = [os.path.join(root, f) for root, _, files in os.walk(folder_path) for f in files]
    files.sort(key=lambda f: [int(n) if n.isdigit() else n for n in os.path.basename(f).split()])

    zip_index = 1
    current_zip_size = 0
    zip_files_list = []
    repo_books_path = os.path.join(folder_path, "Books", os.path.basename(folder_path))
    os.makedirs(repo_books_path, exist_ok=True)

    for file in files:
        file_size = os.path.getsize(file)
        if current_zip_size + file_size > MAX_ZIP_SIZE:
            zip_path = os.path.join(repo_books_path, f"part{zip_index:05d}.zip")
            zip_files(zip_files_list, zip_path)
            encrypt_path = zip_path + ".enc"
            password = combine("Kyaru", os.path.basename(folder_path))
            encrypt_file(zip_path, encrypt_path, password)
            os.remove(zip_path)
            zip_files_list.clear()
            current_zip_size = 0
            zip_index += 1

        zip_files_list.append(file)
        current_zip_size += file_size

    if zip_files_list:
        zip_path = os.path.join(repo_books_path, f"part{zip_index:05d}.zip")
        zip_files(zip_files_list, zip_path)
        encrypt_path = zip_path + ".enc"
        password = combine("Kyaru", os.path.basename(folder_path))
        encrypt_file(zip_path, encrypt_path, password)
        os.remove(zip_path)

    # Commit & push changes
    git_push(f"Upload files for {os.path.basename(folder_path)}")

def select_folder():
    root = tk.Tk()
    root.withdraw()  # Hide the main window

    # Suppress stderr output (Mac-specific issue)
    devnull = open(os.devnull, 'w')
    old_stderr = sys.stderr
    sys.stderr = devnull

    try:
        folder_selected = filedialog.askdirectory()  # Open folder selection dialog
    finally:
        sys.stderr = old_stderr  # Restore stderr
        devnull.close()

    return folder_selected

def check_number_in_bracket_in_folder_name(folder_path):
    folder_name = os.path.basename(folder_path)
    match = re.search(r'\[(\d+)\]', folder_name)
    if match:
        number = match.group(1)
        print(f"Number found in brackets: {number}")
    else:
        number = input("No number found in brackets. Please add a number by yourself: ")

    number_in_bracket = f"[{number}]"
    folder_path_with_number = folder_path + " " + number_in_bracket
    print(f"Folder path with number: {folder_path_with_number}")
    return folder_path_with_number

process_folder(check_number_in_bracket_in_folder_name(select_folder()))
