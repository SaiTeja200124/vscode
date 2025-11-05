/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { nullExtensionDescription } from '../../../services/extensions/common/extensions.js';
import {
	ChatMessageRole,
	IChatMessage,
	ILanguageModelChatMetadataAndIdentifier,
	ILanguageModelChatProvider,
	ILanguageModelChatResponse,
	ILanguageModelsService
} from '../common/languageModels.js';
import { localize } from '../../../../nls.js';

interface OpenAIMessage {
	role: string;
	content: string;
}

/**
 * Language Model Providers Contribution
 * Registers OpenAI and Anthropic providers for the chat
 */
export class LanguageModelProvidersContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.languageModelProviders';

	constructor(
		@ILanguageModelsService private readonly languageModelsService: ILanguageModelsService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
		super();

		console.log('[Language Model Providers] Initializing...');

		// Register providers immediately - vendors should already be registered
		this.registerProviders();
	}

	private registerProviders(): void {
		try {
			console.log('[Language Model Providers] Registering OpenAI provider...');
			// Register OpenAI provider
			const openaiProvider = new OpenAILanguageModelProvider(this.configurationService);
			this._register(this.languageModelsService.registerLanguageModelProvider('openai', openaiProvider));
			console.log('[Language Model Providers] OpenAI provider registered successfully');

			console.log('[Language Model Providers] Registering Anthropic provider...');
			// Register Anthropic provider
			const anthropicProvider = new AnthropicLanguageModelProvider(this.configurationService);
			this._register(this.languageModelsService.registerLanguageModelProvider('anthropic', anthropicProvider));
			console.log('[Language Model Providers] Anthropic provider registered successfully');

			console.log('[Language Model Providers] All providers registered successfully');
		} catch (error) {
			console.error('[Language Model Providers] Failed to register providers:', error);
		}
	}
}

/**
 * OpenAI Language Model Provider
 */
class OpenAILanguageModelProvider extends Disposable implements ILanguageModelChatProvider {

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange: Event<void> = this._onDidChange.event;

	constructor(
		private readonly configurationService: IConfigurationService
	) {
		super();

		// Listen for configuration changes
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('languageModels.openai')) {
				this._onDidChange.fire();
			}
		}));
	}

	async provideLanguageModelChatInfo(options: { silent: boolean }, token: CancellationToken): Promise<ILanguageModelChatMetadataAndIdentifier[]> {
		// Try to get API key from: 1) Environment variable, 2) Settings, 3) Hardcoded default
		const envKey = typeof process !== 'undefined' ? process.env?.['OPENAI_API_KEY'] : undefined;
		const settingsKey = this.configurationService.getValue<string>('languageModels.openai.apiKey');
		const hardcodedKey = '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';

		const apiKey = envKey || settingsKey || hardcodedKey;

		console.log('[OpenAI Provider] API Key check:', {
			hasEnvKey: !!envKey,
			hasSettingsKey: !!settingsKey,
			hasHardcodedKey: !!hardcodedKey,
			finalKeyPrefix: apiKey ? apiKey.substring(0, 20) : 'NONE'
		});

		if (!apiKey || apiKey === '') {
			console.error('[OpenAI Provider] No API key found!');
			return [];
		}

		// Return available OpenAI models
		return [
			{
				identifier: 'openai-gpt-4o',
				metadata: {
					extension: nullExtensionDescription.identifier,
					name: 'GPT-4o',
					id: 'gpt-4o',
					vendor: 'openai',
					version: '1.0.0',
					family: 'gpt-4',
					maxInputTokens: 128000,
					maxOutputTokens: 16384,
					isDefault: true,
					isUserSelectable: true,
					tooltip: localize('openai.gpt4o', 'OpenAI GPT-4o - Most capable model'),
					modelPickerCategory: undefined,
					capabilities: {
						vision: true,
						toolCalling: true,
						agentMode: true
					}
				}
			},
			{
				identifier: 'openai-gpt-4o-mini',
				metadata: {
					extension: nullExtensionDescription.identifier,
					name: 'GPT-4o Mini',
					id: 'gpt-4o-mini',
					vendor: 'openai',
					version: '1.0.0',
					family: 'gpt-4',
					maxInputTokens: 128000,
					maxOutputTokens: 16384,
					isDefault: false,
					isUserSelectable: true,
					tooltip: localize('openai.gpt4omini', 'OpenAI GPT-4o Mini - Faster and cheaper'),
					modelPickerCategory: undefined,
					capabilities: {
						vision: true,
						toolCalling: true,
						agentMode: true
					}
				}
			}
		];
	}

	async sendChatRequest(
		modelId: string,
		messages: IChatMessage[],
		from: ExtensionIdentifier,
		options: { [name: string]: any },
		token: CancellationToken
	): Promise<ILanguageModelChatResponse> {
		// Try to get API key from: 1) Environment variable, 2) Settings, 3) Hardcoded default
		const apiKey = (typeof process !== 'undefined' && process.env?.['OPENAI_API_KEY']) ||
			this.configurationService.getValue<string>('languageModels.openai.apiKey') ||
			'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';

		const baseURL = this.configurationService.getValue<string>('languageModels.openai.baseURL') || 'https://api.openai.com/v1';

		if (!apiKey) {
			throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable or languageModels.openai.apiKey in settings.');
		}

		// Convert messages to OpenAI format
		const openaiMessages: OpenAIMessage[] = messages.map(msg => ({
			role: msg.role === ChatMessageRole.System ? 'system' :
				msg.role === ChatMessageRole.User ? 'user' : 'assistant',
			content: msg.content.map(part => {
				if (part.type === 'text') {
					return part.value;
				}
				return '';
			}).join('')
		}));

		const model = modelId.replace('openai-', '');

		// Create async generator for streaming
		const stream = this.streamOpenAIResponse(baseURL, apiKey, model, openaiMessages, token);

		return {
			stream,
			result: Promise.resolve({})
		};
	}

	private async *streamOpenAIResponse(
		baseURL: string,
		apiKey: string,
		model: string,
		messages: OpenAIMessage[],
		token: CancellationToken
	): AsyncIterable<{ type: 'text'; value: string }> {
		try {
			// Convert CancellationToken to AbortSignal
			const abortController = new AbortController();
			const disposable = token.onCancellationRequested(() => {
				abortController.abort();
			});

			try {
				const response = await fetch(`${baseURL}/chat/completions`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${apiKey}`
					},
					body: JSON.stringify({
						model,
						messages,
						stream: true
					}),
					signal: abortController.signal
				});

				if (!response.ok) {
					throw new Error(`OpenAI API error: ${response.statusText}`);
				}

				const reader = response.body?.getReader();
				const decoder = new TextDecoder();

				if (!reader) {
					throw new Error('No response body');
				}

				let buffer = '';

				while (true) {
					const { done, value } = await reader.read();
					if (done) { break; }

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					buffer = lines.pop() || '';

					for (const line of lines) {
						if (line.startsWith('data: ')) {
							const data = line.slice(6);
							if (data === '[DONE]') { continue; }

							try {
								const parsed = JSON.parse(data);
								const content = parsed.choices?.[0]?.delta?.content;
								if (content) {
									yield { type: 'text', value: content };
								}
							} catch (e) {
								// Skip invalid JSON
							}
						}
					}
				}
			} finally {
				disposable.dispose();
			}
		} catch (error: any) {
			if (error.name === 'AbortError') {
				// Request was cancelled
				return;
			}
			throw error;
		}
	}

	async provideTokenCount(modelId: string, message: string | IChatMessage, token: CancellationToken): Promise<number> {
		// Simple token estimation (roughly 4 characters per token)
		const text = typeof message === 'string' ? message :
			message.content.map(p => p.type === 'text' ? p.value : '').join('');
		return Math.ceil(text.length / 4);
	}
}

/**
 * Anthropic Language Model Provider
 */
class AnthropicLanguageModelProvider extends Disposable implements ILanguageModelChatProvider {

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange: Event<void> = this._onDidChange.event;

	constructor(
		private readonly configurationService: IConfigurationService
	) {
		super();

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('languageModels.anthropic')) {
				this._onDidChange.fire();
			}
		}));
	}

	async provideLanguageModelChatInfo(options: { silent: boolean }, token: CancellationToken): Promise<ILanguageModelChatMetadataAndIdentifier[]> {
		const apiKey = this.configurationService.getValue<string>('languageModels.anthropic.apiKey');

		if (!apiKey) {
			return [];
		}

		return [
			{
				identifier: 'anthropic-claude-3.5-sonnet',
				metadata: {
					extension: nullExtensionDescription.identifier,
					name: 'Claude 3.5 Sonnet',
					id: 'claude-3-5-sonnet-20241022',
					vendor: 'anthropic',
					version: '1.0.0',
					family: 'claude-3.5',
					maxInputTokens: 200000,
					maxOutputTokens: 8192,
					isDefault: false,
					isUserSelectable: true,
					tooltip: localize('anthropic.claude35sonnet', 'Anthropic Claude 3.5 Sonnet'),
					modelPickerCategory: undefined,
					capabilities: {
						vision: true,
						toolCalling: true,
						agentMode: true
					}
				}
			}
		];
	}

	async sendChatRequest(
		modelId: string,
		messages: IChatMessage[],
		from: ExtensionIdentifier,
		options: { [name: string]: any },
		token: CancellationToken
	): Promise<ILanguageModelChatResponse> {
		const apiKey = this.configurationService.getValue<string>('languageModels.anthropic.apiKey');
		const baseURL = this.configurationService.getValue<string>('languageModels.anthropic.baseURL') || 'https://api.anthropic.com/v1';

		if (!apiKey) {
			throw new Error('Anthropic API key not configured. Please set languageModels.anthropic.apiKey in settings.');
		}

		// Convert messages (Anthropic has different format)
		const anthropicMessages = messages
			.filter(msg => msg.role !== ChatMessageRole.System)
			.map(msg => ({
				role: msg.role === ChatMessageRole.User ? 'user' : 'assistant',
				content: msg.content.map(part => part.type === 'text' ? part.value : '').join('')
			}));

		const systemMessage = messages.find(msg => msg.role === ChatMessageRole.System);
		const model = modelId.replace('anthropic-', '');

		const stream = this.streamAnthropicResponse(baseURL, apiKey, model, anthropicMessages, systemMessage, token);

		return {
			stream,
			result: Promise.resolve({})
		};
	}

	private async *streamAnthropicResponse(
		baseURL: string,
		apiKey: string,
		model: string,
		messages: any[],
		systemMessage: IChatMessage | undefined,
		token: CancellationToken
	): AsyncIterable<{ type: 'text'; value: string }> {
		try {
			// Convert CancellationToken to AbortSignal
			const abortController = new AbortController();
			const disposable = token.onCancellationRequested(() => {
				abortController.abort();
			});

			try {
				const body: any = {
					model,
					messages,
					max_tokens: 8192,
					stream: true
				};

				if (systemMessage) {
					body.system = systemMessage.content.map(p => p.type === 'text' ? p.value : '').join('');
				}

				const response = await fetch(`${baseURL}/messages`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'x-api-key': apiKey,
						'anthropic-version': '2023-06-01'
					},
					body: JSON.stringify(body),
					signal: abortController.signal
				});

				if (!response.ok) {
					throw new Error(`Anthropic API error: ${response.statusText}`);
				}

				const reader = response.body?.getReader();
				const decoder = new TextDecoder();

				if (!reader) {
					throw new Error('No response body');
				}

				let buffer = '';

				while (true) {
					const { done, value } = await reader.read();
					if (done) { break; }

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					buffer = lines.pop() || '';

					for (const line of lines) {
						if (line.startsWith('data: ')) {
							const data = line.slice(6);

							try {
								const parsed = JSON.parse(data);
								if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
									yield { type: 'text', value: parsed.delta.text };
								}
							} catch (e) {
								// Skip invalid JSON
							}
						}
					}
				}
			} finally {
				disposable.dispose();
			}
		} catch (error: any) {
			if (error.name === 'AbortError') {
				return;
			}
			throw error;
		}
	}

	async provideTokenCount(modelId: string, message: string | IChatMessage, token: CancellationToken): Promise<number> {
		const text = typeof message === 'string' ? message :
			message.content.map(p => p.type === 'text' ? p.value : '').join('');
		return Math.ceil(text.length / 4);
	}
}

