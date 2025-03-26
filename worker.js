importScripts(
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js"
);

self.onmessage = async function (e) {
  const { action, folderName, zip, zipIndex, password } = e.data;

  if (action === "ZipEncrypt") {
    self.postMessage({ status: "complete", folderName, zipIndex });
  }
};

async function processZip(jszip, password, zipIndex, folderName) {
  const formattedZipIndex = String(zipIndex).padStart(5, "0");

  try {
    const zipBlob = await jszip.generateAsync({
      type: "blob",
      compression: "STORE",
    });
    const zipArrayBuffer = await zipBlob.arrayBuffer();

    const iv = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(password)
    );
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "AES-CTR" },
      false,
      ["encrypt"]
    );

    const encryptedData = await crypto.subtle.encrypt(
      { name: "AES-CTR", counter: iv, length: 128 },
      cryptoKey,
      zipArrayBuffer
    );

    const combinedData = new Uint8Array(iv.length + encryptedData.byteLength);
    combinedData.set(iv, 0);
    combinedData.set(new Uint8Array(encryptedData), iv.length);

    const blob = new Blob([combinedData], { type: "application/octet-stream" });
    const reader = new FileReader();
    reader.onloadend = function () {
    const base64CombinedData = reader.result.split(",")[1];
    self.postMessage({
        status: "upload",
        folderName,
        zipIndex: formattedZipIndex,
        base64CombinedData,
    });
    };
    reader.readAsDataURL(blob);

  } catch (error) {
    console.error("Error generating ZIP:", error);
  }
}

function bufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
