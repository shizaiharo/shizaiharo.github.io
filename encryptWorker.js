importScripts(
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js"
);

self.onmessage = async function (e) {
  const { files, password, folderName, zipIndex, token, owner, repo, branch } =
    e.data;
  console.log("Received message in worker:", e.data); // Debugging statement

  if (!files) {
    console.error("Files are undefined in worker");
    self.postMessage({
      success: false,
      zipIndex,
      error: "Files are undefined",
    });
    return;
  }

  try {
    const zip = new JSZip();
    files.forEach((file) => {
      console.log("Processing file in worker:", file); // Debugging statement
      zip.file(file.webkitRelativePath || file.name, file.data, {
        binary: true,
      });
    });

    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "STORE",
      compressionOptions: { level: 0 },
    });

    const iv = crypto.getRandomValues(new Uint8Array(16));

    // Derive key from password
    const keyBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(password)
    );
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-CTR" },
      false,
      ["encrypt"]
    );

    // Read file into ArrayBuffer
    const fileBuffer = await zipBlob.arrayBuffer();

    // Encrypt file
    const encryptedData = await crypto.subtle.encrypt(
      { name: "AES-CTR", counter: iv, length: 128 },
      cryptoKey,
      fileBuffer
    );

    // Combine IV and encrypted data
    const combinedData = new Uint8Array(iv.length + encryptedData.byteLength);
    combinedData.set(iv, 0);
    combinedData.set(new Uint8Array(encryptedData), iv.length);

    // Convert to Base64 for upload
    let binary = "";
    const len = combinedData.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(combinedData[i]);
    }
    const base64Data = btoa(binary);

    // Upload to GitHub
    const formattedZipIndex = String(zipIndex).padStart(5, "0");
    const path = `Books/${folderName}/${folderName}_part${formattedZipIndex}.zip`;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/octet-stream",
      },
      body: JSON.stringify({
        message: `Upload encrypted part ${formattedZipIndex}`,
        content: base64Data,
        branch: branch,
      }),
    });

    if (response.ok) {
      console.log(`Upload successful: ${path}`);
      self.postMessage({
        success: true,
        zipIndex,
      });
    } else {
      console.error(`Upload failed: ${path}`);
      self.postMessage({
        success: false,
        zipIndex,
        error: `Upload failed: ${response.statusText}`,
      });
    }
  } catch (error) {
    console.error("Error in worker:", error); // Debugging statement
    self.postMessage({
      success: false,
      zipIndex,
      error: error.message,
    });
  }
};
