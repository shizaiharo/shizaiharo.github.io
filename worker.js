importScripts(
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js"
);

self.onmessage = async function (e) {
  const { action, folderName, zip, zipIndex, password } = e.data;

  console.log("Received message:", { action, folderName, zipIndex });

  if (action === "ZipEncrypt") {
    console.log("Starting ZipEncrypt process...");
    await processZip(zip, password, zipIndex, folderName);
    console.log("ZipEncrypt process completed.");
  }
};

async function processZip(zipArrayBuffer, password, zipIndex, folderName) {
  const formattedZipIndex = String(zipIndex).padStart(5, "0");
  console.log("Processing ZIP with index:", formattedZipIndex);

  try {
    console.log("Generating IV...");
    const iv = crypto.getRandomValues(new Uint8Array(16));

    console.log("Hashing password...");
    const key = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(password)
    );

    console.log("Importing crypto key...");
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "AES-CTR" },
      false,
      ["encrypt"]
    );

    console.log("Converting zipArrayBuffer to Uint8Array...");
    const zipData = new Uint8Array(zipArrayBuffer);

    console.log("Encrypting data...");
    const encryptedData = await crypto.subtle.encrypt(
      { name: "AES-CTR", counter: iv, length: 128 },
      cryptoKey,
      zipData
    );

    console.log("Combining IV and encrypted data...");
    const combinedData = new Uint8Array(iv.length + encryptedData.byteLength);
    combinedData.set(iv, 0);
    combinedData.set(new Uint8Array(encryptedData), iv.length);

    console.log("Creating Blob...");
    const blob = new Blob([combinedData], { type: "application/octet-stream" });

    console.log("Reading Blob as Base64...");
    const reader = new FileReader();
    reader.onloadend = function () {
      const base64CombinedData = reader.result.split(",")[1];
      console.log("Base64 data ready, posting message...");
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
