/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { ILanguageModelsService } from '../common/languageModels.js';

/**
 * Core Language Model Vendors Registration
 * This registers built-in vendors (OpenAI, Anthropic, Ollama) before the providers are registered
 */
export class CoreLanguageModelVendorsContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.coreLanguageModelVendors';

	constructor(
		@ILanguageModelsService private readonly languageModelsService: ILanguageModelsService
	) {
		super();

		console.log('[Core LM Vendors] Registering core vendors...');

		// Register vendors by adding them to the internal vendors map
		// This is a workaround for core providers
		this.registerCoreVendors();
	}

	private registerCoreVendors(): void {
		// Access the internal _vendors map through the service
		// Since we're in core, we can directly manipulate the service
		const service = this.languageModelsService as any;

		if (service._vendors) {
			console.log('[Core LM Vendors] Registering openai vendor');
			service._vendors.set('openai', {
				vendor: 'openai',
				displayName: 'OpenAI',
				managementCommand: undefined
			});

			console.log('[Core LM Vendors] Registering anthropic vendor');
			service._vendors.set('anthropic', {
				vendor: 'anthropic',
				displayName: 'Anthropic',
				managementCommand: undefined
			});

			console.log('[Core LM Vendors] Registering ollama vendor');
			service._vendors.set('ollama', {
				vendor: 'ollama',
				displayName: 'Ollama',
				managementCommand: undefined
			});

			console.log('[Core LM Vendors] Core vendors registered successfully');
		} else {
			console.error('[Core LM Vendors] Could not access vendors map');
		}
	}
}

