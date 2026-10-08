import cloudinary from "../../config/cloudinary.js";

export function uploadBufferToCloudinary(
  buffer,
  folder,
  resourceType = "auto",
) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      },
    );

    stream.end(buffer);
  });
}

export async function deleteFromCloudinary(publicId, resourceType = "image") {
  if (!publicId) return;

  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
  });
}