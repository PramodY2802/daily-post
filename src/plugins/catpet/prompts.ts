import { Platform, type ContentType, type Tone } from '../../config/constants.js';

interface PromptParams {
  type: 'adoption' | 'lost' | 'awareness';
  animalType: string;
  animalName?: string;
  breed?: string;
  age?: string;
  location: string;
  description?: string;
  platform: Platform;
  contentType: ContentType;
  tone: Tone;
}

function getPlatformInstruction(platform: Platform): string {
  switch (platform) {
    case Platform.TWITTER:
      return `Platform rules:
- Text must not exceed 280 characters, including hashtags
- Write short, clear, high-impact copy
- Use no more than 5 hashtags`;
    case Platform.INSTAGRAM:
      return `Platform rules:
- Write a detailed caption, around 1000-2000 characters
- Use 15-20 hashtags
- Use emojis naturally
- Write like a story and create an emotional connection
- Make the first sentence attention-grabbing`;
    case Platform.YOUTUBE:
      return `Platform rules:
- Write a video title and description
- Use SEO-friendly hashtags, around 10-15
- Include detailed information in the description`;
    case Platform.TIKTOK:
      return `Platform rules:
- Keep it short and energetic
- Use trending hashtags, around 5-10
- Write in a friendly, modern style`;
  }
}

export function buildCatpetPrompt(params: PromptParams): string {
  const platformInstruction = getPlatformInstruction(params.platform);

  const baseInstruction = `You are a social media content creator specializing in animal welfare and adoption.
Write in English. Use a warm, emotional, and persuasive tone.
Platform: ${params.platform}
Content type: ${params.contentType}
Tone: ${params.tone}

${platformInstruction}`;

  switch (params.type) {
    case 'adoption':
      return `${baseInstruction}

Create an adoption post for this animal:
- Animal type: ${params.animalType}
${params.animalName ? `- Name: ${params.animalName}` : ''}
${params.breed ? `- Breed: ${params.breed}` : ''}
${params.age ? `- Age: ${params.age}` : ''}
- Location: ${params.location}
${params.description ? `- Description: ${params.description}` : ''}

Important rules:
- Do not ask for adoption links or contact details; only write the post text
- Use an emotional but natural tone
- Highlight the animal's qualities
- Add suitable hashtags, such as #AdoptDontShop, #Adoption, #AnimalWelfare`;

    case 'lost':
      return `${baseInstruction}

Create an urgent lost-pet post:
- Animal type: ${params.animalType}
${params.animalName ? `- Name: ${params.animalName}` : ''}
${params.breed ? `- Breed: ${params.breed}` : ''}
- Lost near: ${params.location}
${params.description ? `- Description: ${params.description}` : ''}

Important rules:
- Create a sense of urgency
- Encourage sharing
- Address people in the local area
- Add suitable hashtags, such as #LostPet, #MissingPet, #HelpFind`;

    case 'awareness':
      return `${baseInstruction}

Create animal welfare and adoption awareness content.
Topic: ${params.description ?? 'General animal welfare awareness'}
Location/Region: ${params.location}

Important rules:
- Be educational and informative
- You may use statistics or factual context
- Include a clear call to action, such as adopt, foster, donate, or share
- Add suitable hashtags`;
  }
}
