importScripts(
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js"
);

self.onmessage = async function (e) {
  const {
    action,
    folderName,
    zip,
    zipIndex,
    password,
    token,
    owner,
    repo,
    branch,
  } = e.data;

  console.log("Received message:", { action, folderName, zipIndex });

//   if (action === "ZipEncrypt") {
//     console.log("Starting ZipEncrypt process...");
//     await processZip(zip, password, zipIndex, folderName);
//     console.log("ZipEncrypt process completed.");
//   } else 
  if (action === "ZipEncryptAndUpload") {
    console.log("Starting ZipEncryptAndUpload process...");
    await processZipAndUpload(
      zip,
      password,
      zipIndex,
      folderName,
      token,
      owner,
      repo,
      branch
    );
    console.log("ZipEncryptAndUpload process completed.");
  }
};

// async function processZip(zipArrayBuffer, password, zipIndex, folderName) {
//   const formattedZipIndex = String(zipIndex).padStart(5, "0");
//   console.log("Processing ZIP with index:", formattedZipIndex);

//   try {
//     console.log("Generating IV...");
//     const iv = crypto.getRandomValues(new Uint8Array(16));

//     console.log("Hashing password...");
//     const key = await crypto.subtle.digest(
//       "SHA-256",
//       new TextEncoder().encode(password)
//     );

//     console.log("Importing crypto key...");
//     const cryptoKey = await crypto.subtle.importKey(
//       "raw",
//       key,
//       { name: "AES-CTR" },
//       false,
//       ["encrypt"]
//     );

//     console.log("Converting zipArrayBuffer to Uint8Array...");
//     const zipData = new Uint8Array(zipArrayBuffer);

//     console.log("Encrypting data...");
//     const encryptedData = await crypto.subtle.encrypt(
//       { name: "AES-CTR", counter: iv, length: 128 },
//       cryptoKey,
//       zipData
//     );

//     console.log("Combining IV and encrypted data...");
//     const combinedData = new Uint8Array(iv.length + encryptedData.byteLength);
//     combinedData.set(iv, 0);
//     combinedData.set(new Uint8Array(encryptedData), iv.length);

//     console.log("Creating Blob...");
//     const blob = new Blob([combinedData], { type: "application/octet-stream" });

//     console.log("Reading Blob as Base64...");
//     const reader = new FileReader();
//     reader.onloadend = function () {
//       const base64CombinedData = reader.result.split(",")[1];
//       console.log("Base64 data ready, posting message...");
//       self.postMessage({
//         status: "upload",
//         folderName,
//         zipIndex: formattedZipIndex,
//         base64CombinedData,
//       });
//     };
//     reader.readAsDataURL(blob);
//   } catch (error) {
//     console.error("Error generating ZIP:", error);
//   }
// }

async function processZipAndUpload(
  zipArrayBuffer,
  password,
  zipIndex,
  folderName,
  token,
  owner,
  repo,
  branch
) {
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
    reader.onloadend = async function () {
      const base64CombinedData = reader.result.split(",")[1];
      console.log("Base64 data ready, starting upload...");

      const path = `Books/${folderName}/${folderName}_part${formattedZipIndex}.zip`;
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      const fileData = {
        message: `Upload encrypted folder part ${formattedZipIndex}`,
        content: base64CombinedData,
        branch: branch,
      };

      let attempts = 0;
      const delay = (ms) => new Promise((res) => setTimeout(res, ms));

      while (true) {
        try {
          const response = await fetch(url, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(fileData),
          });

          if (response.ok) {
            console.log(`Uploaded ${path} successfully.`);
            self.postMessage({
              status: "complete",
              folderName,
              zipIndex: formattedZipIndex,
            });
            break;
          } else if (response.status === 422) {
            console.log(
              `Part ${formattedZipIndex} already exists. Skipping...`
            );
            self.postMessage({
              status: "complete",
              folderName,
              zipIndex: formattedZipIndex,
            });
            break;
          } else {
            const errorData = await response.json();
            console.error(`Upload failed:`, errorData);
            console.log(`Retrying upload for ${path}, attempt ${attempts + 1}`);
            attempts++;
            await delay(1000 * Math.pow(2, attempts)); // Exponential backoff
          }
        } catch (error) {
          console.error(`Error uploading ${path}:`, error);
          console.log(`Retrying upload for ${path}, attempt ${attempts + 1}`);
          attempts++;
          await delay(1000 * Math.pow(2, attempts)); // Exponential backoff
        }
      }
    };
    reader.readAsDataURL(blob);
  } catch (error) {
    console.error("Error generating ZIP:", error);
  }
}
