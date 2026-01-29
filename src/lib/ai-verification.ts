
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure PDF.js worker
// Using unpkg/cdnjs as fallback or trying to resolve local path for Vite
// For robustness in this environment, we'll try to use a CDN that matches the version if possible,
// or rely on the bundler to handle the worker.
// Note: In strict production setups, you'd want to host the worker file yourself.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.530/pdf.worker.min.mjs`;

// --- Configuration ---

const CONFIDENCE_THRESHOLD_IMAGE = 0.10; // Low threshold because "food" classes are fragmented
const CONFIDENCE_THRESHOLD_TEXT = 2; // Number of keywords found

const FOOD_KEYWORDS = [
  'food', 'dish', 'plate', 'platter', 'tray', 'bowl', 'cup', 'glass', 'bottle',
  'fruit', 'vegetable', 'meat', 'fish', 'poultry', 'bread', 'bakery', 'cake',
  'dessert', 'soup', 'salad', 'pasta', 'pizza', 'burger', 'sandwich', 'steak',
  'seafood', 'sushi', 'rice', 'noodle', 'curry', 'stew', 'roast', 'grill',
  'barbecue', 'sauce', 'condiment', 'spice', 'herb', 'ingredient', 'kitchen',
  'cooking', 'chef', 'cook', 'oven', 'stove', 'refrigerator', 'cutlery',
  'spoon', 'fork', 'knife', 'restaurant', 'dining', 'table', 'meal', 'breakfast',
  'lunch', 'dinner', 'snack', 'beverage', 'drink', 'coffee', 'tea', 'wine', 'beer',
  'cocktail', 'juice', 'water', 'milk', 'cream', 'cheese', 'yogurt', 'butter',
  'egg', 'flour', 'sugar', 'salt', 'pepper', 'oil', 'vinegar', 'honey', 'jam',
  'chocolate', 'candy', 'cookie', 'biscuit', 'pie', 'tart', 'pastry', 'dough',
  'batter', 'crust', 'slice', 'piece', 'portion', 'serving', 'menu', 'recipe',
  'cookbook', 'apron', 'toque', 'uniform', 'garnish', 'decoration'
];

// Keywords common in CVs (Italian & English)
const CV_KEYWORDS = [
  'curriculum', 'vitae', 'resume', 'cv', 'profile', 'profilo',
  'experience', 'esperienza', 'lavoro', 'work', 'job', 'impiego',
  'education', 'istruzione', 'formazione', 'degree', 'laurea', 'diploma',
  'skills', 'competenze', 'capacità', 'lingue', 'languages',
  'contact', 'contatti', 'email', 'phone', 'telefono', 'cellulare', 'mobile',
  'address', 'indirizzo', 'personal', 'personali', 'date of birth', 'data di nascita',
  'nationality', 'nazionalità', 'gender', 'sesso', 'autorizzo', 'authorize',
  'privacy', 'dati personali', 'personal data', 'gdpr', 'trattamento'
];

// --- State ---
let mobileNetModel: mobilenet.MobileNet | null = null;
let isModelLoading = false;

// --- Helpers ---

async function loadMobileNet() {
  if (mobileNetModel) return mobileNetModel;
  if (isModelLoading) {
    // Wait for it to load
    while (isModelLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (mobileNetModel) return mobileNetModel;
    }
  }
  
  isModelLoading = true;
  try {
    // Load the model. This triggers a download of ~2MB
    console.log('Loading MobileNet model...');
    mobileNetModel = await mobilenet.load({
      version: 2,
      alpha: 1.0
    });
    console.log('MobileNet model loaded.');
    return mobileNetModel;
  } catch (error) {
    console.error('Error loading MobileNet:', error);
    throw error;
  } finally {
    isModelLoading = false;
  }
}

async function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// --- Main Verification Functions ---

export type VerificationResult = {
  valid: boolean;
  reason?: string;
  detected?: string[];
  confidence?: number;
  isAI?: boolean; // To indicate if AI was actually used or fallback
};

export async function verifyChefImage(file: File): Promise<VerificationResult> {
  try {
    // 1. Basic check
    if (!file.type.startsWith('image/')) {
      return { valid: false, reason: 'Il file non è un\'immagine valida.' };
    }

    // 2. Load Model
    const model = await loadMobileNet();

    // 3. Create Image Element
    const imgElement = document.createElement('img');
    const dataUrl = await readFileAsDataURL(file);
    imgElement.src = dataUrl;
    
    await new Promise((resolve) => {
      imgElement.onload = resolve;
    });

    // 4. Classify
    // Classify the image.
    const predictions = await model.classify(imgElement, 5); // Get top 5
    
    // 5. Analyze Predictions
    // Check if any prediction matches our food whitelist
    // We check if the class name contains any of our keywords
    const detectedClasses = predictions.map(p => p.className.toLowerCase());
    const matches = detectedClasses.filter(cls => 
      FOOD_KEYWORDS.some(keyword => cls.includes(keyword))
    );

    const isFood = matches.length > 0;
    
    // Cleanup
    imgElement.remove();

    if (isFood) {
      return { 
        valid: true, 
        detected: matches, 
        confidence: predictions[0].probability,
        isAI: true
      };
    } else {
      return { 
        valid: false, 
        reason: `L'immagine non sembra mostrare cibo o piatti. (Rilevato: ${detectedClasses.slice(0, 3).join(', ')})`,
        detected: detectedClasses,
        confidence: predictions[0].probability,
        isAI: true
      };
    }

  } catch (error) {
    console.error('Image verification error:', error);
    // Fail safe: If AI fails, allow the file but warn or log? 
    // For this requirement, "block upload" implies strictness, but we shouldn't block valid files on technical errors.
    // We'll return valid=true but with a warning note in reason if needed, or valid=false if we want strict mode.
    // Let's be safe: Allow upload if AI fails, but log it.
    return { valid: true, reason: 'Verifica AI saltata per errore tecnico.', isAI: false };
  }
}

export async function verifyCVDocument(file: File): Promise<VerificationResult> {
  try {
    let textContent = '';

    // 1. Extract Text
    if (file.type === 'application/pdf') {
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      // Read first 2 pages max to save time/perf
      const maxPages = Math.min(pdf.numPages, 2);
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContentItem = await page.getTextContent();
        const pageText = textContentItem.items.map((item: any) => item.str).join(' ');
        textContent += pageText + ' ';
      }

    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // DOCX
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const result = await mammoth.extractRawText({ arrayBuffer });
        textContent = result.value;

    } else if (file.type === 'text/plain') {
       const text = await new Promise<string>((resolve) => {
         const reader = new FileReader();
         reader.onload = (e) => resolve(e.target?.result as string);
         reader.readAsText(file);
       });
       textContent = text;
    } else {
        // Unsupported format for AI check (e.g. .doc legacy, or others)
        // We'll skip strict check but warn
        return { valid: true, reason: 'Formato non supportato per analisi AI, verifica saltata.', isAI: false };
    }

    // 2. Analyze Text
    const lowerText = textContent.toLowerCase();
    const foundKeywords = CV_KEYWORDS.filter(keyword => lowerText.includes(keyword));

    // 3. Decide
    if (foundKeywords.length >= CONFIDENCE_THRESHOLD_TEXT) {
       return { 
         valid: true, 
         detected: foundKeywords.slice(0, 5), // Return top 5 matches
         confidence: foundKeywords.length / CV_KEYWORDS.length, // Rough score
         isAI: true
       };
    } else {
       return { 
         valid: false, 
         reason: 'Il documento non sembra essere un CV valido (mancano parole chiave tipiche come "Esperienza", "Istruzione", "Contatti").',
         detected: foundKeywords,
         confidence: 0,
         isAI: true
       };
    }

  } catch (error) {
    console.error('Document verification error:', error);
    return { valid: true, reason: 'Verifica AI saltata per errore tecnico.', isAI: false };
  }
}
