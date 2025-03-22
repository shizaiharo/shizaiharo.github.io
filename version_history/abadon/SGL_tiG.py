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
import shutil
import json

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
REPO = "Amrita"
OWNER = "shizaiharo"
BRANCH = "main"
MAX_ZIP_SIZE = 87 * 1024 * 1024  # 87 MiB
target_repo = "Amrita"

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

def encrypt_file(input_path, password):
    """Encrypt a file using AES-CTR and keep the .zip extension."""
    with open(input_path, "rb") as f:
        data = f.read()

    iv = os.urandom(16)
    key = sha256(password.encode()).digest()
    
    cipher = Cipher(algorithms.AES(key), modes.CTR(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    encrypted_data = encryptor.update(data) + encryptor.finalize()

    with open(input_path, "wb") as f:
        f.write(iv + encrypted_data)

    print(f"Encrypted zip size: {os.path.getsize(input_path)} bytes")  # Print the size of the encrypted zip file
    return input_path


def upload_to_github(file_path, repo_path):
    """Upload a file to GitHub."""
    url = f"https://api.github.com/repos/{OWNER}/{REPO}/contents/{repo_path}"
    with open(file_path, "rb") as f:
        content = base64.b64encode(f.read()).decode('utf-8')

    payload = {
        "message": f"Upload {repo_path}",
        "content": content,
        "branch": BRANCH
    }

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/octet-stream"
    }

    # Check if the file already exists
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        sha = response.json()["sha"]
        payload["sha"] = sha

    response = requests.put(url, headers=headers, data=json.dumps(payload))
    print(f"Uploading {repo_path}")
    if not response.ok:
        print(f"Upload failed: {response.status_code}")
        print(response.json())  # Check the detailed error message
    
    return response.json()

def process_folder(folder_path, number_in_bracket):
    """Process folder: zip, encrypt, and push to Git."""
    folder_name = os.path.basename(folder_path)
    folder_name_with_number = folder_name + " " + number_in_bracket
    print(f"Folder name with number: {folder_name_with_number}")
    files = [os.path.join(root, f) for root, _, files in os.walk(folder_path) for f in files]
    files.sort(key=lambda f: [int(n) if n.isdigit() else n for n in os.path.basename(f).split()])

    zip_index = 1
    current_zip_size = 0
    zip_files_list = []
    repo_books_path = os.path.join("Books", folder_name_with_number)
    os.makedirs(repo_books_path, exist_ok=True)

    for file in files:
        file_size = os.path.getsize(file)
        if current_zip_size + file_size > MAX_ZIP_SIZE:
            zip_path = os.path.join(repo_books_path, f"{folder_name}_part{zip_index:05d}.zip")
            zip_files(zip_files_list, zip_path)
            password = combine("Kyaru", number_in_bracket)
            encrypt_file(zip_path, password)
            zip_files_list.clear()
            current_zip_size = 0
            zip_index += 1

            # Upload to GitHub
            upload_to_github(zip_path, f"Books/{folder_name_with_number}/{os.path.basename(zip_path)}")

        zip_files_list.append(file)
        current_zip_size += file_size

    if zip_files_list:
        zip_path = os.path.join(repo_books_path, f"{folder_name}_part{zip_index:05d}.zip")
        zip_files(zip_files_list, zip_path)
        password = combine("Kyaru", number_in_bracket)
        encrypt_file(zip_path, password)

        # Upload to GitHub
        upload_to_github(zip_path, f"Books/{folder_name_with_number}/{os.path.basename(zip_path)}")

    # Clean up
    shutil.rmtree(repo_books_path)  # Use shutil.rmtree to remove the directory and its contents

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
    return folder_path, number_in_bracket

folder_path, number_in_bracket = check_number_in_bracket_in_folder_name(select_folder())
process_folder(folder_path, number_in_bracket)
