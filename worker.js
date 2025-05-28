importScripts(
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js"
);

self.onmessage = async function (e) {
  const { action, fileData, folderName, password, token, owner, repo, branch } = e.data;

  if (action === "ZipEncryptAndUpload") {
    await ZipEncryptUpload(fileData, folderName, password, token, owner, repo, branch);
}  
};
    // console.log("ZipEncryptAndUpload process completed.");
//   }
// };

// async function processFilesAndUpload(fileList, folderName, password, token, owner, repo, branch) {
//     const zip = new JSZip();

//     for (let fileData of fileList) {
//         const { name, chunks } = fileData;
//         const fileFolder = zip.folder(folderName);

//         for (let { chunk, index } of chunks) {
//         const chunkName = chunks.length > 1 ? `${name}.part${index}` : name;
//         fileFolder.file(chunkName, chunk);
//         }
//     }

//     console.log("Generating ZIP...");
//     const zipArrayBuffer = await zip.generateAsync({ type: "arraybuffer" });

//     console.log("Encrypting and Uploading...");
//     await encryptAndUpload(zipArrayBuffer, password, folderName, token, owner, repo, branch);
//     }

async function ZipEncryptUpload(
  fileData, 
  folderName,
  password,
  token,
  owner,
  repo,
  branch
) {
    const { name, chunks, zipIndex } = fileData;
    const formattedZipIndex = String(zipIndex).padStart(5, "0");
    const zip = new JSZip();
    const fileFolder = zip.folder(folderName);
  
    for (let { chunk, index } of chunks) {
      const chunkName = chunks.length > 1 ? `${name}.part${index}` : name;
      fileFolder.file(chunkName, chunk);
    }
  
    console.log(`Generating ZIP part ${formattedZipIndex}...`);
    const zipArrayBuffer = await zip.generateAsync({ type: "arraybuffer" });

  try {
    // console.log("Generating IV...");
    const iv = crypto.getRandomValues(new Uint8Array(16));

    // console.log("Hashing password...");
    const key = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(password)
    );

    // console.log("Importing crypto key...");
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "AES-CTR" },
      false,
      ["encrypt"]
    );

    // console.log("Converting zipArrayBuffer to Uint8Array...");
    const zipData = new Uint8Array(zipArrayBuffer);

    // console.log("Encrypting data...");
    const encryptedData = await crypto.subtle.encrypt(
      { name: "AES-CTR", counter: iv, length: 128 },
      cryptoKey,
      zipData
    );

    // console.log("Combining IV and encrypted data...");
    const combinedData = new Uint8Array(iv.length + encryptedData.byteLength);
    combinedData.set(iv, 0);
    combinedData.set(new Uint8Array(encryptedData), iv.length);

    // console.log("Creating Blob...");
    const blob = new Blob([combinedData], { type: "application/octet-stream" });

    console.log("Reading Blob as Base64...");
    const reader = new FileReader();
    reader.onloadend = async function () {
      const base64CombinedData = reader.result.split(",")[1];
    //   console.log("Base64 data ready, starting upload...");

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
        //   } else if (response.status === 422) {
        //     console.log(
        //       `Part ${formattedZipIndex} already exists. Skipping...`
        //     );
        //     self.postMessage({
        //       status: "complete",
        //       folderName,
        //       zipIndex: formattedZipIndex,
        //     });
        //     break;
          } else {
            const errorData = await response.json();
            console.warn(`Upload failed:`, errorData);
            console.log(`Retrying upload for ${path}, attempt ${attempts + 1} times`);
            attempts++;
            // await delay(1000 * Math.pow(2, attempts)); // Exponential backoff
            await delay(1000);
          }
        } catch (error) {
          console.warn(`Error uploading ${path}:`, error);
          console.log(`Retrying upload for ${path}, attempt ${attempts + 1} times`);
          attempts++;
        //   await delay(1000 * Math.pow(2, attempts)); // Exponential backoff
          await delay(1000);
        }
      }
    };
    reader.readAsDataURL(blob);
  } catch (error) {
    console.error("Error generating ZIP:", error);
  }
}
