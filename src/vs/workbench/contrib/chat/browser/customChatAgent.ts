/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IChatAgentHistoryEntry, IChatAgentImplementation, IChatAgentRequest, IChatAgentResult, IChatAgentService } from '../common/chatAgents.js';
import { IChatProgress } from '../common/chatService.js';
import { ChatAgentLocation, ChatModeKind } from '../common/constants.js';
import { ILanguageModelsService, ChatMessageRole } from '../common/languageModels.js';
import { nullExtensionDescription } from '../../../services/extensions/common/extensions.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';

/**
 * Custom Chat Agent - A built-in AI assistant using custom language models
 * This replaces the need for Copilot extension
 */
export class CustomChatAgentContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.customChatAgent';

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IChatAgentService private readonly chatAgentService: IChatAgentService,
	) {
		super();

		// Register the default chat agent
		this.registerChatAgent();
	}

	private registerChatAgent(): void {
		const agentId = 'custom-ai-assistant';

		// Register agent metadata
		this._register(this.chatAgentService.registerAgent(agentId, {
			id: agentId,
			name: 'copilot', // This is what users will type: @copilot
			fullName: 'AI Assistant',
			description: localize('customChatAgentDescription', 'AI coding assistant powered by OpenAI, Anthropic, and other models'),
			isDefault: true, // Make this the default agent
			isCore: true, // Mark as a core agent (not from extension)
			modes: [ChatModeKind.Ask, ChatModeKind.Edit, ChatModeKind.Agent],
			slashCommands: [
				{
					name: 'explain',
					description: localize('explainCommand', 'Explain the selected code')
				},
				{
					name: 'fix',
					description: localize('fixCommand', 'Fix problems in the selected code')
				},
				{
					name: 'test',
					description: localize('testCommand', 'Generate tests for the selected code')
				}
			],
			disambiguation: [],
			locations: [ChatAgentLocation.Chat, ChatAgentLocation.EditorInline, ChatAgentLocation.Notebook, ChatAgentLocation.Terminal],
			metadata: {},
			extensionId: nullExtensionDescription.identifier,
			extensionVersion: undefined,
			extensionDisplayName: 'Built-in AI',
			extensionPublisherId: nullExtensionDescription.publisher
		}));

		// Register agent implementation
		const agentImpl = this.instantiationService.createInstance(CustomChatAgentImplementation);
		this._register(this.chatAgentService.registerAgentImplementation(agentId, agentImpl));
	}
}

/**
 * Implementation of the custom chat agent
 */
class CustomChatAgentImplementation extends Disposable implements IChatAgentImplementation {

	constructor(
		@ILanguageModelsService private readonly languageModelsService: ILanguageModelsService,
	) {
		super();
	}

	async invoke(request: IChatAgentRequest, progress: (parts: IChatProgress[]) => void, history: IChatAgentHistoryEntry[], token: CancellationToken): Promise<IChatAgentResult> {
		try {
			console.log('[Custom Chat Agent] Received request:', request.message);

			// Get the user's prompt
			const userPrompt = request.message;

			// Get available language models
			const models = this.languageModelsService.getLanguageModelIds();
			console.log('[Custom Chat Agent] Available model IDs:', models);

			if (models.length === 0) {
				console.error('[Custom Chat Agent] No models available!');
				progress([{
					kind: 'markdownContent',
					content: new MarkdownString('⚠️ No language models are available. Please check the Developer Tools console for errors.')
				}]);
				return { errorDetails: { message: 'No language models available' } };
			}

			// Find a default model
			let selectedModelId: string | null = null;
			let selectedModel = null;

			for (const modelId of models) {
				const model = this.languageModelsService.lookupLanguageModel(modelId);
				console.log('[Custom Chat Agent] Checking model:', modelId, 'metadata:', model);
				if (model?.isDefault) {
					selectedModelId = modelId;
					selectedModel = model;
					break;
				}
			}

			// Fallback to first available model
			if (!selectedModelId && models.length > 0) {
				selectedModelId = models[0];
				selectedModel = this.languageModelsService.lookupLanguageModel(selectedModelId);
			}

			if (!selectedModelId || !selectedModel) {
				console.error('[Custom Chat Agent] No suitable model found!');
				progress([{
					kind: 'markdownContent',
					content: new MarkdownString('⚠️ Could not find a suitable language model.')
				}]);
				return { errorDetails: { message: 'No suitable model found' } };
			}

			console.log('[Custom Chat Agent] Selected model:', selectedModelId, selectedModel.name);

			// Build messages for the model
			const messages = [{
				role: ChatMessageRole.User,
				content: [{
					type: 'text' as const,
					value: userPrompt
				}]
			}];

			// Send request to the language model via the service
			console.log('[Custom Chat Agent] Sending request to model:', selectedModelId);
			const modelRequest = await this.languageModelsService.sendChatRequest(
				selectedModelId,
				nullExtensionDescription.identifier,
				messages,
				{},
				token
			);
			console.log('[Custom Chat Agent] Model request sent, awaiting response...');

			// Stream the response back
			for await (const chunk of modelRequest.stream) {
				if (Array.isArray(chunk)) {
					for (const part of chunk) {
						if (part.type === 'text') {
							progress([{
								kind: 'markdownContent',
								content: new MarkdownString(part.value)
							}]);
						}
					}
				} else if (chunk.type === 'text') {
					progress([{
						kind: 'markdownContent',
						content: new MarkdownString(chunk.value)
					}]);
				}
			}

			return {
				metadata: {
					metadataStr: 'success'
				}
			};

		} catch (error: any) {
			console.error('Custom chat agent error:', error);
			progress([{
				kind: 'markdownContent',
				content: new MarkdownString(`❌ Error: ${error.message}`)
			}]);
			return { errorDetails: { message: error.message } };
		}
	}
}

