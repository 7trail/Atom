

import { applyProxy } from '../constants';

interface ImageJob {
    prompt: string;
    width: number;
    height: number;
    num_steps: number;
    resolve: (value: string | null) => void;
    reject: (reason?: any) => void;
}

interface ImageGenerationOptions {
    width: number;
    height: number;
    prompt: string;
    model: string;
    seed: number;
    nologo: boolean;
    enhance: boolean;
}

let keyIndex3 = 0;
const imageQueue: ImageJob[] = [];
let isProcessingJob = false;

export function imageAPI() {
  let k = keyIndex3;
  let values = ["https://wisp-ai-images.anothersaiemail.workers.dev"]; //"https://wisp-ai-images-2.cassatb4ss.workers.dev/", 
  keyIndex3= (keyIndex3 + 1) % values.length;
  return values[k];
}

// Utility to generate Pollinations URL
const generatePollinationsImageUrl = (options: ImageGenerationOptions) => {
    const { prompt, width, height, seed, model, nologo, enhance } = options;
    const params = new URLSearchParams();
    params.append("width", width.toString());
    params.append("height", height.toString());
    params.append("seed", seed.toString());
    params.append("model", model || 'flux');
    if (nologo) params.append("nologo", "true");
    if (enhance) params.append("enhance", "true");
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}

const compressBase64 = async (base64Str: string): Promise<string> => {
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = "Anonymous";
            image.onload = () => resolve(image);
            image.onerror = (e) => reject(e);
            image.src = base64Str;
        });
        
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if(!ctx) throw new Error("No context");
        ctx.drawImage(img, 0, 0, img.width, img.height);
        // Compress to 0.6 quality
        return canvas.toDataURL('image/jpeg', 0.6);
    } catch (e) {
        console.warn("Compression failed, using original", e);
        return base64Str;
    }
}

// The internal function that performs the actual API call to the generation worker, with fallback.
async function _processImageGeneration(prompt: string, height: number, width: number, num_steps: number): Promise<string | null> {
  // --- Primary Service with Retry ---
  const MAX_PRIMARY_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_PRIMARY_ATTEMPTS; attempt++) {
    try {
      const originalUrl = imageAPI();
      const proxiedUrl = originalUrl;

      const response = await fetch(proxiedUrl, {
        method: "POST",
        headers: {
          "Authorization": "Bearer Th3_D3lt4r!ne",
        },
        body: JSON.stringify({ prompt, height, width, num_steps }),
      });

      if (response.ok) {
        let data = await response.text();
        if (data && typeof data === 'string') {
          if (data.startsWith('"')) {
            data = data.substring(1, data.length - 2);
          }
          // On success, return immediately.
          return `data:image/jpeg;base64,${data}`;
        } else {
          console.error(`Primary image generation API returned invalid data (Attempt ${attempt}):`, data);
          if (attempt === MAX_PRIMARY_ATTEMPTS) break; // Fall through on last attempt
          continue; // Go to next attempt
        }
      } else {
        const errorText = await response.text();
        
        // If the error contains "nsfw", break the loop immediately and go to the Pollinations fallback.
        if (errorText && errorText.toLowerCase().includes("nsfw")) {
          console.log("NSFW-related error detected. Switching to fallback service.");
          break;
        }

        // If it's any other error and it's the last attempt, break to fall through.
        if (attempt === MAX_PRIMARY_ATTEMPTS) {
          console.log("Max attempts for primary service reached. Switching to fallback.");
          break;
        }
        console.error(`Primary image generation API failed (Attempt ${attempt}) with status:`, response.status, errorText);
        console.log(`Retrying primary service...`);
      }
    } catch (error) {
      console.error(`Network or other error on primary image generation API (Attempt ${attempt}):`, error);
      if (attempt === MAX_PRIMARY_ATTEMPTS) {
        console.log("Max attempts for primary service reached after network error. Switching to fallback.");
        break;
      }
       console.log(`Retrying primary service after network error...`);
    }
  }

  // --- Fallback Service (Pollinations) ---
  console.log("Primary image generation failed or was flagged. Trying fallback service (Pollinations)...");
  try {
    const options: ImageGenerationOptions = {
      width,
      height,
      prompt,
      model: 'flux', // A good default model
      seed: Math.floor(Math.random() * 12000),
      nologo: true,
      enhance: true
    };

    const imageUrl = generatePollinationsImageUrl(options);
    
    // Per instructions, we don't fetch. We return the URL directly.
    return imageUrl;

  } catch (error) {
    console.error("Error with fallback image generation (Pollinations):", error);
    return null;
  }
}

const processQueue = async () => {
    if (imageQueue.length === 0 || isProcessingJob) {
        return;
    }

    isProcessingJob = true;
    const job = imageQueue.shift();

    if (job) {
        try {
            const result = await _processImageGeneration(job.prompt, job.height, job.width, job.num_steps);
            
            if (!result) {
                job.resolve(null);
            } else if (result.startsWith('data:image')) {
                // It's base64, compress and return
                const compressed = await compressBase64(result);
                job.resolve(compressed);
            } else {
                // It's a direct URL (from Pollinations), resolve directly
                job.resolve(result);
            }
        } catch (error) {
            console.error("Error processing image generation job from queue:", error);
            job.reject(error);
        } finally {
            isProcessingJob = false;
        }
    } else {
        isProcessingJob = false;
    }
};

// Start the queue processing interval once
setInterval(processQueue, 1000); // Begin the next job every 1 second

export const generateImage = async (prompt: string, purpose: string = "image", upload: boolean = false, width: number = 512, height: number = 512, num_steps: number = 10): Promise<string | null> => {
    return new Promise((resolve, reject) => {
        const job: ImageJob = { prompt, resolve, reject, width, height, num_steps };
        
        if (purpose === "post") {
            imageQueue.unshift(job); // Add to the front for higher priority
        } else {
            imageQueue.push(job); // Add to the back
        }
        
        // Immediately try to process the queue, in case it's empty and no job is running
        if (!isProcessingJob) {
            processQueue();
        }
    });
};