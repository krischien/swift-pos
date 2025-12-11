/**
 * Image Similarity Service
 * Provides functions to compare images using perceptual hashing
 */

/**
 * Calculate perceptual hash of an image
 * Returns a hash string that can be compared for similarity
 */
export async function calculateImageHash(imageSrc: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Resize to 8x8 for faster processing
      const size = 8;
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0, size, size);

      const imageData = ctx.getImageData(0, 0, size, size);
      const pixels = imageData.data;

      // Calculate average brightness
      let sum = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const brightness = (r + g + b) / 3;
        sum += brightness;
      }
      const avg = sum / (pixels.length / 4);

      // Generate hash: 1 if pixel is brighter than average, 0 otherwise
      let hash = "";
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const brightness = (r + g + b) / 3;
        hash += brightness > avg ? "1" : "0";
      }

      resolve(hash);
    };

    img.onerror = (error) => {
      reject(new Error("Failed to load image: " + error));
    };
    
    img.src = imageSrc;
  });
}

/**
 * Calculate Hamming distance between two hashes
 * Lower distance = more similar images
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    return Infinity;
  }
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }
  return distance;
}

/**
 * Compare uploaded image against product images
 * Returns products sorted by similarity (most similar first)
 */
export interface ImageMatch {
  productId: string;
  productName: string;
  similarity: number; // 0-100, higher = more similar
  image?: string;
}

export async function findSimilarProducts(
  uploadedImageSrc: string,
  products: Array<{ id: string; name: string; image?: string }>
): Promise<ImageMatch[]> {
  const uploadedHash = await calculateImageHash(uploadedImageSrc);
  
  const matches: ImageMatch[] = [];

  for (const product of products) {
    if (!product.image) continue;

    try {
      const productHash = await calculateImageHash(product.image);
      const distance = hammingDistance(uploadedHash, productHash);
      
      // Convert distance to similarity percentage
      // Max distance for 64-bit hash is 64
      // Similarity = (1 - distance/64) * 100
      const similarity = Math.max(0, (1 - distance / 64) * 100);
      
      // Only include matches with at least 50% similarity
      if (similarity >= 50) {
        matches.push({
          productId: product.id,
          productName: product.name,
          similarity: Math.round(similarity),
          image: product.image,
        });
      }
    } catch (error) {
      console.error(`Failed to process image for product ${product.name}:`, error);
    }
  }

  // Sort by similarity (highest first)
  matches.sort((a, b) => b.similarity - a.similarity);

  return matches;
}

