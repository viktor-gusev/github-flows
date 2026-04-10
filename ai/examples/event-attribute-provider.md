# Event Attribute Provider Example

- Path: `ai/examples/event-attribute-provider.md`
- Version: `20260410`

This example shows how a host application can register one optional `Github_Flows_Event_Attribute_Provider` during startup.

```js
// App/Github/Attribute/Provider.mjs
// @ts-check

export default class App_Github_Attribute_Provider {
    constructor() {
        /**
         * @param {{
         *   headers?: Record<string, string | string[] | undefined>,
         *   loggingContext?: Github_Flows_Event_Logging_Context__Data,
         *   payload: unknown,
         * }} params
         * @returns {Promise<Partial<Github_Flows_Event_Attribute__Set> | undefined>}
         */
        this.getAttributes = async function ({payload}) {
            const body = /** @type {Record<string, unknown>} */ (payload ?? {});
            const issue = /** @type {Record<string, unknown>} */ (body.issue ?? {});
            const user = /** @type {Record<string, unknown>} */ (issue.user ?? {});

            return {
                issueAuthor: typeof user.login === 'string' ? user.login : undefined,
            };
        };
    }
}
```

```js
// App/Github/Bootstrap.mjs
// @ts-check

export const __deps__ = {
    attributeProviderHolder: 'Github_Flows_Event_Attribute_Provider_Holder$',
    runtimeFactory: 'Github_Flows_Config_Runtime__Factory$',
    webServer: 'Github_Flows_Web_Server$',
    provider: 'App_Github_Attribute_Provider$',
};

export default class App_Github_Bootstrap {
    /**
     * @param {{
     *   attributeProviderHolder: Github_Flows_Event_Attribute_Provider_Holder,
     *   runtimeFactory: Github_Flows_Config_Runtime__Factory,
     *   webServer: Github_Flows_Web_Server,
     *   provider: App_Github_Attribute_Provider,
     * }} deps
     */
    constructor({attributeProviderHolder, runtimeFactory, webServer, provider}) {
        this.execute = async function () {
            runtimeFactory.configure({
                workspaceRoot: './var/github-flows',
                runtimeImage: 'codex-agent:latest',
                webhookSecret: 'shared-secret',
            });
            runtimeFactory.freeze();

            attributeProviderHolder.set(provider);

            await webServer.start();
        };
    }
}
```

```js
const app = await container.get('App_Github_Bootstrap$');
await app.execute();
```

Notes:

- register the provider once during startup;
- return additional attributes only;
- let the package handle profile matching and execution permission;
- skip the provider entirely if the host does not need extra event attributes.

