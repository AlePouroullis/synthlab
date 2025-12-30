/**
 * CHAT CLIENT
 * ============
 * Handles Anthropic API communication and tool execution.
 */

import Anthropic from '@anthropic-ai/sdk';
import { SynthEngine } from '../synth';
import { SYNTH_TOOLS, executeTool } from './tools';

const SYSTEM_PROMPT = `You are a musical assistant controlling a web synthesizer.

You can:
- Play notes and chords (use note names like C4, F#3, A#5)
- Play melodies and chord progressions
- Adjust the synth sound (waveform, filter, envelope)

The synth has:
- Waveforms: sine (pure), triangle (mellow), sawtooth (bright), square (hollow)
- Filter: lowpass/highpass/bandpass with cutoff and resonance
- ADSR envelope: attack, decay, sustain, release

Be creative and musical! When asked to play something, use the tools to make sound.`;

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export class ChatClient {
  private client: Anthropic | null = null;
  private synth: SynthEngine;
  private conversationHistory: Anthropic.MessageParam[] = [];

  constructor(synth: SynthEngine) {
    this.synth = synth;
  }

  /**
   * Initialize with API key.
   */
  setApiKey(apiKey: string): void {
    this.client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true, // Acknowledged: demo use only
    });
  }

  /**
   * Check if client is ready.
   */
  isReady(): boolean {
    return this.client !== null;
  }

  /**
   * Send a message and get a response.
   * Handles tool use loop automatically.
   */
  async sendMessage(userMessage: string, onToolUse?: (toolName: string) => void): Promise<string> {
    if (!this.client) {
      throw new Error('API key not set');
    }

    // Ensure synth is initialized
    if (!this.synth.isInitialized()) {
      await this.synth.initialize();
    }

    // Add user message to history
    this.conversationHistory.push({ role: 'user', content: userMessage });

    let response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: SYNTH_TOOLS,
      messages: this.conversationHistory,
    });

    // Tool use loop
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        onToolUse?.(toolUse.name);

        const result = executeTool(
          this.synth,
          toolUse.name,
          toolUse.input as Record<string, unknown>
        );

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      // Add assistant response and tool results to history
      this.conversationHistory.push({ role: 'assistant', content: response.content });
      this.conversationHistory.push({ role: 'user', content: toolResults });

      // Continue conversation
      response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: SYNTH_TOOLS,
        messages: this.conversationHistory,
      });
    }

    // Extract final text response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );

    const assistantMessage = textBlocks.map((b) => b.text).join('\n');

    // Add to history
    this.conversationHistory.push({ role: 'assistant', content: response.content });

    return assistantMessage;
  }

  /**
   * Clear conversation history.
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }
}
