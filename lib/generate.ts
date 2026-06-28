import Anthropic from '@anthropic-ai/sdk';
import type { ReferenceScreen } from './db';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateMockup(
  proposalContent: string,
  referenceScreens: ReferenceScreen[]
): Promise<string> {
  const systemPrompt = `You are an expert UI/UX designer who creates realistic HTML mockup screens.
Your task is to generate a complete, self-contained HTML mockup based on the provided business proposal.

Rules:
- Generate ONLY the HTML content (complete HTML document with <html>, <head>, <body> tags)
- Use inline CSS styles for all styling (no external stylesheets)
- Create a realistic, professional-looking UI
- Support Korean text naturally
- Use a clean, modern design aesthetic
- Include realistic placeholder data (Korean or English as appropriate)
- Do NOT use JavaScript (static mockup only)
- Make it visually appealing with proper spacing, colors, and typography
- Use a color palette that matches the business domain (e.g., blue for fintech, green for healthcare)
- Include proper navigation, header, content areas as appropriate for the screen type

If reference screens are provided as images, analyze their visual style (colors, layout, typography, component design) and apply that style to the new mockup.`;

  const userContent: Anthropic.MessageParam['content'] = [];

  if (referenceScreens.length > 0) {
    userContent.push({
      type: 'text',
      text: `Here are ${referenceScreens.length} reference screen(s) from the existing system. Please analyze their visual style and apply it to the new mockup:`,
    });

    for (const screen of referenceScreens) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: screen.mime_type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: screen.image_data,
        },
      });
      userContent.push({
        type: 'text',
        text: `Reference screen: "${screen.name}"`,
      });
    }
  }

  userContent.push({
    type: 'text',
    text: `Now create an HTML mockup for the following business proposal:

---
${proposalContent}
---

Generate a complete HTML document that represents this screen as a mockup. The HTML should be production-quality in appearance but clearly a static mockup.`,
  });

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 8096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('AI가 응답을 생성하지 못했습니다.');
  }

  let html = textContent.text;

  // Extract HTML if wrapped in markdown code blocks
  const htmlMatch = html.match(/```html\n?([\s\S]*?)\n?```/);
  if (htmlMatch) {
    html = htmlMatch[1];
  }

  // Ensure it starts with proper HTML
  if (!html.trim().startsWith('<!DOCTYPE') && !html.trim().startsWith('<html')) {
    html = `<!DOCTYPE html>\n<html lang="ko">\n${html}\n</html>`;
  }

  return html;
}
