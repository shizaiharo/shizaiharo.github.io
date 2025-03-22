import os
import requests
import base64

# GitHub API URL for file uploads
GITHUB_API_URL = "https://api.github.com/repos/{owner}/{repo}/contents/{path}"

# Replace these variables with your details
GITHUB_TOKEN = input("Token: ")  # Personal Access Token
OWNER = "shizaiharo"
REPO = "Amrita"
FILE_PATH = "temp.txt"  # Temporary file for upload

def create_temp_file(size_mib):
    """Creates a temporary file of specified size in MiB"""
    with open(FILE_PATH, 'wb') as f:
        f.write(os.urandom(size_mib * 1048576))  # Random data to simulate file content

def upload_file_to_github(file_path, size_mib):
    """Uploads a file to GitHub repository"""
    url = GITHUB_API_URL.format(owner=OWNER, repo=REPO, path=file_path)
    
    headers = {
        'Authorization': f'Bearer {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json',
        "Content-Type": "application/octet-stream"
    }
    
    with open(FILE_PATH, 'rb') as f:
        content = base64.b64encode(f.read()).decode('utf-8')
    
    data = {
        "message": f"Upload test for {size_mib} MiB file",
        "content": content,
    }

    response = requests.put(url, headers=headers, json=data)
    
    if response.status_code == 201:
        print(f"File of size {size_mib} MiB uploaded successfully!")
        return True
    elif response.status_code == 422:
        print(f"{size_mib} MiB 422")
        return False
    else:
        print(f"Failed to upload {size_mib} MiB file: {response.status_code} {response.text}")
        return False

def test_max_file_size():
    size_mib = 100  # Start with 100 MiB file size
    while True:
        # print(f"Testing upload with {size_mib} MiB file...")
        create_temp_file(size_mib)  # Create a file of the specified size
        # absolute_path = os.path.abspath(FILE_PATH)
        # print(absolute_path)
        success = upload_file_to_github(FILE_PATH, size_mib)
        
        if not success:
            # print(f"Upload failed at {size_mib} MiB.")
            size_mib -= 1  # Decrease size by 1 MiB and retry
        else:
            # print(f"Upload successful at {size_mib} MiB.")
            print("end")
            break

if __name__ == "__main__":
    test_max_file_size()
