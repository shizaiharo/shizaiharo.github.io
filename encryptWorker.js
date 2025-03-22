importScripts(
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js"
);

self.onmessage = async function (e) {
  const { file, password, folderName, zipIndex } = e.data;

  try {
    const zip = new JSZip();
    zip.file(file.webkitRelativePath || file.name, file);

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
    const base64Data = btoa(String.fromCharCode(...combinedData));

    // Send encrypted data back to main thread
    self.postMessage({
      success: true,
      folderName,
      zipIndex,
      base64Data,
    });
  } catch (error) {
    self.postMessage({
      success: false,
      folderName,
      zipIndex,
      error: error.message,
    });
  }
};
